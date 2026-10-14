import type {
  NotificationDto,
  NotificationListFilter,
  NotificationPreferences,
  NotificationPreferencesUpdate,
  PushDeviceRegisterRequest,
} from "@leaguekick/contracts";
import type { Database } from "@leaguekick/database";
import {
  notificationDeliveries,
  notificationPreferences,
  notifications,
  pushDevices,
} from "@leaguekick/database";
import { and, count, desc, eq, exists, gt, inArray, isNull, isNotNull, lt, or } from "drizzle-orm";
import type { NotificationCreateInput, NotificationRepository } from "./notification.types.js";

function dto(row: typeof notifications.$inferSelect): NotificationDto {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    deepLink: row.deepLink,
    data: row.data,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

const DEFAULTS: NotificationPreferences = {
  inAppEnabled: true,
  pushEnabled: true,
  promotionsEnabled: true,
  venuePostsEnabled: true,
  teamInvitesEnabled: true,
};

export class DrizzleNotificationRepository implements NotificationRepository {
  constructor(private readonly db: Database) {}

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const [row] = await this.db.select().from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);
    return row ? {
      inAppEnabled: row.inAppEnabled,
      pushEnabled: row.pushEnabled,
      promotionsEnabled: row.promotionsEnabled,
      venuePostsEnabled: row.venuePostsEnabled,
      teamInvitesEnabled: row.teamInvitesEnabled,
    } : { ...DEFAULTS };
  }

  async updatePreferences(
    userId: string,
    input: NotificationPreferencesUpdate,
    updatedAt: Date,
  ): Promise<NotificationPreferences> {
    const current = await this.getPreferences(userId);
    const next: NotificationPreferences = {
      inAppEnabled: input.inAppEnabled ?? current.inAppEnabled,
      pushEnabled: input.pushEnabled ?? current.pushEnabled,
      promotionsEnabled: input.promotionsEnabled ?? current.promotionsEnabled,
      venuePostsEnabled: input.venuePostsEnabled ?? current.venuePostsEnabled,
      teamInvitesEnabled: input.teamInvitesEnabled ?? current.teamInvitesEnabled,
    };
    await this.db.insert(notificationPreferences).values({
      userId,
      ...next,
      updatedAt,
    }).onConflictDoUpdate({
      target: notificationPreferences.userId,
      set: { ...next, updatedAt },
    });
    return next;
  }

  /** Push-only events are not part of the in-app inbox or its unread badge. */
  private inAppDelivery(){
    return exists(this.db.select({id:notificationDeliveries.notificationId})
      .from(notificationDeliveries).where(and(
        eq(notificationDeliveries.notificationId,notifications.id),
        eq(notificationDeliveries.channel,"IN_APP"),
      )));
  }

  private filtered(userId:string,filter:NotificationListFilter="ALL"){
    const kind=filter==="BOOKINGS"?["BOOKING_CONFIRMED","BOOKING_CANCELLED","BOOKING_REQUEST"] as const:
      filter==="VENUES"?["SLOT_PROMOTION","SLOT_AVAILABLE","VENUE_POST"] as const:
      filter==="TEAMS"?["TEAM_INVITATION","TEAM_JOIN_REQUEST","TEAM_JOIN_DECISION","TEAM_ACTIVITY","TEAM_CHALLENGE","TEAM_ANNOUNCEMENT"] as const:
      filter==="COMPETITIONS"?["COMPETITION_UPDATE"] as const:null;
    return and(eq(notifications.userId,userId),this.inAppDelivery(),
      filter==="UNREAD"?isNull(notifications.readAt):undefined,
      kind?inArray(notifications.type,[...kind]):undefined);
  }

  async listNotifications(userId:string,limit:number,offset=0,filter:NotificationListFilter="ALL",
    before?:{createdAt:Date;id:string}){
    const rows=await this.db.select().from(notifications)
      .where(and(this.filtered(userId,filter),before?
        or(lt(notifications.createdAt,before.createdAt),
          and(eq(notifications.createdAt,before.createdAt),lt(notifications.id,before.id))):undefined))
      .orderBy(desc(notifications.createdAt),desc(notifications.id))
      .limit(limit).offset(offset);
    return rows.map(dto);
  }

  async countNotifications(userId:string,filter:NotificationListFilter="ALL"){
    const [row]=await this.db.select({value:count()}).from(notifications)
      .where(this.filtered(userId,filter));
    return Number(row?.value??0);
  }

  async countUnreadNotifications(userId:string){
    const [row]=await this.db.select({value:count()}).from(notifications)
      .where(and(eq(notifications.userId,userId),isNull(notifications.readAt),this.inAppDelivery()));
    return Number(row?.value??0);
  }

  async markAllRead(userId:string,readAt:Date){
    const rows=await this.db.update(notifications).set({readAt})
      .where(and(eq(notifications.userId,userId),isNull(notifications.readAt),this.inAppDelivery()))
      .returning({id:notifications.id});
    return rows.length;
  }

  async deleteNotification(userId:string,notificationId:string){
    const rows=await this.db.delete(notifications)
      .where(and(eq(notifications.userId,userId),eq(notifications.id,notificationId)))
      .returning({id:notifications.id});
    return rows.length>0;
  }

  async clearRead(userId:string){
    const rows=await this.db.delete(notifications)
      .where(and(eq(notifications.userId,userId),isNotNull(notifications.readAt),this.inAppDelivery()))
      .returning({id:notifications.id});
    return rows.length;
  }

  async getNotification(userId: string, notificationId: string) {
    const [row] = await this.db.select().from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.id, notificationId)))
      .limit(1);
    return row ? dto(row) : null;
  }

  async markRead(userId: string, notificationId: string, readAt: Date) {
    const [row] = await this.db.update(notifications).set({ readAt })
      .where(and(eq(notifications.userId, userId), eq(notifications.id, notificationId),
        isNull(notifications.readAt),this.inAppDelivery()))
      .returning();
    // Idempotent retry preserves the original readAt timestamp.
    return row ? dto(row) : this.getNotification(userId,notificationId);
  }

  async countRecentMarketingNotifications(userId: string, since: Date) {
    const [row] = await this.db.select({ value: count() }).from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        inArray(notifications.type, ["SLOT_PROMOTION", "VENUE_POST"]),
        gt(notifications.createdAt, since),
      ));
    return Number(row?.value ?? 0);
  }

  async createNotification(input: NotificationCreateInput, createdAt: Date,
    channels:Array<"IN_APP"|"PUSH">){
    const created=await this.db.transaction(async(tx)=>{
      const [row]=await tx.insert(notifications).values({
        userId:input.userId,type:input.type,title:input.title,body:input.body,
        deepLink:input.deepLink,data:input.data??{},
        dedupeKey:input.dedupeKey,createdAt,
      }).onConflictDoNothing({
        target:[notifications.userId,notifications.dedupeKey],
      }).returning();
      if(!row)return null;
      // Roll back the notification if any of its delivery intents cannot commit.
      if(channels.length)await tx.insert(notificationDeliveries).values(channels.map(channel=>({
        notificationId:row.id,channel,
        status:channel==="IN_APP"?"SENT" as const:"PENDING" as const,
        attempts:channel==="IN_APP"?1:0,
        lastAttemptAt:channel==="IN_APP"?createdAt:null,
      })));
      return dto(row);
    });
    if(created)return {notification:created,created:true};
    // Competing inserts have committed before ON CONFLICT can return no row.
    const [existing]=await this.db.select().from(notifications)
      .where(and(eq(notifications.userId,input.userId),
        eq(notifications.dedupeKey,input.dedupeKey))).limit(1);
    if(!existing)throw new Error("Deduplicated notification could not be loaded.");
    // Do not append channels to an earlier event when preferences have changed.
    return {notification:dto(existing),created:false};
  }

  async registerDevice(userId: string, input: PushDeviceRegisterRequest, seenAt: Date) {
    await this.db.insert(pushDevices).values({
      userId,
      expoPushToken: input.expoPushToken,
      platform: input.platform,
      active: true,
      createdAt: seenAt,
      lastSeenAt: seenAt,
    }).onConflictDoUpdate({
      target: pushDevices.expoPushToken,
      set: {
        userId,
        platform: input.platform,
        active: true,
        lastSeenAt: seenAt,
      },
    });
  }

  async unregisterDevice(userId: string, expoPushToken: string) {
    await this.db.update(pushDevices).set({ active: false })
      .where(and(eq(pushDevices.userId, userId), eq(pushDevices.expoPushToken, expoPushToken)));
  }

  async hasActivePushDevice(userId: string) {
    const [row] = await this.db.select({ id: pushDevices.id }).from(pushDevices)
      .where(and(eq(pushDevices.userId, userId), eq(pushDevices.active, true)))
      .limit(1);
    return Boolean(row);
  }

  async ensureDeliveries(notificationId: string, channels: Array<"IN_APP" | "PUSH">) {
    if (channels.length === 0) return;
    await this.db.insert(notificationDeliveries).values(
      channels.map((channel) => ({
        notificationId,
        channel,
        status: channel === "IN_APP" ? "SENT" as const : "PENDING" as const,
        attempts: channel === "IN_APP" ? 1 : 0,
        lastAttemptAt: channel === "IN_APP" ? new Date() : null,
      })),
    ).onConflictDoNothing();
  }
}
