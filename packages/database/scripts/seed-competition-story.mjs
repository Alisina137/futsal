/** Opt-in QA fixture: three tournaments plus player/manager dashboard data. */
import path from "node:path";
import {fileURLToPath} from "node:url";
import dotenv from "dotenv";
import pg from "pg";
dotenv.config({path:path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../../.env")});
if(!process.argv.includes("--confirm"))throw Error("Use --confirm only against a development database.");
if(process.env.NODE_ENV==="production")throw Error("Refusing production seeding.");
const url=process.env.DATABASE_DIRECT_URL||process.env.DATABASE_URL;
if(!url)throw Error("Missing database connection environment variable.");
const parsed=new URL(url);
if(["require","prefer","verify-ca"].includes(parsed.searchParams.get("sslmode")))parsed.searchParams.set("sslmode","verify-full");
const pool=new pg.Pool({connectionString:parsed.toString()});
const db=await pool.connect();
const q=async(s,v=[])=> (await db.query(s,v)).rows;
const get=async(s,v=[])=> (await q(s,v))[0];
const guard=(b,msg)=>{if(!b)throw Error(msg);};
const TAG="[QA-COMP-STORY-V1]";
const names=[
 ["QA Story Premier League","LEAGUE",15,105],
 ["QA Story Groups and Knockout Cup","GROUP_KNOCKOUT",12,19],
 ["QA Story Knockout Championship","KNOCKOUT",16,15]
];
const dateAt=(base,days,hour,minute=0)=>{
 const d=new Date(base.getTime()+days*86400000);d.setUTCHours(hour,minute,0,0);return d;
};
const score=(a,b,r)=>[1+(a*13+b*7+r*5)%6,1+(a*3+b*11+r*2)%5];
const inArray=(i)=>"$"+i;
async function account(username){
 return get("select id from users where username_normalized=$1 and deleted_at is null",[username]);
}
async function target(){
 const users={};for(const n of ["alisina","mahdi","abdul"]){
  users[n]=await account(n);
  guard(users[n],"Missing role-demo account "+n+". Seed role-demo accounts first.");
 }
 const venueBy=async(n)=>get(
  "select v.id,v.name,v.owner_user_id,va.id as area_id from venues v "+
  "join venue_subscriptions s on s.venue_id=v.id "+
  "join venue_areas va on va.venue_id=v.id and va.active=true "+
  "where v.owner_user_id=$1 and v.status='ACTIVE' and "+
  "((s.status='ACTIVE' and s.active_until>now()) or (s.status='TRIAL' and s.trial_ends_at>now())) "+
  "limit 1",[users[n].id]);
 const teamBy=async(n)=>get(
  "select id,name,manager_user_id from teams "+
  "where manager_user_id=$1 and status='ACTIVE' and offline_venue_id is null limit 1",[users[n].id]);
 // Prefer the requested owners, but use actual DB ownership. Do not swap roles.
 const venue=await venueBy("alisina")||await venueBy("mahdi");
 const candidateTeams=[await teamBy("mahdi"),await teamBy("alisina")].filter(Boolean);
 guard(venue&&candidateTeams.length>0,
  "Cannot find an active subscribed venue and managed team for Alisina or Mahdi.");
 // A team already containing Abdul takes priority. Previously we selected
 // Mahdi's team without checking Abdul's membership, causing an unnecessary rollback.
 const hasAbdul=async(team)=>Boolean(await get(
  "select 1 from team_memberships where team_id=$1 and user_id=$2 and status='ACTIVE' and role='PLAYER'",
  [team.id,users.abdul.id]));
 let team=null;
 for(const candidate of candidateTeams){
  if(await hasAbdul(candidate)){team=candidate;break;}
 }
 team=team||candidateTeams[0];
 if(!await hasAbdul(team)){
  // The explicit QA story asks to populate Abdul's player dashboard.
  // Create a new membership only when it does not overwrite a previous
  // rejection/departure or create a referee/paid-owner role conflict.
  const before=await get(
   "select status,role from team_memberships where team_id=$1 and user_id=$2",
   [team.id,users.abdul.id]);
  guard(!before,
   "Abdul has an existing inactive/non-player membership on "+team.name+
   ". Refusing to reactivate or overwrite it.");
  const eligibility=await get(
   "select (u.status='ACTIVE' and exists(select 1 from user_roles ur where ur.user_id=u.id and ur.role='PLAYER') "+
   "and not exists(select 1 from user_roles ur where ur.user_id=u.id and ur.role in ('REFEREE','TEAM_MANAGER','VENUE_OWNER','PLATFORM_ADMIN')) "+
   "and not exists(select 1 from venue_referees vr where vr.user_id=u.id)) as eligible "+
   "from users u where u.id=$1",[users.abdul.id]);
  guard(eligibility?.eligible,
   "Abdul is not an eligible active Player; refusing to create a test membership or change his roles.");
  await q(
   "insert into team_memberships(team_id,user_id,role,shirt_number,status,joined_at,updated_at) "+
   "values($1,$2,'PLAYER',7,'ACTIVE',now(),now()) on conflict do nothing",
   [team.id,users.abdul.id]);
  guard(await hasAbdul(team),"Could not establish Abdul's active QA Player membership.");
  console.log("Created the missing test-only Player membership for Abdul in "+team.name+".");
 }
 console.log("Seeding "+venue.name+" (owner="+(venue.owner_user_id===users.alisina.id?"alisina":"mahdi")+
   ") and team "+team.name+" (manager="+(team.manager_user_id===users.mahdi.id?"mahdi":"alisina")+")");
 const official=await get("select user_id from venue_referees where venue_id=$1 order by assigned_at limit 1",[venue.id]);
 return {users,venue,team,refereeId:official?.user_id??null};
}
async function participants(ctx){
 const ids=[ctx.team.id];
 for(let i=1;i<=15;i++){
  const name="QA Story Offline Team "+String(i).padStart(2,"0");
  let t=await get("select id,manager_user_id,claimed_at from teams where name=$1 and offline_venue_id=$2",
   [name,ctx.venue.id]);
  if(!t)t=await get(
   "insert into teams(name,city,manager_user_id,offline_venue_id,status,privacy,created_at,updated_at) "+
   "values($1,'Kabul',$2,$3,'ACTIVE','PUBLIC',now(),now()) returning id",
   [name,ctx.venue.owner_user_id,ctx.venue.id]);
  guard(t.manager_user_id===undefined||
   (t.manager_user_id===ctx.venue.owner_user_id&&!t.claimed_at),
   "Refusing to reuse changed offline team "+name);
  ids.push(t.id);
 }
 return ids;
}
async function sampleAthletes(ctx,teams){
 // Purpose-built non-login performers make leaderboards realistic without
 // giving extra active user accounts or changing any paid team-manager roles.
 const athleteIds=new Map();
 for(let i=1;i<teams.length;i++){
  const display="QA Story Athlete "+String(i).padStart(2,"0");
  let player=await get("select id,status,username_normalized,email_normalized from users where display_name=$1 and bio=$2",
   [display,TAG]);
  if(player){
   guard(player.status==="SUSPENDED"&&!player.username_normalized&&!player.email_normalized,
    "Fixture athlete has become a login account: "+display);
  }else{
   player=await get(
    "insert into users(display_name,username,username_normalized,phone_e164,email_normalized,"+
    "password_hash,preferred_language,status,bio,city) "+
    "values($1,null,null,null,null,'!DISABLED_QA_NO_LOGIN','en','SUSPENDED',$2,'Kabul') returning id",
    [display,TAG]);
  }
  athleteIds.set(teams[i],player.id);
  await q("insert into player_profiles(user_id,public_display_name,position,visibility) "+
   "values($1,$2,'ALA','PUBLIC') on conflict do nothing",[player.id,display]);
  await q("insert into team_memberships(team_id,user_id,role,status,shirt_number,joined_at,updated_at) "+
   "values($1,$2,'PLAYER','ACTIVE',$3,now(),now()) on conflict(team_id,user_id) do nothing",
   [teams[i],player.id,10+i]);
 }
 return athleteIds;
}
async function sampleSquad(ctx){
 const ids=[ctx.users.abdul.id];
 const positions=["FIXO","ALA","PIVO","GOALKEEPER","ALA","FIXO","PIVO"];
 for(let i=1;i<=7;i++){
  const display="QA Story Squadmate "+String(i).padStart(2,"0");
  let person=await get("select id,status,username_normalized,email_normalized from users "+
   "where display_name=$1 and bio=$2",[display,TAG]);
  if(person){
   guard(person.status==="SUSPENDED"&&!person.username_normalized&&!person.email_normalized,
    "Claimed or active fixture identity: "+display);
  }else{
   person=await get(
    "insert into users(display_name,username,username_normalized,email_normalized,phone_e164,"+
    "password_hash,preferred_language,status,bio,city) "+
    "values($1,null,null,null,null,'!DISABLED_QA_NO_LOGIN','en','SUSPENDED',$2,'Kabul') returning id",
    [display,TAG]);
  }
  ids.push(person.id);
  await q("insert into player_profiles(user_id,public_display_name,position,visibility) "+
   "values($1,$2,$3::player_position,'PUBLIC') on conflict do nothing",
   [person.id,display,positions[i-1]]);
  await q("insert into team_memberships(team_id,user_id,role,status,shirt_number,joined_at,updated_at) "+
   "values($1,$2,'PLAYER','ACTIVE',$3,now(),now()) on conflict(team_id,user_id) do nothing",
   [ctx.team.id,person.id,30+i]);
 }
 return ids;
}
async function createCompetition(ctx,cfg,now){
 const [name,format,count]=cfg;
 const prev=await get("select id,format,max_teams,description from competitions where venue_id=$1 and name=$2",
  [ctx.venue.id,name]);
 if(prev){
  guard(prev.description?.startsWith(TAG)&&prev.format===format&&prev.max_teams===count,
   "Existing competition collides with fixture "+name);
  return [prev.id,true];
 }
 const league=format==="LEAGUE";
 const start=dateAt(now,league?-21:-15,11);
 const end=dateAt(now,league?105:70,20);
 const rewards=[
  {category:"TEAM",title:"Champion",prize:"Demo trophy",description:"Simulation only"},
  {category:"TEAM",title:"Runner Up",prize:"Demo silver medals",description:"Simulation only"},
  {category:"INDIVIDUAL",title:"Top Scorer",prize:"Demo Golden Boot",description:null},
  {category:"INDIVIDUAL",title:"MVP",prize:"Demo best player award",description:null}
 ];
 const created=await get(
  "insert into competitions(venue_id,created_by_user_id,name,description,format,status,published,max_teams,"+
  "registration_fee_afn,win_points,draw_points,loss_points,tie_break_order,rewards,"+
  "group_count,qualifiers_per_group,match_duration_minutes,registration_closes_at,starts_at,ends_at,"+
  "published_at,material_play_started_at,created_at,updated_at) "+
  "values($1,$2,$3,$4,$5::competition_format,'IN_PROGRESS',true,$6,0,3,1,0,$7::jsonb,$8::jsonb,"+
  "$9,$10,60,$11,$12,$13,now(),$14,now(),now()) returning id",
  [ctx.venue.id,ctx.venue.owner_user_id,name,TAG+" Authentic-looking demo fixtures and results",
   format,count,JSON.stringify(["POINTS","GOAL_DIFFERENCE","GOALS_FOR"]),
   JSON.stringify(rewards),format==="GROUP_KNOCKOUT"?4:null,format==="GROUP_KNOCKOUT"?2:null,
   dateAt(start,-5,12),start,end,start]);
 return [created.id,false];
}
async function register(ctx,cid,teamIds,groupIds=null){
 for(let i=0;i<teamIds.length;i++){
  await q(
   "insert into competition_teams(competition_id,team_id,status,seed,group_id,fee_status,applied_by_user_id,"+
   "responded_by_user_id,responded_at,created_at,updated_at) "+
   "values($1,$2,'ACCEPTED',$3,$4,'WAIVED',$5,$5,now(),now(),now()) on conflict do nothing",
   [cid,teamIds[i],i+1,groupIds?groupIds[Math.floor(i/3)]:null,ctx.venue.owner_user_id]);
 }
 for(const playerId of ctx.squad){
  await q("insert into team_competition_roster(competition_id,team_id,user_id) "+
   "values($1,$2,$3) on conflict do nothing",[cid,ctx.team.id,playerId]);
 }
}
async function match(ctx,cid,stage,round,slot,home,away,when,completed=false,group=null,scores=[null,null]){
 const [hs,as]=scores,win=completed&&hs!==as?(hs>as?home:away):null;
 const inserted=await get(
  "insert into competition_matches(competition_id,group_id,stage,round_number,slot_number,"+
  "home_team_id,away_team_id,venue_id,area_id,starts_at,ends_at,status,home_score,away_score,"+
  "winner_team_id,referee_user_id,result_entered_by_user_id,result_entered_at,created_at,updated_at) "+
  "values($1,$2,$3::competition_match_stage,$4,$5,$6,$7,$8,$9,$10,$11,$12::competition_match_status,"+
  "$13,$14,$15,$16,$17,$18,now(),now()) returning id",
  [cid,group,stage,round,slot,home,away,ctx.venue.id,ctx.venue.area_id,when,
   new Date(when.getTime()+60*60000),completed?"COMPLETED":"SCHEDULED",
   hs,as,win,ctx.refereeId,completed?ctx.venue.owner_user_id:null,completed?when:null]);
 if(ctx.refereeId&&home&&away){
  await q("insert into referee_match_responses(match_id,referee_user_id,status,responded_at,updated_at) "+
   "values($1,$2,$3,$4,now()) on conflict do nothing",
   [inserted.id,ctx.refereeId,completed?"ACCEPTED":"PENDING",completed?when:null]);
 }
 if(home===ctx.team.id||away===ctx.team.id){
  await q(
   "insert into team_match_lineups(match_id,team_id,starters,substitutes,captain_user_id,updated_at) "+
   "values($1,$2,$3::jsonb,$4::jsonb,$5,now()) on conflict do nothing",
   [inserted.id,ctx.team.id,JSON.stringify(ctx.squad.slice(0,5)),
    JSON.stringify(ctx.squad.slice(5)),ctx.users.abdul.id]);
  if(completed){
   const own=home===ctx.team.id?hs:as,conceded=home===ctx.team.id?as:hs;
   const goals=Math.min(own,round%3===0?2:1),assists=Math.min(own-goals,round%2?0:1);
   await q("insert into player_match_stats(match_id,player_user_id,team_id,appeared,goals,assists,"+
    "yellow_cards,red_cards,clean_sheet,player_of_match) "+
    "values($1,$2,$3,true,$4,$5,$6,0,$7,$8) on conflict do nothing",
    [inserted.id,ctx.users.abdul.id,ctx.team.id,goals,assists,
     round%3===0?1:0,conceded===0,own>conceded&&goals>0]);
   let remaining=Math.max(0,own-goals);
   for(let p=1;p<=4;p++){
    const scored=Math.min(remaining,p===1?2:1);
    remaining-=scored;
    await q("insert into player_match_stats(match_id,player_user_id,team_id,appeared,goals,assists,"+
     "yellow_cards,red_cards,clean_sheet,player_of_match) "+
     "values($1,$2,$3,true,$4,$5,$6,0,$7,false) on conflict do nothing",
     [inserted.id,ctx.squad[p],ctx.team.id,scored,p===2&&goals>0?1:0,p===4&&round%4===0?1:0,
      conceded===0]);
   }
  }
 }
 if(completed&&ctx.athletes){
  // One registered simulated scorer per offline team. The remaining score
  // is deliberately uncredited rather than inventing impossible goal totals.
  for(const [team,own,against] of [[home,hs,as],[away,as,hs]]){
   const athlete=ctx.athletes.get(team);
   if(!athlete)continue;
   const goals=Math.min(own,2),assists=Math.min(Math.max(own-goals,0),1);
   await q("insert into player_match_stats(match_id,player_user_id,team_id,appeared,goals,assists,"+
    "yellow_cards,red_cards,clean_sheet,player_of_match) "+
    "values($1,$2,$3,true,$4,$5,$6,0,$7,$8) on conflict do nothing",
    [inserted.id,athlete,team,goals,assists,slot%7===0?1:0,against===0,own>against&&goals>0]);
  }
 }
 return inserted.id;
}
function roundRobin(ids){
 const a=[...ids];if(a.length%2)a.push(null);
 const rows=[];
 for(let r=0;r<a.length-1;r++){
  let slot=0;
  for(let j=0;j<a.length/2;j++){
   const x=a[j],y=a[a.length-1-j];
   if(x&&y)rows.push([r+1,++slot,(r+j)%2?y:x,(r+j)%2?x:y]);
  }
  a.splice(1,0,a.pop());
 }
 return rows;
}
async function league(ctx,cid,ids,now){
 const rows=roundRobin(ids);guard(rows.length===105,"15-team league requires exactly 105 matches");
 for(const [round,slot,home,away] of rows){
  const played=round<=3;
  // Round 4 starts tomorrow and remains the current week's fixtures.
  const when=dateAt(now,(round-4)*7+1,8+Math.floor((slot-1)*1.5),((slot-1)%2)*30);
  await match(ctx,cid,"LEAGUE",round,slot,home,away,when,played,null,
   played?score(ids.indexOf(home)+1,ids.indexOf(away)+1,round):[null,null]);
 }
}
async function bracket(ctx,cid,first,now,offset,play=false){
 // Bracket rounds count down: 4->3->2->1 for 16 teams, 3->2->1 for 8 qualifiers.
 const n=first.length?4:3;
 const entries=first.length?first:Array(8).fill(null);
 const map=new Map();
 for(let r=n;r>=1;r--){
  const count=2**(r-1);
  for(let slot=1;slot<=count;slot++){
   const h=r===n?entries[(slot-1)*2]:null,a=r===n?entries[(slot-1)*2+1]:null;
   const done=play&&r===n&&slot<=4;
   const scheduledDay=play&&r===n&&slot>4?3:offset+(n-r)*15;
   const when=dateAt(now,scheduledDay,9+slot,0);
   const scores=done?(slot%2===0?[1,3]:[3,1]):[null,null];
   const id=await match(ctx,cid,"KNOCKOUT",r,slot,h,a,when,done,null,scores);
   map.set(r+":"+slot,{id,home:h,away:a,done,scores});
  }
 }
 for(let r=n;r>1;r--){
  for(let slot=1;slot<=2**(r-1);slot++){
   const child=map.get(r+":"+slot),parent=map.get((r-1)+":"+Math.ceil(slot/2));
   const side=slot%2?"HOME":"AWAY";
   await q("update competition_matches set next_match_id=$1,next_match_side=$2 where id=$3",
    [parent.id,side,child.id]);
   if(child.done&&child.scores[0]!==child.scores[1]){
    const winner=child.scores[0]>child.scores[1]?child.home:child.away;
    await q("update competition_matches set "+(side==="HOME"?"home_team_id":"away_team_id")+"=$1 where id=$2",
     [winner,parent.id]);
   }
  }
 }
}
async function grouped(ctx,cid,ids,now){
 const groups=[];
 for(let g=0;g<4;g++){
  const row=await get("insert into competition_groups(competition_id,name,sort_order) "+
   "values($1,$2,$3) returning id",[cid,"Group "+String.fromCharCode(65+g),g+1]);
  groups.push(row.id);
 }
 await register(ctx,cid,ids,groups);
 const pairs=[[0,1],[1,2],[0,2]];
 for(let g=0;g<4;g++){
  const members=ids.slice(g*3,g*3+3);
  for(let r=0;r<3;r++){
   const [a,b]=pairs[r],done=r<2;
   const when=dateAt(now,-12+r*8,12+g*2);
   await match(ctx,cid,"GROUP",r+1,1,members[a],members[b],when,done,groups[g],
    done?score(g+1,r+1,2):[null,null]);
  }
 }
 // Qualifier slots are deliberately TBD until final group round.
 await bracket(ctx,cid,[],now,18,false);
}
async function knockout(ctx,cid,ids,now){
 await register(ctx,cid,ids);
 const paired=[];
 for(let j=0;j<8;j++)paired.push(ids[j],ids[15-j]);
 await bracket(ctx,cid,paired,now,-4,true);
}
async function dashboard(ctx,ids,offline,now){
 const manager=ctx.team.manager_user_id,player=ctx.users.abdul.id,teamId=ctx.team.id;
 await q("insert into player_profiles(user_id,public_display_name,position,visibility) "+
  "values($1,'Abdul','ALA','PUBLIC') on conflict do nothing",[player]);
 await q("insert into team_manager_profiles(team_id,province,district,description,founded_on,"+
  "primary_color,secondary_color,home_venue_id,allow_join_requests) "+
  "values($1,'Kabul','Kabul',$2,'2023-02-01','#186F9F','#F3B543',$3,true) on conflict do nothing",
  [teamId,TAG+" Demo practice, matches, leagues, scouting and public team information",ctx.venue.id]);
 await q("insert into player_dashboard_preferences(user_id,default_team_id,biography,province,district,"+
  "secondary_position,preferred_foot) values($1,$2,$3,'Kabul','Kabul','PIVO','RIGHT') on conflict do nothing",
  [player,teamId,TAG+" Competitive winger and playmaker with multiple match performances"]);
 for(let i=1;i<=3;i++){
  const name="QA Story Reserve Player "+i;
  const old=await get("select id from team_guest_players where team_id=$1 and name=$2",[teamId,name]);
  if(!old)await q("insert into team_guest_players(team_id,name,position,shirt_number) "+
   "values($1,$2,$3,$4)",[teamId,name,i===3?"GOALKEEPER":"ALA",19+i]);
 }
 for(const [title,body] of [
  ["QA Story Week 4 Briefing","Training and match preparation for week four."],
  ["QA Story Cup Update","We are registered in both the groups cup and knockout championship."]
 ]){
  const old=await get("select id from team_announcements where team_id=$1 and title=$2",[teamId,title]);
  if(!old)await q("insert into team_announcements(team_id,author_id,title,body) values($1,$2,$3,$4)",
   [teamId,manager,title,body]);
 }
 for(const [i,kind,title,day] of [
  [0,"TRAINING","QA Story Weekly Training",2],
  [1,"MEETING","QA Story Match Tactics",3],
  [2,"TRAINING","QA Story Fitness Training",7]
 ]){
  let event=await get("select id from team_activities where team_id=$1 and title=$2",[teamId,title]);
  if(!event)event=await get("insert into team_activities(team_id,kind,title,notes,location,starts_at,ends_at) "+
   "values($1,$2,$3,$4,$5,$6,$7) returning id",
   [teamId,kind,title,TAG+" Practice and attendance testing",ctx.venue.name,
    dateAt(now,day,13+i),dateAt(now,day,14+i)]);
  await q("insert into team_activity_responses(activity_id,user_id,availability) "+
   "values($1,$2,'AVAILABLE') on conflict do nothing",[event.id,player]);
 }
 for(const cid of ids){
  const body=TAG+" Upcoming fixtures, previous results and player performance reports.";
  const prev=await get("select id from social_posts where entity_type='COMPETITION' and entity_id=$1 and body=$2",
   [cid,body]);
  if(!prev)await q("insert into social_posts(entity_type,entity_id,created_by_user_id,body,status) "+
   "values('COMPETITION',$1,$2,$3,'PUBLISHED')",[cid,ctx.venue.owner_user_id,body]);
  await q("insert into social_follows(user_id,entity_type,entity_id) "+
   "values($1,'COMPETITION',$2) on conflict do nothing",[player,cid]);
 }
 const post=TAG+" League week 4 is here! Player stats, matches and training are up to date.";
 if(!await get("select id from social_posts where entity_type='TEAM' and entity_id=$1 and body=$2",
  [teamId,post]))await q("insert into social_posts(entity_type,entity_id,created_by_user_id,body,status) "+
  "values('TEAM',$1,$2,$3,'PUBLISHED')",[teamId,manager,post]);
 const notificationRows=[
  [player,"COMPETITION_UPDATE","Premier League week 4","Previous results and standings are ready",
   "/competitions/"+ids[0],{competitionId:ids[0]},"abdul-league"],
  [player,"COMPETITION_UPDATE","Groups Cup draw","Four groups and fixtures are now available",
   "/competitions/"+ids[1],{competitionId:ids[1]},"abdul-group"],
  [player,"COMPETITION_UPDATE","Knockout results","The first knockout winners have progressed",
   "/competitions/"+ids[2],{competitionId:ids[2]},"abdul-ko"],
  [player,"TEAM_ACTIVITY","Training available","Confirm your participation in this week's practice",
   "/teams/"+teamId+"/activities",{teamId},"abdul-training"],
  [manager,"TEAM_ANNOUNCEMENT","Week 4 briefing","Your team announcements and player attendance are updated",
   "/dashboard",{teamId},"manager-announcement"],
  [manager,"TEAM_CHALLENGE","Friendly challenge accepted","Your upcoming friendly has been confirmed",
   "/dashboard",{teamId},"manager-friendly"]
 ];
 for(const [user,type,title,body,link,data,key] of notificationRows){
  await q("insert into notifications(user_id,type,title,body,deep_link,data,dedupe_key,created_at) "+
   "values($1,$2::notification_type,$3,$4,$5,$6::jsonb,$7,now()) on conflict(user_id,dedupe_key) do nothing",
   [user,type,title,body,link,JSON.stringify({...data,qaMarker:TAG}),"qa-story-v1:"+key]);
 }
 const rival=offline[1],msg=TAG+" Accepted demo friendly for calendar and growth views";
 if(!await get("select id from team_friendly_challenges where from_team_id=$1 and to_team_id=$2 and message=$3",
  [teamId,rival,msg]))await q("insert into team_friendly_challenges"+
  "(from_team_id,to_team_id,proposed_at,venue_name,message,status,responded_at) "+
  "values($1,$2,$3,$4,$5,'ACCEPTED',now())",
  [teamId,rival,dateAt(now,5,14),ctx.venue.name,msg]);
}
async function verify(ctx,ids){
 for(let i=0;i<3;i++){
  const c=await get("select format,status,max_teams,published from competitions where id=$1",[ids[i]]);
  guard(c?.format===names[i][1]&&c.status==="IN_PROGRESS"&&c.max_teams===names[i][2]&&c.published,
   "Competition config mismatch "+names[i][0]);
  const count=await get("select count(*)::int as teams from competition_teams where competition_id=$1 and status='ACCEPTED'",[ids[i]]);
  const matches=await get("select count(*)::int as games,count(*) filter(where status='COMPLETED')::int as played "+
   "from competition_matches where competition_id=$1",[ids[i]]);
  guard(count.teams===names[i][2]&&matches.games===names[i][3],"Incomplete fixture "+names[i][0]);
  guard(matches.played===[21,8,4][i],"Completed results mismatch for "+names[i][0]);
  if(i===0){
   const week4=await get("select count(*)::int as total from competition_matches "+
    "where competition_id=$1 and stage='LEAGUE' and round_number=4 and status='SCHEDULED'",[ids[i]]);
   guard(week4.total===7,"League must display seven week-four upcoming fixtures.");
  }
  if(i===1){
   const groups=await get("select count(*)::int as total from competition_groups where competition_id=$1",[ids[i]]);
   guard(groups.total===4,"Group cup must have four groups.");
  }
  if(i===2){
   const progress=await get("select count(*)::int as wins from competition_matches "+
    "where competition_id=$1 and stage='KNOCKOUT' and winner_team_id is not null",[ids[i]]);
   guard(progress.wins===4,"Four knockout first-round winners must advance.");
  }
  console.log(names[i][0]+": "+count.teams+" teams; "+matches.games+" fixtures; "+matches.played+" completed");
 }
 const stats=await get("select count(*)::int as games,sum(s.goals)::int as goals from player_match_stats s "+
  "join competition_matches m on m.id=s.match_id where s.player_user_id=$1 and m.competition_id=any($2::uuid[])",
  [ctx.users.abdul.id,ids]);
 guard(stats.games>=2,"Abdul must have played multiple games.");
 const leaderboard=await get("select count(distinct s.player_user_id)::int as athletes "+
  "from player_match_stats s join competition_matches m on m.id=s.match_id "+
  "where m.competition_id=$1",[ids[0]]);
 guard(leaderboard.athletes>=10,"League leaderboard should include at least ten players.");
 const notices=await get("select count(*)::int as total from notifications "+
  "where user_id=any($1::uuid[]) and dedupe_key like 'qa-story-v1:%'",
  [[ctx.users.abdul.id,ctx.team.manager_user_id]]);
 guard(notices.total>=6,"Sample player and manager notifications are missing.");
 console.log("Abdul: "+stats.games+" matches, "+stats.goals+" goals, plus schedule, lineup, RSVP and career records.");
}
try{
 await db.query("begin");
 await q("select pg_advisory_xact_lock(hashtext('futsal-qa-story-v1'))");
 const now=new Date(),ctx=await target(),all=await participants(ctx),ids=[];
 ctx.athletes=await sampleAthletes(ctx,all);
 ctx.squad=await sampleSquad(ctx);
 // Idempotent: no partial existing tournament set, and existing full seed is checked not overwritten.
 const exists=[];
 for(const cfg of names){
  exists.push(await get("select id from competitions where venue_id=$1 and name=$2",
   [ctx.venue.id,cfg[0]]));
 }
 guard(!exists.some(Boolean)||exists.every(Boolean),"Incomplete previous QA story set; refusing partial reseed.");
 for(let i=0;i<names.length;i++){
  const cfg=names[i],[cid,prior]=await createCompetition(ctx,cfg,now);ids.push(cid);
  if(prior)continue;
  if(i===0){await register(ctx,cid,all.slice(0,15));await league(ctx,cid,all.slice(0,15),now);}
  if(i===1)await grouped(ctx,cid,all.slice(0,12),now);
  if(i===2)await knockout(ctx,cid,all.slice(0,16),now);
 }
 await dashboard(ctx,ids,all,now);
 await verify(ctx,ids);
 await db.query("commit");
 console.log("QA story committed. No account roles, usernames, credentials, or paid subscriptions changed.");
}catch(e){
 await db.query("rollback");console.error("QA story rolled back:",e.message);process.exitCode=1;
}finally{db.release();await pool.end();}
