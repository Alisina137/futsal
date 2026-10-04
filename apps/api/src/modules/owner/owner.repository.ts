import type { OwnerVenueSetupRequest, VenueOpeningHourInput } from "@leaguekick/contracts";
import type { Database } from "@leaguekick/database";
import {
  venueAreas,
  venueOpeningHours,
  venueSubscriptions,
  venueTrialClaims,
  venues,
} from "@leaguekick/database";
import { eq } from "drizzle-orm";
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
      this.db.select().from(venueAreas).where(eq(venueAreas.venueId, row.id)),
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

      await tx.delete(venueAreas).where(eq(venueAreas.venueId, venueId));
      await tx.delete(venueOpeningHours).where(eq(venueOpeningHours.venueId, venueId));

      await tx.insert(venueAreas).values(input.setup.areas.map((area) => ({
        venueId,
        name: area.name.trim(),
        defaultSessionDurationMinutes: area.defaultSessionDurationMinutes,
        basePriceAfn: area.basePriceAfn,
      })));

      await tx.insert(venueOpeningHours).values(input.setup.openingHours.map((hour) => ({
        venueId,
        dayOfWeek: hour.dayOfWeek,
        isClosed: hour.isClosed,
        opensAt: hour.isClosed ? null : hour.opensAt,
        closesAt: hour.isClosed ? null : hour.closesAt,
      })));
    });

    const aggregate = await this.getByOwnerId(input.ownerUserId);
    if (!aggregate) throw new Error("Venue setup could not be loaded after save.");
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
        throw errors.conflict("TRIAL_ALREADY_USED", "This physical venue has already used its Premium trial.");
      }
      throw error;
    }
  }

  async expireTrial(venueId: string, expiredAt: Date): Promise<void> {
    await this.db.update(venueSubscriptions).set({ status: "EXPIRED", updatedAt: expiredAt }).where(eq(venueSubscriptions.venueId, venueId));
  }
}
