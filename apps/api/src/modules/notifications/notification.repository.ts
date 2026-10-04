import type {
  NotificationDto,
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
import { and, count, desc, eq, gt, inArray } from "drizzle-orm";
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

  async listNotifications(userId: string, limit: number) {
    const rows = await this.db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
    return rows.map(dto);
  }

  async getNotification(userId: string, notificationId: string) {
    const [row] = await this.db.select().from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.id, notificationId)))
      .limit(1);
    return row ? dto(row) : null;
  }

  async markRead(userId: string, notificationId: string, readAt: Date) {
    const [row] = await this.db.update(notifications).set({ readAt })
      .where(and(eq(notifications.userId, userId), eq(notifications.id, notificationId)))
      .returning();
    return row ? dto(row) : null;
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

  async createNotification(input: NotificationCreateInput, createdAt: Date) {
    try {
      const [created] = await this.db.insert(notifications).values({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        deepLink: input.deepLink,
        data: input.data ?? {},
        dedupeKey: input.dedupeKey,
        createdAt,
      }).returning();
      if (!created) throw new Error("Notification could not be created.");
      return { notification: dto(created), created: true };
    } catch (error) {
      if ((error as { code?: string }).code !== "23505") throw error;
      const [existing] = await this.db.select().from(notifications)
        .where(and(
          eq(notifications.userId, input.userId),
          eq(notifications.dedupeKey, input.dedupeKey),
        ))
        .limit(1);
      if (!existing) throw error;
      return { notification: dto(existing), created: false };
    }
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
