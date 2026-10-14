import type {Database} from "@leaguekick/database";
import {notificationDeliveries,notificationPreferences,notifications,pushDevices,users} from "@leaguekick/database";
import {and,eq,inArray,sql} from "drizzle-orm";

export type PendingPush={
  notificationId:string;userId:string;title:string;body:string;
  deepLink:string;attempts:number;
};
export type PushReceipt={status:"ok"|"error";id?:string;details?:{error?:string};message?:string};
export interface PushDeliveryStore{
  claim(now:Date,limit:number):Promise<PendingPush[]>;
  eligibleTokens(userId:string):Promise<string[]>;
  settle(notificationId:string,status:"PENDING"|"SENT"|"FAILED"|"SKIPPED",error:string|null):Promise<void>;
  disableToken(token:string):Promise<void>;
}

/**
 * A leased queue: SQL SKIP LOCKED prevents overlapping workers from claiming
 * the same job; attempt increment and lease timestamp commit before network I/O.
 * A crash will be picked up again after the lease expires.
 */
export class DrizzlePushDeliveryStore implements PushDeliveryStore{
  constructor(private readonly db:Database){}
  async claim(now:Date,limit:number):Promise<PendingPush[]>{
    const rows=await this.db.execute(sql`
      WITH claimed AS (
        SELECT d.notification_id
        FROM notification_deliveries d
        WHERE d.channel='PUSH' AND d.status='PENDING'
          AND (d.last_attempt_at IS NULL OR d.last_attempt_at < ${new Date(now.getTime()-120000)})
          AND d.attempts<3
        ORDER BY d.last_attempt_at ASC NULLS FIRST,d.notification_id ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      ), leased AS (
        UPDATE notification_deliveries d SET attempts=d.attempts+1,last_attempt_at=${now}
        FROM claimed c WHERE d.notification_id=c.notification_id AND d.channel='PUSH'
        RETURNING d.notification_id,d.attempts
      )
      SELECT n.id AS "notificationId",n.user_id AS "userId",n.title,n.body,
        n.deep_link AS "deepLink",leased.attempts
      FROM leased INNER JOIN notifications n ON n.id=leased.notification_id
    `);
    return rows.rows as unknown as PendingPush[];
  }
  async eligibleTokens(userId:string):Promise<string[]>{
    const rows=await this.db.select({token:pushDevices.expoPushToken}).from(pushDevices)
      .innerJoin(users,eq(users.id,pushDevices.userId))
      .leftJoin(notificationPreferences,eq(notificationPreferences.userId,users.id))
      .where(and(eq(users.id,userId),eq(users.status,"ACTIVE"),eq(pushDevices.active,true),
        sql`coalesce(${notificationPreferences.pushEnabled},true)=true`))
      .limit(50);
    return rows.map(x=>x.token).filter(x=>/^(Expo|Exponent)PushToken\[[\w-]+\]$/.test(x));
  }
  async settle(notificationId:string,status:"PENDING"|"SENT"|"FAILED"|"SKIPPED",error:string|null){
    await this.db.update(notificationDeliveries).set({status,error:error?.slice(0,500)??null})
      .where(and(eq(notificationDeliveries.notificationId,notificationId),
        eq(notificationDeliveries.channel,"PUSH")));
  }
  async disableToken(token:string){
    await this.db.update(pushDevices).set({active:false})
      .where(eq(pushDevices.expoPushToken,token));
  }
}

export type PushTransport=(payload:Array<{to:string;title:string;body:string;data:{url:string;notificationId:string};sound:"default"}>)=>Promise<PushReceipt[]>;

/** Expo HTTP API. An accepted ticket is not proof of arrival on the handset. */
export const expoPushTransport:PushTransport=async payload=>{
  const response=await fetch("https://exp.host/--/api/v2/push/send",{
    method:"POST",
    headers:{"Content-Type":"application/json","Accept":"application/json",
      ...(process.env.EXPO_ACCESS_TOKEN?{Authorization:"Bearer "+process.env.EXPO_ACCESS_TOKEN}:{})},
    body:JSON.stringify(payload),
    signal:AbortSignal.timeout(10000),
  });
  if(!response.ok)throw new Error("Expo push gateway HTTP "+response.status);
  const json=await response.json() as {data?:PushReceipt[]|PushReceipt;errors?:unknown[]};
  if(json.errors?.length)throw new Error("Expo push gateway returned errors");
  const tickets=Array.isArray(json.data)?json.data:json.data?[json.data]:[];
  if(tickets.length!==payload.length)throw new Error("Expo ticket count mismatch");
  return tickets;
};

/** Max three network attempts, transient failures retry after the 120s lease.
 * Invalid tokens are disabled. A device may receive duplicates if the worker
 * crashes after sending and before acknowledging; notificationId permits dedupe.
 */
export class PushDispatcher{
  constructor(private readonly store:PushDeliveryStore,
    private readonly send:PushTransport=expoPushTransport,
    private readonly now:()=>Date=()=>new Date()){}
  async run(limit=20):Promise<number>{
    const jobs=await this.store.claim(this.now(),limit);
    for(const job of jobs){
      try{
        const tokens=await this.store.eligibleTokens(job.userId);
        if(!tokens.length){
          await this.store.settle(job.notificationId,"SKIPPED","No eligible device or push permission disabled");
          continue;
        }
        const tickets=await this.send(tokens.map(to=>({
          to,title:job.title,body:job.body,sound:"default",
          data:{url:job.deepLink,notificationId:job.notificationId},
        })));
        const failures:string[]=[];
        let accepted=0;
        for(let index=0;index<tokens.length;index++){
          const ticket=tickets[index];
          if(ticket?.status==="ok"){accepted++;continue;}
          const code=ticket?.details?.error??"GATEWAY_REJECTED";
          if(code==="DeviceNotRegistered")await this.store.disableToken(tokens[index]!);
          failures.push(code);
        }
        if(accepted>0)await this.store.settle(job.notificationId,"SENT",
          failures.length?("Other device tickets rejected: "+failures.join(",")):null);
        else if(failures.every(x=>x==="DeviceNotRegistered"))
          await this.store.settle(job.notificationId,"SKIPPED","All device tokens expired");
        else await this.store.settle(job.notificationId,job.attempts>=3?"FAILED":"PENDING",
          failures.join(","));
      }catch(e){
        const message=e instanceof Error?e.message:String(e);
        await this.store.settle(job.notificationId,job.attempts>=3?"FAILED":"PENDING",message);
      }
    }
    return jobs.length;
  }
}
