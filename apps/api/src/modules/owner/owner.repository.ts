import type { OwnerVenueSetupRequest, VenueOpeningHourInput } from "@leaguekick/contracts";
import type { Database } from "@leaguekick/database";
import {
  venueAreas,
  venueOpeningHours,
  venueSubscriptions,
  roleSubscriptions,
  venueReferees,
  venueTrialClaims,
  venues,
  users,
} from "@leaguekick/database";
import { and, eq, gt, or } from "drizzle-orm";
import { errors } from "../../lib/errors.js";
import type { OwnerAggregate, OwnerOnboardingRepository, OwnerSubscriptionRecord, OwnerVenueRecord } from "./owner.types.js";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}

function trimDbTime(value: string | null): string | null {
  return value ? value.slice(0, 5) : null;
}

export class DrizzleOwnerOnboardingRepository implements OwnerOnboardingRepository {
  constructor(private readonly db: Database) {}

  private async hydrateVenue(row: typeof venues.$inferSelect): Promise<OwnerVenueRecord> {
    const [areas, hours] = await Promise.all([
      this.db.select().from(venueAreas).where(and(
        eq(venueAreas.venueId, row.id),
        eq(venueAreas.active, true),
      )),
      this.db.select().from(venueOpeningHours).where(eq(venueOpeningHours.venueId, row.id)),
    ]);

    return {
      id: row.id,
      ownerUserId: row.ownerUserId,
      name: row.name,
      publicPhone: row.publicPhone,
      whatsappPhone: row.whatsappPhone,
      province: row.province,
      city: row.city,
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
      timezone: row.timezone,
      bookingMode: row.bookingMode,
      onlineBookingEnabled: row.onlineBookingEnabled,
      minimumBookingNoticeMinutes: row.minimumBookingNoticeMinutes,
      maximumAdvanceBookingDays: row.maximumAdvanceBookingDays,
      cancellationPolicy: row.cancellationPolicy,
      verificationStatus: row.verificationStatus,
      status: row.status,
      setupCompletedAt: row.setupCompletedAt,
      areas: areas.map((area) => ({
        id: area.id,
        name: area.name,
        defaultSessionDurationMinutes: area.defaultSessionDurationMinutes,
        basePriceAfn: area.basePriceAfn,
      })),
      openingHours: hours
        .map((hour): VenueOpeningHourInput => ({
          dayOfWeek: hour.dayOfWeek,
          isClosed: hour.isClosed,
          opensAt: trimDbTime(hour.opensAt),
          closesAt: trimDbTime(hour.closesAt),
        }))
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek),
    };
  }

  private toSubscription(row: typeof venueSubscriptions.$inferSelect | undefined): OwnerSubscriptionRecord | null {
    if (!row) return null;
    return {
      venueId: row.venueId,
      status: row.status,
      trialStartedAt: row.trialStartedAt,
      trialEndsAt: row.trialEndsAt,
      activeUntil: row.activeUntil,
    };
  }

  async getByOwnerId(ownerUserId: string): Promise<OwnerAggregate | null> {
    const [row] = await this.db.select().from(venues).where(eq(venues.ownerUserId, ownerUserId)).limit(1);
    if (!row) return null;
    const [subscription] = await this.db.select().from(venueSubscriptions).where(eq(venueSubscriptions.venueId, row.id)).limit(1);
    return {
      venue: await this.hydrateVenue(row),
      subscription: this.toSubscription(subscription),
    };
  }

  async saveSetup(input: {
    ownerUserId: string;
    setup: OwnerVenueSetupRequest;
    publicPhone: string;
    whatsappPhone: string | null;
    completedAt: Date;
  }): Promise<OwnerAggregate> {
    await this.db.transaction(async (tx) => {
      const [existing] = await tx.select().from(venues).where(eq(venues.ownerUserId, input.ownerUserId)).limit(1);
      const status = existing?.status === "ACTIVE" || existing?.status === "SUSPENDED" ? existing.status : "READY";
      let venueId: string;

      if (existing) {
        const [updated] = await tx.update(venues).set({
          name: input.setup.venue.name.trim(),
          publicPhone: input.publicPhone,
          whatsappPhone: input.whatsappPhone,
          province: input.setup.venue.province.trim(),
          city: input.setup.venue.city.trim(),
          address: input.setup.venue.address.trim(),
          latitude: input.setup.venue.latitude ?? null,
          longitude: input.setup.venue.longitude ?? null,
          status,
          setupCompletedAt: existing.setupCompletedAt ?? input.completedAt,
          updatedAt: input.completedAt,
        }).where(eq(venues.id, existing.id)).returning({ id: venues.id });
        if (!updated) throw new Error("Failed to update venue setup.");
        venueId = updated.id;
      } else {
        const [created] = await tx.insert(venues).values({
          ownerUserId: input.ownerUserId,
          name: input.setup.venue.name.trim(),
          publicPhone: input.publicPhone,
          whatsappPhone: input.whatsappPhone,
          province: input.setup.venue.province.trim(),
          city: input.setup.venue.city.trim(),
          address: input.setup.venue.address.trim(),
          latitude: input.setup.venue.latitude ?? null,
          longitude: input.setup.venue.longitude ?? null,
          status: "READY",
          setupCompletedAt: input.completedAt,
        }).returning({ id: venues.id });
        if (!created) throw new Error("Failed to create venue.");
        venueId = created.id;
      }

      const courtInput = input.setup.areas[0]!;
      const existingCourts = await tx.select().from(venueAreas)
        .where(eq(venueAreas.venueId, venueId))
        .orderBy(venueAreas.createdAt);
      const activeCourt = existingCourts.find((court) => court.active) ?? existingCourts[0] ?? null;

      if (activeCourt) {
        await tx.update(venueAreas).set({
          name: courtInput.name.trim(),
          defaultSessionDurationMinutes: courtInput.defaultSessionDurationMinutes,
          basePriceAfn: courtInput.basePriceAfn,
          active: true,
          updatedAt: input.completedAt,
        }).where(eq(venueAreas.id, activeCourt.id));

        await tx.update(venueAreas).set({
          active: false,
          updatedAt: input.completedAt,
        }).where(and(
          eq(venueAreas.venueId, venueId),
          // The selected court stays active; historical extra courts remain preserved but inactive.
          // Drizzle has no != import in this repository, so deactivate extras one by one below.
          eq(venueAreas.active, true),
        ));
        await tx.update(venueAreas).set({
          active: true,
          updatedAt: input.completedAt,
        }).where(eq(venueAreas.id, activeCourt.id));
      } else {
        await tx.insert(venueAreas).values({
          venueId,
          name: courtInput.name.trim(),
          defaultSessionDurationMinutes: courtInput.defaultSessionDurationMinutes,
          basePriceAfn: courtInput.basePriceAfn,
          active: true,
        });
      }

      await tx.delete(venueOpeningHours).where(eq(venueOpeningHours.venueId, venueId));

      await tx.insert(venueOpeningHours).values(input.setup.openingHours.map((hour) => ({
        venueId,
        dayOfWeek: hour.dayOfWeek,
        isClosed: hour.isClosed,
        opensAt: hour.isClosed ? null : hour.opensAt,
        closesAt: hour.isClosed ? null : hour.closesAt,
      })));

      const [paidOwner] = await tx.select({ activeUntil: roleSubscriptions.activeUntil })
        .from(roleSubscriptions)
        .where(and(
          eq(roleSubscriptions.userId, input.ownerUserId),
          eq(roleSubscriptions.role, "VENUE_OWNER"),
          eq(roleSubscriptions.status, "ACTIVE"),
          gt(roleSubscriptions.activeUntil, input.completedAt),
        ))
        .limit(1);
      if (paidOwner?.activeUntil) {
        await tx.insert(venueSubscriptions).values({
          venueId,
          status: "ACTIVE",
          trialStartedAt: null,
          trialEndsAt: null,
          activeUntil: paidOwner.activeUntil,
          cancelledAt: null,
          updatedAt: input.completedAt,
        }).onConflictDoUpdate({
          target: venueSubscriptions.venueId,
          set: {
            status: "ACTIVE",
            trialStartedAt: null,
            trialEndsAt: null,
            activeUntil: paidOwner.activeUntil,
            cancelledAt: null,
            updatedAt: input.completedAt,
          },
        });
      }
    });

    const aggregate = await this.getByOwnerId(input.ownerUserId);
    if (!aggregate) throw new Error("Venue setup could not be loaded after save.");
    return aggregate;
  }

  async updateVenueSettings(input: {
    ownerUserId: string;
    settings: import("@leaguekick/contracts").OwnerVenueSettingsUpdateRequest;
    publicPhone: string;
    whatsappPhone: string | null;
    updatedAt: Date;
  }): Promise<OwnerAggregate> {
    await this.db.transaction(async (tx) => {
      const [venue] = await tx.select().from(venues)
        .where(eq(venues.ownerUserId, input.ownerUserId))
        .limit(1);
      if (!venue) throw errors.badRequest("VENUE_REQUIRED", "Complete venue setup first.");

      await tx.update(venues).set({
        publicPhone: input.publicPhone,
        whatsappPhone: input.whatsappPhone,
        latitude: input.settings.latitude,
        longitude: input.settings.longitude,
        bookingMode: input.settings.bookingMode,
        onlineBookingEnabled: input.settings.onlineBookingEnabled,
        minimumBookingNoticeMinutes: input.settings.minimumBookingNoticeMinutes,
        maximumAdvanceBookingDays: input.settings.maximumAdvanceBookingDays,
        cancellationPolicy: input.settings.cancellationPolicy.trim(),
        updatedAt: input.updatedAt,
      }).where(eq(venues.id, venue.id));

      const [court] = await tx.select().from(venueAreas)
        .where(and(eq(venueAreas.venueId, venue.id), eq(venueAreas.active, true)))
        .limit(1);
      if (!court) throw errors.badRequest("COURT_REQUIRED", "This venue does not have an active court.");

      await tx.update(venueAreas).set({
        name: input.settings.courtName.trim(),
        defaultSessionDurationMinutes: input.settings.defaultSessionDurationMinutes,
        basePriceAfn: input.settings.basePriceAfn,
        updatedAt: input.updatedAt,
      }).where(eq(venueAreas.id, court.id));
    });

    const aggregate = await this.getByOwnerId(input.ownerUserId);
    if (!aggregate) throw new Error("Venue settings could not be loaded after save.");
    return aggregate;
  }

  async startTrial(input: {
    ownerUserId: string;
    venueId: string;
    identityHash: string;
    startedAt: Date;
    endsAt: Date;
  }): Promise<OwnerSubscriptionRecord> {
    try {
      const result = await this.db.transaction(async (tx) => {
        const [existing] = await tx.select().from(venueSubscriptions).where(eq(venueSubscriptions.venueId, input.venueId)).limit(1);
        if (existing) return existing;

        await tx.insert(venueTrialClaims).values({
          identityHash: input.identityHash,
          venueId: input.venueId,
          ownerUserId: input.ownerUserId,
          claimedAt: input.startedAt,
        });

        const [subscription] = await tx.insert(venueSubscriptions).values({
          venueId: input.venueId,
          status: "TRIAL",
          trialStartedAt: input.startedAt,
          trialEndsAt: input.endsAt,
          updatedAt: input.startedAt,
        }).returning();
        if (!subscription) throw new Error("Failed to start venue trial.");

        await tx.update(venues).set({ status: "ACTIVE", updatedAt: input.startedAt }).where(eq(venues.id, input.venueId));
        return subscription;
      });

      return {
        venueId: result.venueId,
        status: result.status,
        trialStartedAt: result.trialStartedAt,
        trialEndsAt: result.trialEndsAt,
        activeUntil: result.activeUntil,
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const [existing] = await this.db.select().from(venueSubscriptions).where(eq(venueSubscriptions.venueId, input.venueId)).limit(1);
        const current = this.toSubscription(existing);
        if (current) return current;
        throw errors.conflict("TRIAL_ALREADY_USED", "This physical venue has already used its Premium trial.");
      }
      throw error;
    }
  }

  async markExpired(venueId: string, expiredAt: Date): Promise<void> {
    await this.db.update(venueSubscriptions).set({ status: "EXPIRED", updatedAt: expiredAt }).where(eq(venueSubscriptions.venueId, venueId));
  }

  async resolveActiveUser(input: { usernameNormalized?: string; phoneE164?: string }) {
    if (!input.usernameNormalized && !input.phoneE164) return null;
    const condition = input.usernameNormalized && input.phoneE164
      ? or(eq(users.usernameNormalized, input.usernameNormalized), eq(users.phoneE164, input.phoneE164))
      : input.usernameNormalized
        ? eq(users.usernameNormalized, input.usernameNormalized)
        : eq(users.phoneE164, input.phoneE164!);
    const [row] = await this.db.select({
      id: users.id,
      displayName: users.displayName,
      username: users.username,
      phoneE164: users.phoneE164,
    }).from(users).where(and(eq(users.status, "ACTIVE"), condition)).limit(1);
    return row ?? null;
  }

  async listVenueReferees(venueId: string) {
    const rows = await this.db.select({
      venueId: venueReferees.venueId,
      userId: venueReferees.userId,
      displayName: users.displayName,
      username: users.username,
      phone: users.phoneE164,
      assignedAt: venueReferees.assignedAt,
    }).from(venueReferees)
      .innerJoin(users, eq(venueReferees.userId, users.id))
      .where(and(eq(venueReferees.venueId, venueId), eq(users.status, "ACTIVE")));
    return rows.map((row) => ({ ...row, assignedAt: row.assignedAt.toISOString() }));
  }

  async grantVenueReferee(input: { venueId: string; userId: string; assignedByUserId: string; assignedAt: Date }) {
    await this.db.insert(venueReferees).values(input).onConflictDoNothing();
  }

  async removeVenueReferee(venueId: string, userId: string) {
    await this.db.delete(venueReferees).where(and(
      eq(venueReferees.venueId, venueId),
      eq(venueReferees.userId, userId),
    ));
  }
}
