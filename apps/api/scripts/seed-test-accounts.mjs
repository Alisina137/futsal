/**
 * Local, opt-in, transactional QA account seeding. Never commits passwords.
 * pnpm db:seed:test-accounts seed --confirm
 * pnpm db:seed:test-accounts verify
 * pnpm db:seed:test-accounts cleanup --confirm --delete-test-accounts
 */
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
import dotenv from "dotenv";

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,"../../..");
dotenv.config({path:path.join(root,".env")});
const argon2=createRequire(import.meta.url)("argon2");
const {Pool}=createRequire(new URL("../../../packages/database/package.json",import.meta.url))("pg");
const marker="FUTSAL_QA_25_20261011";
const groups={NORMAL_USER:"ftn",TEAM_MANAGER:"ftt",VENUE_OWNER:"ftv",REFEREE:"ftr",PLAYER:"ftp"};
const mode=process.argv[2]||"seed";
function fail(message){throw new Error(message);}
if(!["seed","verify","cleanup"].includes(mode))fail("Expected seed, verify, or cleanup.");
if(mode!=="verify"&&!process.argv.includes("--confirm"))
  fail("Database changes require --confirm.");
if(mode==="cleanup"&&!process.argv.includes("--delete-test-accounts"))
  fail("Deletion also requires --delete-test-accounts.");
if(process.env.NODE_ENV==="production")
  fail("Refusing to run with NODE_ENV=production.");
const url=process.env.DATABASE_DIRECT_URL||process.env.DATABASE_URL;
if(!url)fail("Set DATABASE_DIRECT_URL or DATABASE_URL in your local .env.");
const csv=process.env.FUTSAL_TEST_ACCOUNTS_FILE
  ?path.resolve(process.env.FUTSAL_TEST_ACCOUNTS_FILE)
  :path.join(root,"test-accounts-private.csv");
if(!fs.existsSync(csv))fail("Missing "+csv+". Copy the private CSV download to your project root.");
const lines=fs.readFileSync(csv,"utf8").replace(/^\uFEFF/,"").trim().split(/\r?\n/);
if(lines.shift()!=="username,email,password,role")fail("Wrong CSV header.");
const records=lines.map(line=>{
 const row=line.split(",");
 if(row.length!==4)fail("Expected four CSV values, without commas.");
 const [username,email,password,role]=row;
 return {username,email,password,role};
});
if(records.length!==25)fail("Expected exactly 25 QA accounts.");
const counts=Object.fromEntries(Object.keys(groups).map(role=>[role,0]));
const seen=new Set();
for(const row of records){
 if(!groups[row.role]||!new RegExp("^"+groups[row.role]+"0[1-5]$").test(row.username))
   fail("Invalid QA username or group: "+row.username);
 if(row.email!==row.username+"@futsal.test")fail("Wrong QA email: "+row.username);
 if(row.password.length<16||!/[A-Z]/.test(row.password)||
    !/[0-9]/.test(row.password)||!/[^A-Za-z0-9]/.test(row.password))
   fail("Weak QA password: "+row.username);
 if(seen.has(row.username))fail("Duplicate QA username.");
 seen.add(row.username);
 counts[row.role]++;
}
if(Object.values(counts).some(n=>n!==5))fail("Need five of each role.");
const parsed=new URL(url);
if(["prefer","require","verify-ca"].includes(parsed.searchParams.get("sslmode")))
  parsed.searchParams.set("sslmode","verify-full");
const pool=new Pool({connectionString:parsed.toString()});
const client=await pool.connect();

