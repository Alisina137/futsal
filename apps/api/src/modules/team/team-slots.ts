import {and,asc,eq,isNull,or,sql} from "drizzle-orm";
import type {Database} from "@leaguekick/database";
import {roleSubscriptions,teamExtraSubscriptions,teams,users,auditLogs} from "@leaguekick/database";
import {errors} from "../../lib/errors.js";
export const EXTRA_TEAM_PRICE_AFN=300;
export const isPaid=(row:{status:string;activeUntil:Date|null}|undefined,now:Date)=>
  !!row&&row.status==="ACTIVE"&&!!row.activeUntil&&row.activeUntil>now;
export async function teamRolePaid(db:Database,userId:string,now:Date){
  const [role]=await db.select({status:roleSubscriptions.status,activeUntil:roleSubscriptions.activeUntil})
    .from(roleSubscriptions).where(and(eq(roleSubscriptions.userId,userId),
      eq(roleSubscriptions.role,"TEAM_MANAGER"))).limit(1);
  return isPaid(role,now);
}
/** First unmanaged add-on-free team uses the paid base role; subsequent teams need an
 * independently activated add-on attached to that particular team. */
export async function teamLicenseActive(db:Database,userId:string,teamId:string,now:Date){
  if(!await teamRolePaid(db,userId,now))return false;
  const [slot]=await db.select({status:teamExtraSubscriptions.status,
    activeUntil:teamExtraSubscriptions.activeUntil})
    .from(teamExtraSubscriptions).where(and(eq(teamExtraSubscriptions.userId,userId),
      eq(teamExtraSubscriptions.teamId,teamId))).limit(1);
  if(slot)return isPaid(slot,now);
  const unassigned=await db.select({id:teams.id}).from(teams)
    .leftJoin(teamExtraSubscriptions,eq(teamExtraSubscriptions.teamId,teams.id))
    .where(and(eq(teams.managerUserId,userId),eq(teams.status,"ACTIVE"),
      or(isNull(teams.offlineVenueId),sql`${teams.claimedAt} IS NOT NULL`),
      isNull(teamExtraSubscriptions.id))).orderBy(asc(teams.createdAt),asc(teams.id));
  return unassigned[0]?.id===teamId;
}
export async function requireTeamLicense(db:Database,userId:string,teamId:string,now:Date){
  if(!await teamLicenseActive(db,userId,teamId,now))
    throw errors.forbidden("TEAM_SUBSCRIPTION_REQUIRED","This team requires an active team-specific subscription in Settings.");
}
const iso=(d:Date|null)=>d?.toISOString()??null;
function displaySlot(s:typeof teamExtraSubscriptions.$inferSelect,teamName:string|null,now:Date){
  return {id:s.id,userId:s.userId,teamId:s.teamId,teamName,
    status:s.status==="ACTIVE"&&!isPaid(s,now)?"EXPIRED":s.status,
    monthlyPriceAfn:s.monthlyPriceAfn,requestedAt:s.requestedAt.toISOString(),
    activeUntil:iso(s.activeUntil),paymentReference:s.paymentReference};
}
export class TeamSlotsService{
  constructor(private readonly db:Database,private readonly now:()=>Date=()=>new Date()){}
  async capacity(userId:string){
    const now=this.now();
    const [owned,rows,baseActive]=await Promise.all([
      this.db.select({id:teams.id}).from(teams).where(and(eq(teams.managerUserId,userId),
        eq(teams.status,"ACTIVE"),or(isNull(teams.offlineVenueId),sql`${teams.claimedAt} IS NOT NULL`))),
      this.db.select({slot:teamExtraSubscriptions,teamName:teams.name})
        .from(teamExtraSubscriptions).leftJoin(teams,eq(teamExtraSubscriptions.teamId,teams.id))
        .where(eq(teamExtraSubscriptions.userId,userId)).orderBy(asc(teamExtraSubscriptions.requestedAt)),
      teamRolePaid(this.db,userId,now),
    ]);
    const assigned=new Set(rows.filter(x=>!!x.slot.teamId).map(x=>x.slot.teamId));
    const baseUsed=owned.some(x=>!assigned.has(x.id));
    const unusedPaid=rows.some(x=>!x.slot.teamId&&isPaid(x.slot,now));
    return {baseActive,monthlyPriceAfn:EXTRA_TEAM_PRICE_AFN,ownedTeams:owned.length,
      canCreate:baseActive&&(!baseUsed||unusedPaid),
      slots:rows.map(x=>displaySlot(x.slot,x.teamName,now))};
  }
  async request(userId:string,paymentReference:string|null,renewSlotId:string|null){
    if(!await teamRolePaid(this.db,userId,this.now()))
      throw errors.forbidden("TEAM_OWNER_SUBSCRIPTION_REQUIRED","Activate the Team Manager subscription before requesting another team.");
    return this.db.transaction(async tx=>{
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
      const now=this.now();
      if(renewSlotId){
        const [slot]=await tx.select().from(teamExtraSubscriptions).where(and(
          eq(teamExtraSubscriptions.id,renewSlotId),eq(teamExtraSubscriptions.userId,userId))).limit(1);
        if(!slot)throw errors.badRequest("TEAM_SLOT_NOT_FOUND","Team subscription was not found.");
        if(isPaid(slot,now))throw errors.conflict("TEAM_SLOT_ACTIVE","This team subscription is already active.");
        if(slot.status==="PENDING")return {slot:displaySlot(slot,null,now)};
        const [newSlot]=await tx.update(teamExtraSubscriptions).set({status:"PENDING",
          paymentReference,requestedAt:now,updatedAt:now}).where(eq(teamExtraSubscriptions.id,slot.id)).returning();
        return {slot:displaySlot(newSlot!,null,now)};
      }
      const existing=await tx.select().from(teamExtraSubscriptions)
        .where(and(eq(teamExtraSubscriptions.userId,userId),isNull(teamExtraSubscriptions.teamId)));
      const active=existing.find(x=>isPaid(x,now));
      if(active)return {slot:displaySlot(active,null,now)};
      const pending=existing.find(x=>x.status==="PENDING");
      if(pending)return {slot:displaySlot(pending,null,now)};
      const reusable=existing.find(x=>!x.teamId);
      if(reusable){
        const [row]=await tx.update(teamExtraSubscriptions).set({status:"PENDING",
          requestedAt:now,updatedAt:now,paymentReference,activeUntil:null})
          .where(eq(teamExtraSubscriptions.id,reusable.id)).returning();
        return {slot:displaySlot(row!,null,now)};
      }
      const [created]=await tx.insert(teamExtraSubscriptions).values({userId,
        status:"PENDING",monthlyPriceAfn:EXTRA_TEAM_PRICE_AFN,paymentReference,
        requestedAt:now,updatedAt:now}).returning();
      return {slot:displaySlot(created!,null,now)};
    });
  }
  async adminList(){
    const now=this.now();
    const rows=await this.db.select({slot:teamExtraSubscriptions,teamName:teams.name,
      username:users.username,displayName:users.displayName})
      .from(teamExtraSubscriptions).innerJoin(users,eq(teamExtraSubscriptions.userId,users.id))
      .leftJoin(teams,eq(teamExtraSubscriptions.teamId,teams.id))
      .orderBy(asc(teamExtraSubscriptions.requestedAt));
    return {slots:rows.map(x=>({...displaySlot(x.slot,x.teamName,now),
      username:x.username,displayName:x.displayName}))};
  }
  async activate(adminUserId:string,slotId:string,months:number,paymentReference:string|null){
    return this.db.transaction(async tx=>{
      const [actor]=await tx.select({id:users.id}).from(users).where(eq(users.id,adminUserId)).limit(1);
      if(!actor)throw errors.forbidden("ROLE_REQUIRED","Platform admin required.");
      const [slot]=await tx.select().from(teamExtraSubscriptions)
        .where(eq(teamExtraSubscriptions.id,slotId)).for("update").limit(1);
      if(!slot)throw errors.badRequest("TEAM_SLOT_NOT_FOUND","Subscription request not found.");
      const now=this.now();
      if(slot.status==="ACTIVE"&&isPaid(slot,now))
        throw errors.conflict("TEAM_SLOT_ACTIVE","An active team subscription cannot be activated again without a renewal request.");
      if(slot.status!=="PENDING")
        throw errors.conflict("TEAM_SLOT_PAYMENT_NOT_REQUESTED","The manager must request this subscription before payment is approved.");
      const base=slot.activeUntil&&slot.activeUntil>now?slot.activeUntil:now;
      const until=new Date(base);until.setUTCMonth(until.getUTCMonth()+months);
      const [updated]=await tx.update(teamExtraSubscriptions).set({status:"ACTIVE",
        activeUntil:until,activatedAt:now,activatedByUserId:adminUserId,
        paymentReference:paymentReference??slot.paymentReference,updatedAt:now})
        .where(eq(teamExtraSubscriptions.id,slot.id)).returning();
      await tx.insert(auditLogs).values({actorUserId:adminUserId,action:"TEAM_EXTRA_SUBSCRIPTION_ACTIVATED",
        targetType:"USER",targetId:slot.userId,
        metadata:{slotId:slot.id,teamId:slot.teamId,months,
          amountAfn:slot.monthlyPriceAfn*months,activeUntil:until.toISOString()},
        createdAt:now});
      return {slot:displaySlot(updated!,null,now)};
    });
  }
}
