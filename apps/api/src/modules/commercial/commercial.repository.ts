import type { Database } from "@leaguekick/database";
import {
  auditLogs,
  bookings,
  platformSettings,
  sessions,
  subscriptionPayments,
  userRoles,
  users,
  venueAreas,
  venueOpeningHours,
  venuePosts,
  venuePromotions,
  venueSubscriptions,
  venues,
} from "@leaguekick/database";
import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  or,
} from "drizzle-orm";
import type {
  AdminAuditLogDto,
  AdminUserDto,
  AdminVenueDto,
  SubscriptionPaymentDto,
  UserRole,
  VenueOpeningHourInput,
} from "@leaguekick/contracts";
import { errors } from "../../lib/errors.js";
import { hasPremiumWriteAccess } from "../billing/entitlement.js";
import type {
  CommercialRepository,
  CommercialSettingsRecord,
  CommercialSubscriptionRecord,
  CommercialVenueRecord,
  OwnerAnalyticsSnapshot,
} from "./commercial.types.js";

function trimDbTime(value: string | null): string | null {
  return value ? value.slice(0, 5) : null;
}

function subscriptionRecord(
  row: typeof venueSubscriptions.$inferSelect | undefined,
): CommercialSubscriptionRecord | null {
  if (!row) return null;
  return {
    venueId: row.venueId,
    status: row.status,
    trialStartedAt: row.trialStartedAt,
    trialEndsAt: row.trialEndsAt,
    activeUntil: row.activeUntil,
  };
}