async function schema(){
 for(const name of ["users","user_roles","role_subscriptions","venues","venue_areas","venue_subscriptions",
  "venue_referees","teams","team_memberships","player_profiles","email_verification_challenges"]){
  const {rows}=await client.query("select to_regclass($1) as name",["public."+name]);
  if(!rows[0]?.name)fail("Missing "+name+"; run pnpm db:migrate.");
 }
}
async function createAccounts(){
 const ids=new Map();
 for(const r of records){
  const result=await client.query(
   "select id,username_normalized,email_normalized,bio,password_hash from users where username_normalized=$1 or email_normalized=$2 for update",
   [r.username,r.email]);
  if(result.rows.length>1)fail("Collision with several users: "+r.username);
  const existing=result.rows[0];
  if(existing){
   if(existing.username_normalized!==r.username||existing.email_normalized!==r.email||existing.bio!==marker)
     fail("Refusing to alter an existing non-QA account: "+r.username);
   if(!await argon2.verify(existing.password_hash,r.password))
     fail("Password changed on existing QA account: "+r.username);
   await client.query("update users set email_verified_at=coalesce(email_verified_at,now()),status='ACTIVE',updated_at=now() where id=$1",[existing.id]);
   ids.set(r.username,existing.id);
  }else{
   const display=r.role==="NORMAL_USER"?"Normal User":r.role==="TEAM_MANAGER"?"Team Owner":
     r.role==="VENUE_OWNER"?"Venue Owner":r.role==="REFEREE"?"Referee":"Player";
   const hash=await argon2.hash(r.password);
   const row=await client.query(
    "insert into users (username,username_normalized,display_name,phone_e164,email_normalized,email_verified_at,password_hash,preferred_language,status,bio,city,created_at,updated_at) "+
    "values($1,$1,$2,null,$3,now(),$4,'en','ACTIVE',$5,'Kabul',now(),now()) returning id",
    [r.username,"QA "+display+" "+r.username.slice(-2),r.email,hash,marker]);
   ids.set(r.username,row.rows[0].id);
  }
 }
 return ids;
}
async function addRole(id,role){
 await client.query("insert into user_roles(user_id,role,assigned_at) values($1,$2::user_role,now()) on conflict do nothing",[id,role]);
}
async function paidRole(id,role){
 await addRole(id,role);
 await client.query(
  "insert into role_subscriptions(user_id,role,status,monthly_price_afn,requested_at,active_until,activated_at,payment_reference,updated_at) "+
  "values($1,$2::user_role,'ACTIVE',$3,now(),now()+interval '12 months',now(),$4,now()) "+
  "on conflict(user_id,role) do update set status='ACTIVE',monthly_price_afn=excluded.monthly_price_afn,"+
  "active_until=excluded.active_until,activated_at=excluded.activated_at,payment_reference=excluded.payment_reference,updated_at=now()",
  [id,role,role==="VENUE_OWNER"?1000:300,"QA-SEED-"+role+"-"+id]);
}
async function makeTeams(ids){
 const result=new Map();
 for(let i=1;i<=5;i++){
  const id=ids.get("ftt0"+i);
  await paidRole(id,"TEAM_MANAGER");
  const old=await client.query("select id from teams where manager_user_id=$1 limit 1",[id]);
  let teamId=old.rows[0]?.id;
  if(!teamId){
   const created=await client.query(
    "insert into teams(name,city,manager_user_id,status,privacy,created_at,updated_at) values($1,'Kabul',$2,'ACTIVE','PUBLIC',now(),now()) returning id",
    ["QA Futsal Team "+i,id]);
   teamId=created.rows[0].id;
  }
  result.set(i,teamId);
  await client.query(
   "insert into player_profiles(user_id,public_display_name,position,visibility,created_at,updated_at) "+
   "values($1,$2,'UNSPECIFIED','PUBLIC',now(),now()) on conflict(user_id) do nothing",
   [id,"QA Team Owner "+i]);
  await client.query(
   "insert into team_memberships(team_id,user_id,role,shirt_number,status,joined_at,updated_at) "+
   "values($1,$2,'MANAGER',10,'ACTIVE',now(),now()) on conflict(team_id,user_id) "+
   "do update set role='MANAGER',status='ACTIVE',left_at=null,updated_at=now()",
   [teamId,id]);
 }
 return result;
}
async function makeVenues(ids){
 const result=new Map();
 for(let i=1;i<=5;i++){
  const id=ids.get("ftv0"+i);
  await paidRole(id,"VENUE_OWNER");
  const old=await client.query("select id from venues where owner_user_id=$1 limit 1",[id]);
  let venueId=old.rows[0]?.id;
  if(!venueId){
   const created=await client.query(
    "insert into venues(owner_user_id,name,public_phone,province,city,address,timezone,booking_mode,status,verification_status,verified_at,setup_completed_at,created_at,updated_at) "+
    "values($1,$2,'0000000000','Kabul','Kabul',$3,'Asia/Kabul','INSTANT','ACTIVE','VERIFIED',now(),now(),now(),now()) returning id",
    [id,"QA Futsal Venue "+i,"TEST location, not a real court"]);
   venueId=created.rows[0].id;
  }
  result.set(i,venueId);
  await client.query(
   "insert into venue_subscriptions(venue_id,status,active_until,created_at,updated_at) "+
   "values($1,'ACTIVE',now()+interval '12 months',now(),now()) on conflict(venue_id) "+
   "do update set status='ACTIVE',active_until=excluded.active_until,updated_at=now()",
   [venueId]);
  await client.query(
   "insert into venue_areas(venue_id,name,default_session_duration_minutes,base_price_afn,active,created_at,updated_at) "+
   "values($1,'Main Court',90,1200,true,now(),now()) on conflict(venue_id,name) do nothing",
   [venueId]);
  for(let day=0;day<7;day++){
   await client.query(
    "insert into venue_opening_hours(venue_id,day_of_week,is_closed,opens_at,closes_at) "+
    "values($1,$2,false,'08:00','23:00') on conflict(venue_id,day_of_week) do nothing",
    [venueId,day]);
  }
 }
 return result;
}
async function makePlayers(ids,teams){
 for(let i=1;i<=5;i++){
  const id=ids.get("ftp0"+i);
  await addRole(id,"PLAYER");
  await client.query(
   "insert into player_profiles(user_id,public_display_name,position,visibility,created_at,updated_at) "+
   "values($1,$2,'ALA','PUBLIC',now(),now()) on conflict(user_id) do nothing",
   [id,"QA Player "+i]);
  await client.query(
   "insert into team_memberships(team_id,user_id,role,shirt_number,status,joined_at,updated_at) "+
   "values($1,$2,'PLAYER',$3,'ACTIVE',now(),now()) on conflict(team_id,user_id) "+
   "do update set role='PLAYER',status='ACTIVE',left_at=null,updated_at=now()",
   [teams.get(i),id,i]);
 }
}
async function makeReferees(ids,venues){
 for(let i=1;i<=5;i++){
  const id=ids.get("ftr0"+i);
  const conflict=await client.query(
   "select (exists(select 1 from user_roles where user_id=$1) "+
   "or exists(select 1 from player_profiles where user_id=$1) "+
   "or exists(select 1 from team_memberships where user_id=$1 and status='ACTIVE') "+
   "or exists(select 1 from teams where manager_user_id=$1) "+
   "or exists(select 1 from venues where owner_user_id=$1)) as invalid",[id]);
  if(conflict.rows[0].invalid)fail("Referee is not a normal user: ftr0"+i);
  await client.query(
   "insert into venue_referees(venue_id,user_id,assigned_by_user_id,assigned_at) "+
   "values($1,$2,$3,now()) on conflict(venue_id,user_id) do nothing",
   [venues.get(i),id,ids.get("ftv0"+i)]);
 }
}
async function verify(){
 for(const r of records){
  const rows=(await client.query(
   "select id,email_normalized,email_verified_at,bio,password_hash from users where username_normalized=$1",
   [r.username])).rows;
  const user=rows[0];
  if(!user||user.bio!==marker||user.email_normalized!==r.email||!user.email_verified_at)
    fail("Test account is missing verification: "+r.username);
  if(!await argon2.verify(user.password_hash,r.password))
    fail("Test password doesn't match: "+r.username);
  const roles=(await client.query("select role from user_roles where user_id=$1",[user.id])).rows.map(x=>x.role);
  if(r.role==="NORMAL_USER"||r.role==="REFEREE"){
   if(roles.length)fail("Unexpected explicit role for "+r.username);
  }else if(!roles.includes(r.role))fail("Missing "+r.role+" for "+r.username);
  if(["VENUE_OWNER","TEAM_MANAGER"].includes(r.role)){
   const x=(await client.query(
    "select count(*)::int as n from role_subscriptions where user_id=$1 and role=$2::user_role and status='ACTIVE' and active_until>now()",
    [user.id,r.role])).rows[0].n;
   if(x!==1)fail("No active subscription: "+r.username);
  }
  if(r.role==="REFEREE"){
   const x=(await client.query("select count(*)::int as n from venue_referees where user_id=$1",[user.id])).rows[0].n;
   if(x!==1)fail("No referee assignment: "+r.username);
  }
  if(r.role==="PLAYER"){
   const x=(await client.query(
    "select count(*)::int as n from team_memberships where user_id=$1 and role='PLAYER' and status='ACTIVE'",[user.id])).rows[0].n;
   if(x!==1)fail("No player membership: "+r.username);
  }
  if(r.role==="TEAM_MANAGER"){
   const x=(await client.query("select count(*)::int as n from teams where manager_user_id=$1 and status='ACTIVE'",[user.id])).rows[0].n;
   if(x!==1)fail("No team: "+r.username);
  }
  if(r.role==="VENUE_OWNER"){
   const x=(await client.query(
    "select count(*)::int as n from venues v join venue_subscriptions s on s.venue_id=v.id "+
    "where v.owner_user_id=$1 and v.status='ACTIVE' and s.status='ACTIVE'",[user.id])).rows[0].n;
   if(x!==1)fail("No subscribed venue: "+r.username);
  }
 }
}
async function cleanup(){
 const users=(await client.query(
  "select id,username_normalized,email_normalized,bio from users where username_normalized=any($1::text[]) for update",
  [records.map(x=>x.username)])).rows;
 if(users.length!==25)fail("Cleanup requires all 25 named QA accounts; refusing partial deletion.");
 const expected=new Map(records.map(x=>[x.username,x.email]));
 for(const row of users)if(row.bio!==marker||row.email_normalized!==expected.get(row.username_normalized))
  fail("Refusing to delete unmarked account: "+row.username_normalized);
 const ids=users.map(x=>x.id);
 await client.query(
  "delete from venue_referees where user_id=any($1::uuid[]) or venue_id in "+
  "(select id from venues where owner_user_id=any($1::uuid[]))",[ids]);
 await client.query("delete from teams where manager_user_id=any($1::uuid[])",[ids]);
 await client.query("delete from venues where owner_user_id=any($1::uuid[])",[ids]);
 await client.query("delete from users where id=any($1::uuid[])",[ids]);
}
try{
 await client.query("begin");
 await schema();
 if(mode==="seed"){
  const ids=await createAccounts();
  const teams=await makeTeams(ids);
  const venues=await makeVenues(ids);
  await makePlayers(ids,teams);
  await makeReferees(ids,venues);
  await verify();
 }else if(mode==="verify"){
  await verify();
 }else{
  await cleanup();
 }
 await client.query(mode==="verify"?"rollback":"commit");
 console.log(mode==="cleanup"
  ?"Deleted 25 marked QA accounts, their teams, and their venues."
  :"Verified 25 users: 5 Normal, 5 Team Owners, 5 Venue Owners, 5 Referees, 5 Players.");
 console.log("Passwords are never stored in the repository or printed in logs.");
}catch(error){
 await client.query("rollback");
 console.error("Test account "+mode+" failed (transaction rolled back):",error instanceof Error?error.message:String(error));
 process.exitCode=1;
}finally{
 client.release();await pool.end();
}
