/**
 * Disposable-Postgres integration: real competition repository, transaction locks,
 * visibility and manager-owned My Competitions. CI ONLY; never points to production.
 * Run after pnpm db:migrate on the futsal_ci GitHub Actions database.
 */
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createDatabase} from "@leaguekick/database";
import {competitionDiscoveryQuerySchema} from "@leaguekick/contracts";
import {DrizzleCompetitionRepository} from "../src/modules/competition/competition.repository.js";
import {CompetitionService} from "../src/modules/competition/competition.service.js";

const url=process.env.DATABASE_URL??"";
const parsed=url?new URL(url):null;
if(process.env.CI!=="true"||parsed?.pathname!=="/futsal_ci"||
  !["127.0.0.1","localhost"].includes(parsed?.hostname)){
  throw new Error("Phase 7 competition DB tests refuse non-disposable CI databases.");
}
const {db,pool}=createDatabase(url);
const q=async(sql:string,params:unknown[]=[])=> (await pool.query(sql,params)).rows;
const one=async(sql:string,params:unknown[]=[])=> (await q(sql,params))[0];
const now=()=>new Date();
const service=new CompetitionService(new DrizzleCompetitionRepository(db),now);
const repository=new DrizzleCompetitionRepository(db);
const stamp=randomUUID().replace(/-/g,"").slice(0,18);
const insertUser=async(role:string)=>{
  const name="qa7"+role.toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,8)+stamp.slice(0,9);
  const row=await one("insert into users(display_name,username,username_normalized,email_normalized,email_verified_at,password_hash,preferred_language,status,city) values($1,$2,$2,$3,now(),'!CI_ONLY','en','ACTIVE','Kabul') returning id",[name,name,name+"@futsal.test"]);
  return row.id as string;
};
try{
  const owner=await insertUser("owner");
  const managerIds=await Promise.all([insertUser("mgr1"),insertUser("mgr2"),insertUser("mgr3")]);
  const venue=await one("insert into venues(owner_user_id,name,public_phone,province,city,address,timezone,booking_mode,status,verification_status,verified_at,setup_completed_at) values($1,$2,'0000000000','Kabul','Kabul','CI-only','Asia/Kabul','INSTANT','ACTIVE','VERIFIED',now(),now()) returning id",[owner,"Phase 7 Arena "+stamp]);
  await q("insert into venue_subscriptions(venue_id,status,active_until) values($1,'ACTIVE',now()+interval '1 year')",[venue.id]);
  const teams=[];
  for(let i=0;i<3;i++){
    const team=await one("insert into teams(name,city,manager_user_id,status,privacy) values($1,'Kabul',$2,'ACTIVE','PUBLIC') returning id",["QA7 Team "+stamp+" "+i,managerIds[i]]);
    teams.push(team.id as string);
  }
  const baseline={
    name:"Phase 7 Release QA "+stamp,description:"Disposable concurrency / privacy QA",
    format:"LEAGUE" as const,maxTeams:2,registrationFeeAfn:0,
    winPoints:3,drawPoints:1,lossPoints:0,
    tieBreakOrder:["POINTS","GOAL_DIFFERENCE","GOALS_FOR"] as const,
    groupCount:null,qualifiersPerGroup:null,
    registrationClosesAt:new Date(Date.now()+10*86400000).toISOString(),
    matchDurationMinutes:60,startsAt:new Date(Date.now()+14*86400000).toISOString(),endsAt:null,
  };
  // Validate truly simultaneous approvals: only two of three may win.
  const cup=await service.create(owner,{...baseline,tieBreakOrder:[...baseline.tieBreakOrder]});
  await service.changeState(owner,cup.id,{action:"OPEN_REGISTRATION"});
  for(let i=0;i<3;i++)await service.apply(managerIds[i]!,cup.id,{teamId:teams[i]!});
  const decisions=await Promise.allSettled(teams.map((teamId,i)=>service.decideRegistration(
    owner,cup.id,teamId,{status:"ACCEPTED",seed:i+1},
  )));
  assert.equal(decisions.filter(x=>x.status==="fulfilled").length,2,
    "Only two concurrent approvals may fill a two-team competition.");
  assert.equal(decisions.filter(x=>x.status==="rejected"&&
    (x.reason as {code?:string}).code==="COMPETITION_FULL").length,1,
    "The final simultaneous approval must fail with COMPETITION_FULL.");
  const count1=await one("select count(*)::int as n from competition_teams where competition_id=$1 and status='ACCEPTED'",[cup.id]);
  assert.equal(count1.n,2);

  // Shrink and last-slot acceptance race on the SAME competition row lock.
  const shrinkCup=await service.create(owner,{...baseline,name:"Capacity shrink "+stamp,
    tieBreakOrder:[...baseline.tieBreakOrder],maxTeams:3});
  await service.changeState(owner,shrinkCup.id,{action:"OPEN_REGISTRATION"});
  for(let i=0;i<3;i++)await service.apply(managerIds[i]!,shrinkCup.id,{teamId:teams[i]!});
  for(let i=0;i<2;i++)await service.decideRegistration(owner,shrinkCup.id,teams[i]!,
    {status:"ACCEPTED",seed:i+1});
  const raced=await Promise.allSettled([
    service.update(owner,shrinkCup.id,{maxTeams:2}),
    service.decideRegistration(owner,shrinkCup.id,teams[2]!,{status:"ACCEPTED",seed:3}),
  ]);
  assert.equal(raced.filter(x=>x.status==="fulfilled").length,1,
    "A concurrent capacity shrink and final approval cannot both commit.");
  const stored=await one("select max_teams from competitions where id=$1",[shrinkCup.id]);
  const accepted=await one("select count(*)::int as n from competition_teams where competition_id=$1 and status='ACCEPTED'",[shrinkCup.id]);
  assert.ok(accepted.n<=stored.max_teams,"Accepted teams must not exceed the persisted team limit.");

  // Publicly exposed photos must not use the latest PRIVATE photo as a cover.
  await q("insert into social_posts(entity_type,entity_id,created_by_user_id,body,image_url,visibility,status,published_at) values('COMPETITION',$1,$2,'Public photo','https://example.com/qa7-public.jpg','PUBLIC','PUBLISHED',now()-interval '1 hour'),('COMPETITION',$1,$2,'Private photo','https://example.com/qa7-private.jpg','PRIVATE','PUBLISHED',now())",[cup.id,owner]);
  const publicPosts=await service.listPublicMedia(cup.id);
  assert.equal(publicPosts.posts.length,1);
  assert.ok(publicPosts.posts[0]?.imageUrl?.includes("qa7-public"));
  const ownerPosts=await service.listOwnerMedia(owner,cup.id);
  assert.equal(ownerPosts.posts.length,2);
  const list=await repository.listPublicCompetitions();
  assert.equal(list.find(x=>x.id===cup.id)?.coverImageUrl,"https://example.com/qa7-public.jpg");
  const discovery=await service.discoverPublic(competitionDiscoveryQuerySchema.parse({
    q:stamp,scope:"all",page:1,limit:12,
  }));
  assert.equal(discovery.competitions.find(x=>x.id===cup.id)?.coverImageUrl,
    "https://example.com/qa7-public.jpg");
  const managerCompetitions=await service.listMyPublic(managerIds[0]!);
  assert.ok(managerCompetitions.competitions.some(x=>x.id===cup.id),
    "Team manager must see My Competitions without a separate membership row.");
  await q("update competition_teams set fee_payment_reference='CI7_PRIVATE_REFERENCE',fee_status='PAID' where competition_id=$1",[cup.id]);
  assert.ok(!JSON.stringify(await service.getPublic(cup.id)).includes("CI7_PRIVATE_REFERENCE"),
    "Public competition response must redact payment references.");
  console.log("Phase 7 PostgreSQL passed: last-slot race, atomic limit reduction, private photo isolation, manager inclusion, fee redaction.");
}finally{
  await pool.end();
}
