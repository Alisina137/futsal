import type { BookingDto, VenueOpeningHourInput } from "@leaguekick/contracts";
import type { Database } from "@leaguekick/database";
import {
  bookings,
  users,
  venueAreas,
  venueBlocks,
  venueOpeningHours,
  venuePromotions,
  venueSubscriptions,
  venues,
} from "@leaguekick/database";
import { and, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { errors } from "../../lib/errors.js";
import type {
  BookingRepository,
  BookingVenueRecord,
  CreateBookingRecordInput,
  OccupancyRecord,
} from "./booking.types.js";

type DbBookingProjection = {
  id: string;
  venueId: string;
  venueName: string;
  areaId: string;
  areaName: string;
  playerUserId: string | null;
  source: "ONLINE" | "MANUAL";
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  startsAt: Date;
  endsAt: Date;
  priceAfn: number;
  currency: string;
  customerName: string | null;
  customerPhone: string | null;
  playerName: string | null;
  playerPhone: string | null;
  note: string | null;
  cancellationPolicySnapshot: string;
  cancelledAt: Date | null;
  cancellationReason: string | null;
};

function bookingDto(row: DbBookingProjection): BookingDto {
  return {
    id: row.id,
    venueId: row.venueId,
    venueName: row.venueName,
    areaId: row.areaId,
    areaName: row.areaName,
    playerUserId: row.playerUserId,
    source: row.source,
    status: row.status,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    priceAfn: row.priceAfn,
    currency: "AFN",
    customerName: row.customerName ?? row.playerName,
    customerPhone: row.customerPhone ?? row.playerPhone,
    note: row.note,
    cancellationPolicySnapshot: row.cancellationPolicySnapshot,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancellationReason: row.cancellationReason,
  };
}

function mapHour(row: typeof venueOpeningHours.$inferSelect): VenueOpeningHourInput {
  return {
    dayOfWeek: row.dayOfWeek,
    isClosed: row.isClosed,
    opensAt: row.opensAt ? row.opensAt.slice(0, 5) : null,
    closesAt: row.closesAt ? row.closesAt.slice(0, 5) : null,
  };
}

export class DrizzleBookingRepository implements BookingRepository {
  constructor(private readonly db: Database) {}

  private async hydrateVenue(row: typeof venues.$inferSelect): Promise<BookingVenueRecord> {
    const [areas, hours, subscriptionRows] = await Promise.all([
      this.db.select().from(venueAreas).where(eq(venueAreas.venueId, row.id)),
      this.db.select().from(venueOpeningHours).where(eq(venueOpeningHours.venueId, row.id)),
      this.db.select().from(venueSubscriptions).where(eq(venueSubscriptions.venueId, row.id)).limit(1),
    ]);
    const subscription = subscriptionRows[0];
    return {
      id: row.id,
      ownerUserId: row.ownerUserId,
      name: row.name,
      province: row.province,
      city: row.city,
      address: row.address,
      publicPhone: row.publicPhone,
      latitude: row.latitude,
      longitude: row.longitude,
      timezone: row.timezone,
      bookingMode: row.bookingMode,
      cancellationPolicy: row.cancellationPolicy,
      status: row.status,
      areas: areas.map((area) => ({
        id: area.id,
        venueId: area.venueId,
        name: area.name,
        defaultSessionDurationMinutes: area.defaultSessionDurationMinutes,
        basePriceAfn: area.basePriceAfn,
        active: area.active,
      })),
      openingHours: hours.map(mapHour).sort((a, b) => a.dayOfWeek - b.dayOfWeek),
      subscription: subscription ? {
        status: subscription.status,
        trialEndsAt: subscription.trialEndsAt,
        activeUntil: subscription.activeUntil,
      } : null,
    };
  }

  async listPublicVenueRecords(filters: { city?: string; province?: string }): Promise<BookingVenueRecord[]> {
    const conditions = [eq(venues.status, "ACTIVE")];
    if (filters.city) conditions.push(eq(venues.city, filters.city));
    if (filters.province) conditions.push(eq(venues.province, filters.province));
    const rows = await this.db.select().from(venues).where(and(...conditions));
    return Promise.all(rows.map((row) => this.hydrateVenue(row)));
  }

  async getVenueRecord(venueId: string) {
    const [row] = await this.db.select().from(venues).where(eq(venues.id, venueId)).limit(1);
    return row ? this.hydrateVenue(row) : null;
  }

  async getVenueRecordByAreaId(areaId: string) {
    const [row] = await this.db.select({ venue: venues }).from(venueAreas)
      .innerJoin(venues, eq(venueAreas.venueId, venues.id))
      .where(eq(venueAreas.id, areaId))
      .limit(1);
    return row ? this.hydrateVenue(row.venue) : null;
  }

  async getOwnerVenueRecord(ownerUserId: string) {
    const [row] = await this.db.select().from(venues).where(eq(venues.ownerUserId, ownerUserId)).limit(1);
    return row ? this.hydrateVenue(row) : null;
  }

  async listActivePromotionPrices(venueId: string, startsAt: Date, endsAt: Date, now: Date) {
    return this.db.select({
      id: venuePromotions.id,
      areaId: venuePromotions.areaId,
      startsAt: venuePromotions.startsAt,
      endsAt: venuePromotions.endsAt,
      discountedPriceAfn: venuePromotions.discountedPriceAfn,
    }).from(venuePromotions).where(and(
      eq(venuePromotions.venueId, venueId),
      eq(venuePromotions.status, "ACTIVE"),
      gt(venuePromotions.endsAt, now),
      lt(venuePromotions.startsAt, endsAt),
      gt(venuePromotions.endsAt, startsAt),
    ));
  }

  async listOccupancies(venueId: string, startsAt: Date, endsAt: Date): Promise<OccupancyRecord[]> {
    const [bookingRows, blockRows] = await Promise.all([
      this.db.select({ areaId: bookings.areaId, startsAt: bookings.startsAt, endsAt: bookings.endsAt })
        .from(bookings)
        .where(and(
          eq(bookings.venueId, venueId),
          inArray(bookings.status, ["PENDING", "CONFIRMED"]),
          lt(bookings.startsAt, endsAt),
          gt(bookings.endsAt, startsAt),
        )),
      this.db.select({ areaId: venueBlocks.areaId, startsAt: venueBlocks.startsAt, endsAt: venueBlocks.endsAt })
        .from(venueBlocks)
        .where(and(eq(venueBlocks.venueId, venueId), lt(venueBlocks.startsAt, endsAt), gt(venueBlocks.endsAt, startsAt))),
    ]);
    return [
      ...bookingRows.map((row) => ({ ...row, kind: "BOOKING" as const })),
      ...blockRows.map((row) => ({ ...row, kind: "BLOCK" as const })),
    ];
  }

  private async projectBooking(bookingId: string): Promise<BookingDto> {
    const [row] = await this.db.select({
      id: bookings.id,
      venueId: bookings.venueId,
      venueName: venues.name,
      areaId: bookings.areaId,
      areaName: venueAreas.name,
      playerUserId: bookings.playerUserId,
      source: bookings.source,
      status: bookings.status,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      priceAfn: bookings.priceAfn,
      currency: bookings.currency,
      customerName: bookings.customerName,
      customerPhone: bookings.customerPhone,
      playerName: users.displayName,
      playerPhone: users.phoneE164,
      note: bookings.note,
      cancellationPolicySnapshot: bookings.cancellationPolicySnapshot,
      cancelledAt: bookings.cancelledAt,
      cancellationReason: bookings.cancellationReason,
    }).from(bookings)
      .innerJoin(venues, eq(bookings.venueId, venues.id))
      .innerJoin(venueAreas, eq(bookings.areaId, venueAreas.id))
      .leftJoin(users, eq(bookings.playerUserId, users.id))
      .where(eq(bookings.id, bookingId))
      .limit(1);
    if (!row) throw new Error("Booking could not be loaded.");
    return bookingDto(row);
  }

  private async overlapExists(tx: Parameters<Parameters<Database["transaction"]>[0]>[0], areaId: string, startsAt: Date, endsAt: Date) {
    const [bookingOverlap] = await tx.select({ id: bookings.id }).from(bookings).where(and(
      eq(bookings.areaId, areaId),
      inArray(bookings.status, ["PENDING", "CONFIRMED"]),
      lt(bookings.startsAt, endsAt),
      gt(bookings.endsAt, startsAt),
    )).limit(1);
    if (bookingOverlap) return true;

    const [blockOverlap] = await tx.select({ id: venueBlocks.id }).from(venueBlocks).where(and(
      eq(venueBlocks.areaId, areaId),
      lt(venueBlocks.startsAt, endsAt),
      gt(venueBlocks.endsAt, startsAt),
    )).limit(1);
    return Boolean(blockOverlap);
  }

  async createBookingAtomic(input: CreateBookingRecordInput): Promise<BookingDto> {
    const bookingId = await this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.areaId}))`);

      if (input.idempotencyKey) {
        const [existing] = await tx.select({ id: bookings.id }).from(bookings).where(and(
          eq(bookings.createdByUserId, input.createdByUserId),
          eq(bookings.idempotencyKey, input.idempotencyKey),
        )).limit(1);
        if (existing) return existing.id;
      }

      if (await this.overlapExists(tx, input.areaId, input.startsAt, input.endsAt)) {
        throw errors.conflict("SLOT_UNAVAILABLE", "That time is no longer available.");
      }

      const [created] = await tx.insert(bookings).values({
        venueId: input.venueId,
        areaId: input.areaId,
        playerUserId: input.playerUserId,
        createdByUserId: input.createdByUserId,
        source: input.source,
        status: input.status,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        priceAfn: input.priceAfn,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        note: input.note,
        cancellationPolicySnapshot: input.cancellationPolicySnapshot,
        idempotencyKey: input.idempotencyKey,
      }).returning({ id: bookings.id });
      if (!created) throw new Error("Booking could not be created.");

      const closedAt = new Date();
      await tx.update(venuePromotions).set({
        status: "CLOSED",
        closedAt,
        closeReason: "BOOKED",
        updatedAt: closedAt,
      }).where(and(
        eq(venuePromotions.areaId, input.areaId),
        eq(venuePromotions.status, "ACTIVE"),
        lt(venuePromotions.startsAt, input.endsAt),
        gt(venuePromotions.endsAt, input.startsAt),
      ));

      return created.id;
    });
    return this.projectBooking(bookingId);
  }

  async createBlockAtomic(input: {
    venueId: string;
    areaId: string;
    ownerUserId: string;
    startsAt: Date;
    endsAt: Date;
    reason: string | null;
  }) {
    const blockId = await this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.areaId}))`);
      if (await this.overlapExists(tx, input.areaId, input.startsAt, input.endsAt)) {
        throw errors.conflict("SLOT_UNAVAILABLE", "That time is already occupied.");
      }
      const [created] = await tx.insert(venueBlocks).values({
        venueId: input.venueId,
        areaId: input.areaId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        reason: input.reason,
        createdByUserId: input.ownerUserId,
      }).returning({ id: venueBlocks.id });
      if (!created) throw new Error("Block could not be created.");

      const closedAt = new Date();
      await tx.update(venuePromotions).set({
        status: "CLOSED",
        closedAt,
        closeReason: "BLOCKED",
        updatedAt: closedAt,
      }).where(and(
        eq(venuePromotions.areaId, input.areaId),
        eq(venuePromotions.status, "ACTIVE"),
        lt(venuePromotions.startsAt, input.endsAt),
        gt(venuePromotions.endsAt, input.startsAt),
      ));

      return created.id;
    });

    const [row] = await this.db.select({
      id: venueBlocks.id,
      venueId: venueBlocks.venueId,
      areaId: venueBlocks.areaId,
      areaName: venueAreas.name,
      startsAt: venueBlocks.startsAt,
      endsAt: venueBlocks.endsAt,
      reason: venueBlocks.reason,
    }).from(venueBlocks)
      .innerJoin(venueAreas, eq(venueBlocks.areaId, venueAreas.id))
      .where(eq(venueBlocks.id, blockId))
      .limit(1);
    if (!row) throw new Error("Block could not be loaded.");
    return { ...row, startsAt: row.startsAt.toISOString(), endsAt: row.endsAt.toISOString() };
  }

  async deleteBlock(ownerUserId: string, blockId: string): Promise<boolean> {
    const [owned] = await this.db.select({ id: venueBlocks.id }).from(venueBlocks)
      .innerJoin(venues, eq(venueBlocks.venueId, venues.id))
      .where(and(eq(venueBlocks.id, blockId), eq(venues.ownerUserId, ownerUserId)))
      .limit(1);
    if (!owned) return false;
    const deleted = await this.db.delete(venueBlocks).where(eq(venueBlocks.id, blockId)).returning({ id: venueBlocks.id });
    return deleted.length > 0;
  }

  async getBooking(bookingId: string) {
    try { return await this.projectBooking(bookingId); }
    catch { return null; }
  }

  async getBookingByIdempotency(createdByUserId: string, idempotencyKey: string) {
    const [row] = await this.db.select({ id: bookings.id }).from(bookings).where(and(
      eq(bookings.createdByUserId, createdByUserId),
      eq(bookings.idempotencyKey, idempotencyKey),
    )).limit(1);
    return row ? this.projectBooking(row.id) : null;
  }

  private bookingProjectionQuery() {
    return this.db.select({
      id: bookings.id,
      venueId: bookings.venueId,
      venueName: venues.name,
      areaId: bookings.areaId,
      areaName: venueAreas.name,
      playerUserId: bookings.playerUserId,
      source: bookings.source,
      status: bookings.status,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      priceAfn: bookings.priceAfn,
      currency: bookings.currency,
      customerName: bookings.customerName,
      customerPhone: bookings.customerPhone,
      playerName: users.displayName,
      playerPhone: users.phoneE164,
      note: bookings.note,
      cancellationPolicySnapshot: bookings.cancellationPolicySnapshot,
      cancelledAt: bookings.cancelledAt,
      cancellationReason: bookings.cancellationReason,
    }).from(bookings)
      .innerJoin(venues, eq(bookings.venueId, venues.id))
      .innerJoin(venueAreas, eq(bookings.areaId, venueAreas.id))
      .leftJoin(users, eq(bookings.playerUserId, users.id));
  }

  async listPlayerBookings(playerUserId: string) {
    const rows = await this.bookingProjectionQuery().where(eq(bookings.playerUserId, playerUserId));
    return rows.map(bookingDto).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  async listVenueBookings(venueId: string, startsAt: Date, endsAt: Date) {
    const rows = await this.bookingProjectionQuery().where(and(
      eq(bookings.venueId, venueId),
      lt(bookings.startsAt, endsAt),
      gt(bookings.endsAt, startsAt),
    ));
    return rows.map(bookingDto).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  async listVenueBlocks(venueId: string, startsAt: Date, endsAt: Date) {
    const rows = await this.db.select({
      id: venueBlocks.id,
      venueId: venueBlocks.venueId,
      areaId: venueBlocks.areaId,
      areaName: venueAreas.name,
      startsAt: venueBlocks.startsAt,
      endsAt: venueBlocks.endsAt,
      reason: venueBlocks.reason,
    }).from(venueBlocks)
      .innerJoin(venueAreas, eq(venueBlocks.areaId, venueAreas.id))
      .where(and(eq(venueBlocks.venueId, venueId), lt(venueBlocks.startsAt, endsAt), gt(venueBlocks.endsAt, startsAt)));
    return rows.map((row) => ({ ...row, startsAt: row.startsAt.toISOString(), endsAt: row.endsAt.toISOString() }))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  async cancelBooking(input: { bookingId: string; cancelledByUserId: string; reason: string | null; cancelledAt: Date }) {
    const [updated] = await this.db.update(bookings).set({
      status: "CANCELLED",
      cancelledAt: input.cancelledAt,
      cancelledByUserId: input.cancelledByUserId,
      cancellationReason: input.reason,
      updatedAt: input.cancelledAt,
    }).where(eq(bookings.id, input.bookingId)).returning({ id: bookings.id });
    if (!updated) throw errors.badRequest("BOOKING_NOT_FOUND", "The booking was not found.");
    return this.projectBooking(updated.id);
  }
}
