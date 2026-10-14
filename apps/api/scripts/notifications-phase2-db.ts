/** Disposable PostgreSQL notification Phase 2 verification. Never use against production. */
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createDatabase} from "@leaguekick/database";
import {DrizzleNotificationRepository} from "../src/modules/notifications/notification.repository.js";
import {NotificationService} from "../src/modules/notifications/notification.service.js";

const url=process.env.DATABASE_URL??"";
const parsed=url?new URL(url):null;
if(process.env.CI!=="true"||parsed?.pathname!=="/futsal_ci"||
  !["127.0.0.1","localhost"].includes(parsed?.hostname))
  throw new Error("Notifications Phase 2 DB smoke only runs against disposable local CI Postgres.");
const {db,pool}=createDatabase(url);
const sql=async(statement:string,values:unknown[]=[])=> (await pool.query(statement,values)).rows;
const insertUser=async()=>{
  const id="qa2"+randomUUID().replace(/-/g,"").slice(0,15);
  const result=await sql("insert into users(display_name,username,username_normalized,email_normalized,email_verified_at,password_hash,preferred_language,status,city) values($1,$1,$1,$2,now(),'!CI_ONLY','en','ACTIVE','Kabul') returning id",[id,id+"@futsal.test"]);
  return result[0]!.id as string;
};
try{
  const user=await insertUser(),stranger=await insertUser();
  let time=new Date("2026-10-14T07:00:00.000Z");
  const service=new NotificationService(new DrizzleNotificationRepository(db),()=>time);
  for(let i=0;i<5;i++)await service.bookingCancelled({userId:user,bookingId:randomUUID(),venueName:"QA2 "+i});
  await service.bookingCancelled({userId:stranger,bookingId:randomUUID(),venueName:"Other"});
  const one=await service.list(user,"ALL",2);
  assert.equal(one.notifications.length,2);
  assert.equal(one.unreadCount,5);
  time=new Date("2026-10-14T07:01:00.000Z");
  await service.bookingCancelled({userId:user,bookingId:randomUUID(),venueName:"Newer"});
  const two=await service.list(user,"ALL",2,0,one.nextCursor!);
  const three=await service.list(user,"ALL",2,0,two.nextCursor!);
  const ids=[...one.notifications,...two.notifications,...three.notifications].map(x=>x.id);
  assert.equal(ids.length,5,"A new first-page notification must not displace older cursor rows");
  assert.equal(new Set(ids).size,5);
  assert.equal(three.hasMore,false);
  assert.equal((await service.unreadCount(user)).unreadCount,6);
  assert.equal((await service.unreadCount(stranger)).unreadCount,1);

  const original=(await service.list(user)).notifications[0]!;
  const marked=await service.markRead(user,original.id);
  assert.equal(marked.unreadCount,5);
  assert.equal((await service.markRead(user,original.id)).notification.readAt,marked.notification.readAt);
  await assert.rejects(service.markRead(stranger,original.id),{code:"NOTIFICATION_NOT_FOUND"});

  await service.registerDevice(user,{expoPushToken:"ExpoPushToken[notification-phase2-disposable-1]",platform:"ANDROID"});
  await service.updatePreferences(user,{inAppEnabled:false,pushEnabled:true});
  const eventId=randomUUID();
  await service.bookingCancelled({userId:user,bookingId:eventId,venueName:"PushOnly"});
  const rows=await sql(`select n.id,d.channel,d.status from notifications n join notification_deliveries d
    on d.notification_id=n.id where n.user_id=$1 and n.dedupe_key=$2`,[user,"booking-cancelled:"+eventId]);
  assert.equal(rows.length,1);
  assert.equal(rows[0].channel,"PUSH");
  assert.equal(rows[0].status,"PENDING");
  assert.equal((await service.list(user)).total,6,"Push-only event must be hidden from inbox");
  assert.equal((await service.unreadCount(user)).unreadCount,5);

  await service.updatePreferences(user,{inAppEnabled:true,pushEnabled:false});
  // An idempotent replay after changed preferences must not add IN_APP to an old PUSH-only event.
  await service.bookingCancelled({userId:user,bookingId:eventId,venueName:"PushOnly"});
  const replay=await sql("select count(*)::int n from notification_deliveries where notification_id=$1",[rows[0].id]);
  assert.equal(replay[0].n,1);
  const nextId=randomUUID();
  await Promise.all([
    service.bookingCancelled({userId:user,bookingId:nextId,venueName:"Atomic"}),
    service.bookingCancelled({userId:user,bookingId:nextId,venueName:"Atomic"}),
  ]);
  const atomic=await sql(`select n.id,d.channel from notifications n join notification_deliveries d
    on d.notification_id=n.id where n.user_id=$1 and n.dedupe_key=$2`,[user,"booking-cancelled:"+nextId]);
  assert.equal(atomic.length,1,"Concurrent idempotent writes create exactly one delivery intent");
  assert.equal(atomic[0].channel,"IN_APP");
  assert.equal((await service.list(user)).total,7);
  const clear=await service.markAllRead(user);
  assert.equal(clear.unreadCount,0);
  const pushOnly=await sql("select read_at from notifications where id=$1",[rows[0].id]);
  assert.equal(pushOnly[0].read_at,null);
  console.log("Notifications Phase 2 PostgreSQL passed: keyset ordering, per-user scopes, push-only visibility, atomic dedupe and idempotent reads.");
}finally{
  await pool.end();
}