function paymentDto(row: typeof subscriptionPayments.$inferSelect): SubscriptionPaymentDto {
  return {
    id: row.id,
    venueId: row.venueId,
    amountAfn: row.amountAfn,
    periodStartsAt: row.periodStartsAt.toISOString(),
    periodEndsAt: row.periodEndsAt.toISOString(),
    provider: row.provider,
    providerReference: row.providerReference,
    status: row.status,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

function auditDto(row: typeof auditLogs.$inferSelect): AdminAuditLogDto {
  return {
    id: row.id,
    actorUserId: row.actorUserId,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
  };
}

function addMonthsUtc(date: Date, months: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error &&
    (error as { code?: string }).code === "23505";
}

export class DrizzleCommercialRepository implements CommercialRepository {
  constructor(private readonly db: Database) {}

  private async hydrateVenue(row: typeof venues.$inferSelect): Promise<CommercialVenueRecord> {
    const [subscription] = await this.db
      .select()
      .from(venueSubscriptions)
      .where(eq(venueSubscriptions.venueId, row.id))
      .limit(1);

    return {
      id: row.id,
      ownerUserId: row.ownerUserId,
      name: row.name,
      province: row.province,
      city: row.city,
      address: row.address,
      timezone: row.timezone,
      status: row.status,
      verificationStatus: row.verificationStatus,
      createdAt: row.createdAt,
      subscription: subscriptionRecord(subscription),
    };
  }

  async getOwnerVenue(ownerUserId: string) {
    const [row] = await this.db
      .select()
      .from(venues)
      .where(eq(venues.ownerUserId, ownerUserId))
      .limit(1);
    return row ? this.hydrateVenue(row) : null;
  }

  async getVenue(venueId: string) {
    const [row] = await this.db.select().from(venues).where(eq(venues.id, venueId)).limit(1);
    return row ? this.hydrateVenue(row) : null;
  }

  async getSettings(): Promise<CommercialSettingsRecord | null> {
    const [row] = await this.db.select().from(platformSettings).where(eq(platformSettings.id, "default")).limit(1);
    return row ? {
      monthlyPriceAfn: row.monthlyPriceAfn,
      annualPriceAfn: row.annualPriceAfn,
      trialDurationHours: row.trialDurationHours,
      featureFlags: row.featureFlags,
      notificationTemplates: row.notificationTemplates,
      updatedAt: row.updatedAt,
    } : null;
  }

  async listPayments(venueId: string) {
    const rows = await this.db
      .select()
      .from(subscriptionPayments)
      .where(eq(subscriptionPayments.venueId, venueId))
      .orderBy(desc(subscriptionPayments.createdAt))
      .limit(100);
    return rows.map(paymentDto);
  }

  async requestReactivation(ownerUserId: string, venueId: string, createdAt: Date) {
    await this.db.insert(auditLogs).values({
      actorUserId: ownerUserId,
      action: "SUBSCRIPTION_REACTIVATION_REQUESTED",
      targetType: "VENUE",
      targetId: venueId,
      metadata: { source: "OWNER_APP" },
      createdAt,
    });
  }

  async analyticsSnapshot(ownerUserId: string, startsAt: Date, endsAt: Date): Promise<OwnerAnalyticsSnapshot | null> {
    const venue = await this.getOwnerVenue(ownerUserId);
    if (!venue) return null;
    const [areaRows, hourRows, bookingRows] = await Promise.all([
      this.db
        .select({ id: venueAreas.id })
        .from(venueAreas)
        .where(and(eq(venueAreas.venueId, venue.id), eq(venueAreas.active, true))),
      this.db
        .select()
        .from(venueOpeningHours)
        .where(eq(venueOpeningHours.venueId, venue.id)),
      this.db
        .select({
          status: bookings.status,
          source: bookings.source,
          startsAt: bookings.startsAt,
          endsAt: bookings.endsAt,
          priceAfn: bookings.priceAfn,
        })
        .from(bookings)
        .where(and(
          eq(bookings.venueId, venue.id),
          gte(bookings.startsAt, startsAt),
          lt(bookings.startsAt, endsAt),
        )),
    ]);

    return {
      venue,
      activeAreaCount: areaRows.length,
      openingHours: hourRows
        .map((hour): VenueOpeningHourInput => ({
          dayOfWeek: hour.dayOfWeek,
          isClosed: hour.isClosed,
          opensAt: trimDbTime(hour.opensAt),
          closesAt: trimDbTime(hour.closesAt),
        }))
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek),
      bookings: bookingRows,
    };
  }

  async adminDashboard(now: Date) {
    const [userRows, venueRows, subscriptionRows, paymentRows, bookingRows] = await Promise.all([
      this.db.select({ status: users.status }).from(users),
      this.db.select({
        status: venues.status,
        verificationStatus: venues.verificationStatus,
      }).from(venues),
      this.db.select().from(venueSubscriptions),
      this.db.select({
        amountAfn: subscriptionPayments.amountAfn,
        status: subscriptionPayments.status,
      }).from(subscriptionPayments),
      this.db.select({
        priceAfn: bookings.priceAfn,
        status: bookings.status,
      }).from(bookings),
    ]);

    let trialVenues = 0;
    let paidVenues = 0;
    let expiredVenues = 0;
    for (const row of subscriptionRows) {
      if (row.status === "TRIAL" && row.trialEndsAt && row.trialEndsAt.getTime() > now.getTime()) trialVenues += 1;
      else if (row.status === "ACTIVE" && (!row.activeUntil || row.activeUntil.getTime() > now.getTime())) paidVenues += 1;
      else expiredVenues += 1;
    }

    return {
      activeUsers: userRows.filter((row) => row.status === "ACTIVE").length,
      activeVenues: venueRows.filter((row) => row.status === "ACTIVE").length,
      pendingVenueVerifications: venueRows.filter((row) => row.verificationStatus === "PENDING").length,
      trialVenues,
      paidVenues,
      expiredVenues,
      recordedPaymentsAfn: paymentRows
        .filter((row) => row.status === "RECORDED")
        .reduce((sum, row) => sum + row.amountAfn, 0),
      bookingGmvAfn: bookingRows
        .filter((row) => row.status !== "CANCELLED")
        .reduce((sum, row) => sum + row.priceAfn, 0),
    };
  }

  private async rolesFor(userId: string): Promise<UserRole[]> {
    const rows = await this.db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId));
    return rows.map((row) => row.role as UserRole);
  }

  async listUsers(query?: string): Promise<AdminUserDto[]> {
    const q = query?.trim();
    const rows = q
      ? await this.db
          .select()
          .from(users)
          .where(or(
            ilike(users.displayName, `%${q}%`),
            ilike(users.phoneE164, `%${q}%`),
            ilike(users.username, `%${q}%`),
          ))
          .orderBy(desc(users.createdAt))
          .limit(50)
      : await this.db.select().from(users).orderBy(desc(users.createdAt)).limit(50);

    return Promise.all(rows.map(async (row) => ({
      id: row.id,
      displayName: row.displayName,
      username: row.username,
      phone: row.phoneE164,
      status: row.status,
      roles: await this.rolesFor(row.id),
      createdAt: row.createdAt.toISOString(),
    })));
  }

  async listVenues(query?: string): Promise<AdminVenueDto[]> {
    const q = query?.trim();
    const rows = q
      ? await this.db
          .select()
          .from(venues)
          .where(or(
            ilike(venues.name, `%${q}%`),
            ilike(venues.city, `%${q}%`),
            ilike(venues.address, `%${q}%`),
          ))
          .orderBy(desc(venues.createdAt))
          .limit(50)
      : await this.db.select().from(venues).orderBy(desc(venues.createdAt)).limit(50);

    return Promise.all(rows.map(async (row) => {
      const [subscription] = await this.db
        .select()
        .from(venueSubscriptions)
        .where(eq(venueSubscriptions.venueId, row.id))
        .limit(1);
      let subscriptionState: AdminVenueDto["subscriptionState"] = "NOT_STARTED";
      if (subscription) {
        if (subscription.status === "TRIAL" && subscription.trialEndsAt && subscription.trialEndsAt.getTime() <= Date.now()) {
          subscriptionState = "EXPIRED";
        } else if (subscription.status === "ACTIVE" && subscription.activeUntil && subscription.activeUntil.getTime() <= Date.now()) {
          subscriptionState = "EXPIRED";
        } else {
          subscriptionState = subscription.status;
        }
      }
      return {
        id: row.id,
        ownerUserId: row.ownerUserId,
        name: row.name,
        province: row.province,
        city: row.city,
        address: row.address,
        status: row.status,
        verificationStatus: row.verificationStatus,
        subscriptionState,
        trialEndsAt: subscription?.trialEndsAt?.toISOString() ?? null,
        activeUntil: subscription?.activeUntil?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      };
    }));
  }

  async setUserStatus(
    actorUserId: string,
    userId: string,
    status: "ACTIVE" | "SUSPENDED",
    reason: string,
    now: Date,
  ) {
    if (actorUserId === userId && status === "SUSPENDED") {
      throw errors.badRequest("ADMIN_SELF_SUSPEND", "You cannot suspend your own admin account.");
    }
    const [updated] = await this.db
      .update(users)
      .set({ status, updatedAt: now })
      .where(eq(users.id, userId))
      .returning({ id: users.id });
    if (!updated) throw errors.badRequest("USER_NOT_FOUND", "User not found.");

    if (status === "SUSPENDED") {
      await this.db
        .update(sessions)
        .set({ revokedAt: now, lastSeenAt: now })
        .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
    }

    await this.db.insert(auditLogs).values({
      actorUserId,
      action: status === "SUSPENDED" ? "USER_SUSPENDED" : "USER_RESTORED",
      targetType: "USER",
      targetId: userId,
      metadata: { reason },
      createdAt: now,
    });
  }

  async applyVenueAction(
    actorUserId: string,
    venueId: string,
    action: "VERIFY" | "REJECT" | "SUSPEND" | "RESTORE",
    reason: string,
    now: Date,
  ) {
    const [venue] = await this.db.select().from(venues).where(eq(venues.id, venueId)).limit(1);
    if (!venue) throw errors.badRequest("VENUE_NOT_FOUND", "Venue not found.");

    if (action === "VERIFY") {
      await this.db.update(venues).set({
        verificationStatus: "VERIFIED",
        verifiedAt: now,
        verifiedByUserId: actorUserId,
        updatedAt: now,
      }).where(eq(venues.id, venueId));
    } else if (action === "REJECT") {
      await this.db.update(venues).set({
        verificationStatus: "REJECTED",
        verifiedAt: null,
        verifiedByUserId: actorUserId,
        updatedAt: now,
      }).where(eq(venues.id, venueId));
    } else if (action === "SUSPEND") {
      await this.db.update(venues).set({ status: "SUSPENDED", updatedAt: now }).where(eq(venues.id, venueId));
    } else {
      const [subscription] = await this.db
        .select()
        .from(venueSubscriptions)
        .where(eq(venueSubscriptions.venueId, venueId))
        .limit(1);
      const restoredStatus = hasPremiumWriteAccess(subscription ?? null, now)
        ? "ACTIVE"
        : venue.setupCompletedAt
          ? "READY"
          : "DRAFT";
      await this.db.update(venues).set({ status: restoredStatus, updatedAt: now }).where(eq(venues.id, venueId));
    }

    const auditAction = {
      VERIFY: "VENUE_VERIFIED",
      REJECT: "VENUE_VERIFICATION_REJECTED",
      SUSPEND: "VENUE_SUSPENDED",
      RESTORE: "VENUE_RESTORED",
    }[action];
    await this.db.insert(auditLogs).values({
      actorUserId,
      action: auditAction,
      targetType: "VENUE",
      targetId: venueId,
      metadata: { reason, previousStatus: venue.status, previousVerificationStatus: venue.verificationStatus },
      createdAt: now,
    });
  }

  async activateSubscription(input: {
    actorUserId: string;
    venueId: string;
    months: number;
    amountAfn: number;
    provider: string;
    providerReference: string | null;
    note: string | null;
    now: Date;
  }) {
    try {
      await this.db.transaction(async (tx) => {
        const [venue] = await tx.select().from(venues).where(eq(venues.id, input.venueId)).limit(1);
        if (!venue) throw errors.badRequest("VENUE_NOT_FOUND", "Venue not found.");

        const [current] = await tx
          .select()
          .from(venueSubscriptions)
          .where(eq(venueSubscriptions.venueId, input.venueId))
          .limit(1);
        const startsAt = current?.status === "ACTIVE" && current.activeUntil && current.activeUntil.getTime() > input.now.getTime()
          ? current.activeUntil
          : input.now;
        const endsAt = addMonthsUtc(startsAt, input.months);

        await tx.insert(subscriptionPayments).values({
          venueId: input.venueId,
          amountAfn: input.amountAfn,
          periodStartsAt: startsAt,
          periodEndsAt: endsAt,
          provider: input.provider,
          providerReference: input.providerReference,
          note: input.note,
          recordedByUserId: input.actorUserId,
          createdAt: input.now,
        });

        await tx.insert(venueSubscriptions).values({
          venueId: input.venueId,
          status: "ACTIVE",
          trialStartedAt: current?.trialStartedAt ?? null,
          trialEndsAt: current?.trialEndsAt ?? null,
          activeUntil: endsAt,
          updatedAt: input.now,
        }).onConflictDoUpdate({
          target: venueSubscriptions.venueId,
          set: {
            status: "ACTIVE",
            activeUntil: endsAt,
            cancelledAt: null,
            updatedAt: input.now,
          },
        });

        if (venue.status !== "SUSPENDED") {
          await tx.update(venues).set({ status: "ACTIVE", updatedAt: input.now }).where(eq(venues.id, input.venueId));
        }

        await tx.insert(auditLogs).values({
          actorUserId: input.actorUserId,
          action: "SUBSCRIPTION_ACTIVATED",
          targetType: "VENUE",
          targetId: input.venueId,
          metadata: {
            months: input.months,
            amountAfn: input.amountAfn,
            provider: input.provider,
            providerReference: input.providerReference,
            periodStartsAt: startsAt.toISOString(),
            periodEndsAt: endsAt.toISOString(),
          },
          createdAt: input.now,
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw errors.conflict("PAYMENT_REFERENCE_EXISTS", "That payment provider reference has already been recorded.");
      }
      throw error;
    }
  }

  async extendTrial(actorUserId: string, venueId: string, hours: number, reason: string, now: Date) {
    const [current] = await this.db
      .select()
      .from(venueSubscriptions)
      .where(eq(venueSubscriptions.venueId, venueId))
      .limit(1);
    if (!current) throw errors.badRequest("TRIAL_NOT_FOUND", "This venue has no trial to extend.");
    if (current.status === "ACTIVE" && (!current.activeUntil || current.activeUntil.getTime() > now.getTime())) {
      throw errors.conflict("PAID_SUBSCRIPTION_ACTIVE", "An active paid subscription does not need a trial extension.");
    }

    const base = current.trialEndsAt && current.trialEndsAt.getTime() > now.getTime() ? current.trialEndsAt : now;
    const trialEndsAt = new Date(base.getTime() + hours * 60 * 60 * 1000);
    await this.db.transaction(async (tx) => {
      await tx.update(venueSubscriptions).set({
        status: "TRIAL",
        trialStartedAt: current.trialStartedAt ?? now,
        trialEndsAt,
        activeUntil: null,
        cancelledAt: null,
        updatedAt: now,
      }).where(eq(venueSubscriptions.venueId, venueId));
      const [venue] = await tx.select({ status: venues.status }).from(venues).where(eq(venues.id, venueId)).limit(1);
      if (venue && venue.status !== "SUSPENDED") {
        await tx.update(venues).set({ status: "ACTIVE", updatedAt: now }).where(eq(venues.id, venueId));
      }
      await tx.insert(auditLogs).values({
        actorUserId,
        action: "TRIAL_EXTENDED",
        targetType: "VENUE",
        targetId: venueId,
        metadata: { hours, reason, trialEndsAt: trialEndsAt.toISOString() },
        createdAt: now,
      });
    });
  }

  async voidPayment(actorUserId: string, paymentId: string, reason: string, now: Date) {
    const [updated] = await this.db.update(subscriptionPayments).set({
      status: "VOIDED",
      voidedAt: now,
      voidedByUserId: actorUserId,
    }).where(eq(subscriptionPayments.id, paymentId)).returning({ id: subscriptionPayments.id });
    if (!updated) throw errors.badRequest("PAYMENT_NOT_FOUND", "Payment record not found.");
    await this.db.insert(auditLogs).values({
      actorUserId,
      action: "PAYMENT_VOIDED",
      targetType: "SUBSCRIPTION_PAYMENT",
      targetId: paymentId,
      metadata: { reason },
      createdAt: now,
    });
  }

  async updateSettings(
    actorUserId: string,
    input: {
      monthlyPriceAfn: number;
      annualPriceAfn: number;
      trialDurationHours: number;
      featureFlags: Record<string, boolean>;
      notificationTemplates: Record<string, string>;
    },
    now: Date,
  ): Promise<CommercialSettingsRecord> {
    const [row] = await this.db.insert(platformSettings).values({
      id: "default",
      ...input,
      updatedByUserId: actorUserId,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: platformSettings.id,
      set: {
        ...input,
        updatedByUserId: actorUserId,
        updatedAt: now,
      },
    }).returning();

    if (!row) throw new Error("Platform settings could not be saved.");
    await this.db.insert(auditLogs).values({
      actorUserId,
      action: "PLATFORM_SETTINGS_UPDATED",
      targetType: "PLATFORM_SETTINGS",
      targetId: "default",
      metadata: input,
      createdAt: now,
    });
    return {
      monthlyPriceAfn: row.monthlyPriceAfn,
      annualPriceAfn: row.annualPriceAfn,
      trialDurationHours: row.trialDurationHours,
      featureFlags: row.featureFlags,
      notificationTemplates: row.notificationTemplates,
      updatedAt: row.updatedAt,
    };
  }

  async listAuditLogs() {
    const rows = await this.db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
    return rows.map(auditDto);
  }

  async addSupportNote(
    actorUserId: string,
    targetType: "USER" | "VENUE",
    targetId: string,
    note: string,
    now: Date,
  ) {
    await this.db.insert(auditLogs).values({
      actorUserId,
      action: "SUPPORT_NOTE_ADDED",
      targetType,
      targetId,
      metadata: { note },
      createdAt: now,
    });
  }

  async unpublishPost(actorUserId: string, postId: string, reason: string, now: Date) {
    const [updated] = await this.db.update(venuePosts).set({
      status: "UNPUBLISHED",
      unpublishedAt: now,
      updatedAt: now,
    }).where(eq(venuePosts.id, postId)).returning({ id: venuePosts.id });
    if (!updated) throw errors.badRequest("POST_NOT_FOUND", "Post not found.");
    await this.db.insert(auditLogs).values({
      actorUserId,
      action: "POST_MODERATED_UNPUBLISHED",
      targetType: "VENUE_POST",
      targetId: postId,
      metadata: { reason },
      createdAt: now,
    });
  }

  async closePromotion(actorUserId: string, promotionId: string, reason: string, now: Date) {
    const [updated] = await this.db.update(venuePromotions).set({
      status: "CLOSED",
      closedAt: now,
      closeReason: "ADMIN_MODERATION",
      updatedAt: now,
    }).where(eq(venuePromotions.id, promotionId)).returning({ id: venuePromotions.id });
    if (!updated) throw errors.badRequest("PROMOTION_NOT_FOUND", "Promotion not found.");
    await this.db.insert(auditLogs).values({
      actorUserId,
      action: "PROMOTION_MODERATED_CLOSED",
      targetType: "VENUE_PROMOTION",
      targetId: promotionId,
      metadata: { reason },
      createdAt: now,
    });
  }
}
