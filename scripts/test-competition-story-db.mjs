/**
 * Postgres integration smoke test of QA competition seeding, including the
 * formerly failing case where Abdul exists but has no team membership.
 * Runs only in the disposable futsal_ci GitHub Actions database.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const {Pool}=createRequire(new URL("../packages/database/package.json",import.meta.url))("pg");
const dbUrl=process.env.DATABASE_URL||"";
const parsed=dbUrl?new URL(dbUrl):null;
if(process.env.CI!=="true"||parsed?.pathname!=="/futsal_ci"||
  !["127.0.0.1","localhost"].includes(parsed?.hostname)){
 throw Error("Refusing to run QA seed DB smoke test outside disposable local futsal_ci database in CI.");
}
const pool=new Pool({connectionString:dbUrl});
const q=async(sql,values=[])=> (await pool.query(sql,values)).rows;
const first=async(sql,values=[])=> (await q(sql,values))[0];
try{
 const accounts={};
 for(const username of ["alisina","mahdi","abdul"]){
  const row=await first(
   "insert into users(display_name,username,username_normalized,email_normalized,email_verified_at,"+
   "password_hash,preferred_language,status,city) "+
   "values($1,$2,$2,$3,now(),'!CI_NO_LOGIN','en','ACTIVE','Kabul') returning id",
   ["CI "+username,username,username+"@futsal.test"]);
  accounts[username]=row.id;
 }
 await q("insert into user_roles(user_id,role) values($1,'VENUE_OWNER'),($2,'TEAM_MANAGER'),($3,'PLAYER')",
  [accounts.mahdi,accounts.alisina,accounts.abdul]);
 for(const [username,role,price] of [["mahdi","VENUE_OWNER",1000],["alisina","TEAM_MANAGER",300]]){
  await q(
   "insert into role_subscriptions(user_id,role,status,monthly_price_afn,active_until,activated_at) "+
   "values($1,$2::user_role,'ACTIVE',$3,now()+interval '1 year',now())",
   [accounts[username],role,price]);
 }
 const venue=await first(
  "insert into venues(owner_user_id,name,public_phone,province,city,address,timezone,booking_mode,"+
  "status,verification_status,verified_at,setup_completed_at) "+
  "values($1,'CI Mahdi Arena','0000000000','Kabul','Kabul','CI-only venue','Asia/Kabul',"+
  "'INSTANT','ACTIVE','VERIFIED',now(),now()) returning id",[accounts.mahdi]);
 await q(
  "insert into venue_subscriptions(venue_id,status,active_until) "+
  "values($1,'ACTIVE',now()+interval '1 year')",[venue.id]);
 await q(
  "insert into venue_areas(venue_id,name,default_session_duration_minutes,base_price_afn,active) "+
  "values($1,'Main Court',90,1000,true)",[venue.id]);
 const team=await first(
  "insert into teams(name,city,manager_user_id,status,privacy) "+
  "values('CI Alisina United','Kabul',$1,'ACTIVE','PUBLIC') returning id",
  [accounts.alisina]);

 // Regression: Abdul exists on Alisina's team but was previously REMOVED,
 // which caused the real user's run to roll back before creating competitions.
 await q("insert into team_memberships(team_id,user_id,role,shirt_number,status,joined_at,left_at) "+
  "values($1,$2,'PLAYER',7,'REMOVED',now()-interval '30 days',now()-interval '1 day')",
  [team.id,accounts.abdul]);
 const script=path.join(root,"packages/database/scripts/seed-competition-story.mjs");
 let refused=false;
 try{
  execFileSync(process.execPath,[script,"--confirm"],{
   cwd:root,env:{...process.env,NODE_ENV:"test"},encoding:"utf8",timeout:90000,
   stdio:"pipe",
  });
 }catch(error){
  refused=true;
  assert.ok(String(error.stderr).includes("--restore-abdul-membership"),
   "Must tell operator how to explicitly restore the removed Player record.");
 }
 assert.ok(refused,"Removed membership must not be overwritten without opt-in.");
 const rolledBack=await first(
  "select count(*)::int as n from competitions where venue_id=$1",[venue.id]);
 assert.equal(rolledBack.n,0,"Failed seed must leave no competitions.");
 const stillRemoved=await first(
  "select role,status,left_at from team_memberships where team_id=$1 and user_id=$2",
  [team.id,accounts.abdul]);
 assert.equal(stillRemoved.status,"REMOVED");
 assert.ok(stillRemoved.left_at,"Refused seed must preserve member departure date.");

 for(let run=1;run<=2;run++){
  const flags=run===1?["--confirm","--restore-abdul-membership"]:["--confirm"];
  const stdout=execFileSync(process.execPath,[script,...flags],{
   cwd:root,env:{...process.env,NODE_ENV:"test"},
   encoding:"utf8",timeout:90000,
  });
  assert.ok(stdout.includes("QA story committed"),"The seeder must commit successfully.");
  if(run===1)assert.ok(stdout.includes("Explicitly restored Abdul's REMOVED membership"),
   "Seeder must explicitly log its opt-in restoration.");
 }

 const membershipAfter=await first(
  "select role,status,left_at from team_memberships where team_id=$1 and user_id=$2",
  [team.id,accounts.abdul]);
 assert.equal(membershipAfter.role,"PLAYER");
 assert.equal(membershipAfter.status,"ACTIVE");
 assert.equal(membershipAfter.left_at,null);
 const comps=await q(
  "select name,format,max_teams from competitions where venue_id=$1 and description like '[QA-COMP-STORY-V1]%' "+
  "order by name",[venue.id]);
 assert.equal(comps.length,3);
 assert.deepEqual(comps.map(c=>c.max_teams).sort((a,b)=>a-b),[12,15,16]);
 const counts=await q(
  "select c.format,count(m.id)::int as games,count(m.id) filter(where m.status='COMPLETED')::int as played "+
  "from competitions c join competition_matches m on m.competition_id=c.id "+
  "where c.venue_id=$1 group by c.format",[venue.id]);
 const league=counts.find(c=>c.format==="LEAGUE");
 const groups=counts.find(c=>c.format==="GROUP_KNOCKOUT");
 const knockout=counts.find(c=>c.format==="KNOCKOUT");
 assert.deepEqual([league.games,league.played],[105,21]);
 assert.deepEqual([groups.games,groups.played],[19,8]);
 assert.deepEqual([knockout.games,knockout.played],[15,4]);
 const scoreRows=await first(
  "select count(*)::int as n from player_match_stats where player_user_id=$1",[accounts.abdul]);
 assert.ok(scoreRows.n>=2,"Abdul must have official match stats.");
 const activities=await first("select count(*)::int as n from team_activities where team_id=$1",[team.id]);
 assert.ok(activities.n>=3,"Team Manager activity feed should be populated.");
 console.log("Competition DB smoke passed: REMOVED Abdul membership protected by default, explicitly restored; 3 competitions and stats idempotent.");
}finally{
 await pool.end();
}
