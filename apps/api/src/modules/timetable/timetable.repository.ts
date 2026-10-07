import type { Database } from "@leaguekick/database";
import {
  bookings,
  competitionMatches,
  competitions,
  venueAreas,
  venueBlocks,
  venuePromotions,
  venues,
  venueTimetableExceptions,
  venueTimetablePeriods,
  venueTimetables,
} from "@leaguekick/database";
import { and, eq, gte, inArray, lte, lt, gt } from "drizzle-orm";
import type {
  TimetableExceptionRecord,
  TimetableOccupancyRecord,
  TimetableRecord,
  TimetableRepository,
  TimetableVenueRecord,
} from "./timetable.types.js";

function period(row: typeof venueTimetablePeriods.$inferSelect) {
  return {
    areaId: row.areaId,
    dayOfWeek: row.dayOfWeek,
    startsAt: row.startsAt.slice(0, 5),
    endsAt: row.endsAt.slice(0, 5),
    priceAfn: row.priceAfn,
  };
}

function exception(row: typeof venueTimetableExceptions.$inferSelect): TimetableExceptionRecord {
  return {
    id: row.id,
    venueId: row.venueId,
    areaId: row.areaId,
    date: row.date,
    isClosed: row.isClosed,
    periods: row.periods,
    note: row.note,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleTimetableRepository implements TimetableRepository {
  constructor(private readonly db: Database) {}

  private async hydrateTimetable(row: typeof venueTimetables.$inferSelect): Promise<TimetableRecord> {
    const periods = await this.db.select()
      .from(venueTimetablePeriods)
      .where(eq(venueTimetablePeriods.timetableId, row.id));
    return {
      id: row.id,
      venueId: row.venueId,
      name: row.name,
      status: row.status,
      effectiveFrom: row.effectiveFrom,
      effectiveUntil: row.effectiveUntil,
      defaultSlotDurationMinutes: row.defaultSlotDurationMinutes,
      bufferMinutes: row.bufferMinutes,
      createdByUserId: row.createdByUserId,
      publishedAt: row.publishedAt,
      archivedAt: row.archivedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      periods: periods.map(period).sort((a, b) =>
        a.dayOfWeek - b.dayOfWeek
        || (a.areaId ?? "").localeCompare(b.areaId ?? "")
        || a.startsAt.localeCompare(b.startsAt)
      ),
    };
  }

  private async venue(row: typeof venues.$inferSelect): Promise<TimetableVenueRecord> {
    const areas = await this.db.select().from(venueAreas).where(and(
      eq(venueAreas.venueId, row.id),
      eq(venueAreas.active, true),
    ));
    return {
      id: row.id,
      ownerUserId: row.ownerUserId,
      timezone: row.timezone,
      areas: areas.map((area) => ({
        id: area.id,
        name: area.name,
        active: area.active,
        defaultSessionDurationMinutes: area.defaultSessionDurationMinutes,
        basePriceAfn: area.basePriceAfn,
      })),
    };
  }

  async getVenueByOwner(ownerUserId: string) {
    const [row] = await this.db.select().from(venues).where(eq(venues.ownerUserId, ownerUserId)).limit(1);
    return row ? this.venue(row) : null;
  }

  async getVenue(venueId: string) {
    const [row] = await this.db.select().from(venues).where(eq(venues.id, venueId)).limit(1);
    return row ? this.venue(row) : null;
  }

  async listTimetables(venueId: string) {
    const rows = await this.db.select().from(venueTimetables).where(eq(venueTimetables.venueId, venueId));
    return Promise.all(rows.map((row) => this.hydrateTimetable(row)));
  }

  async getTimetable(timetableId: string) {
    const [row] = await this.db.select().from(venueTimetables).where(eq(venueTimetables.id, timetableId)).limit(1);
    return row ? this.hydrateTimetable(row) : null;
  }

  async createTimetable(input: {
    venueId: string;
    ownerUserId: string;
    draft: Parameters<TimetableRepository["createTimetable"]>[0]["draft"];
  }) {
    const timetableId = await this.db.transaction(async (tx) => {
      const [created] = await tx.insert(venueTimetables).values({
        venueId: input.venueId,
        name: input.draft.name,
        status: "DRAFT",
        effectiveFrom: input.draft.effectiveFrom,
        effectiveUntil: input.draft.effectiveUntil,
        defaultSlotDurationMinutes: input.draft.defaultSlotDurationMinutes,
        bufferMinutes: input.draft.bufferMinutes,
        createdByUserId: input.ownerUserId,
      }).returning({ id: venueTimetables.id });
      if (!created) throw new Error("Timetable could not be created.");
      await tx.insert(venueTimetablePeriods).values(input.draft.periods.map((item) => ({
        timetableId: created.id,
        areaId: item.areaId,
        dayOfWeek: item.dayOfWeek,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        priceAfn: item.priceAfn,
      })));
      return created.id;
    });
    const result = await this.getTimetable(timetableId);
    if (!result) throw new Error("Timetable could not be loaded.");
    return result;
  }

  async updateDraft(input: {
    timetableId: string;
    venueId: string;
    draft: Parameters<TimetableRepository["updateDraft"]>[0]["draft"];
  }) {
    await this.db.transaction(async (tx) => {
      const [updated] = await tx.update(venueTimetables).set({
        name: input.draft.name,
        effectiveFrom: input.draft.effectiveFrom,
        effectiveUntil: input.draft.effectiveUntil,
        defaultSlotDurationMinutes: input.draft.defaultSlotDurationMinutes,
        bufferMinutes: input.draft.bufferMinutes,
        updatedAt: new Date(),
      }).where(and(
        eq(venueTimetables.id, input.timetableId),
        eq(venueTimetables.venueId, input.venueId),
        eq(venueTimetables.status, "DRAFT"),
      )).returning({ id: venueTimetables.id });
      if (!updated) throw new Error("Draft timetable not found.");
      await tx.delete(venueTimetablePeriods).where(eq(venueTimetablePeriods.timetableId, input.timetableId));
      await tx.insert(venueTimetablePeriods).values(input.draft.periods.map((item) => ({
        timetableId: input.timetableId,
        areaId: item.areaId,
        dayOfWeek: item.dayOfWeek,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        priceAfn: item.priceAfn,
      })));
    });
    const result = await this.getTimetable(input.timetableId);
    if (!result) throw new Error("Timetable could not be loaded.");
    return result;
  }

  async duplicateTimetable(input: { source: TimetableRecord; ownerUserId: string }) {
    return this.createTimetable({
      venueId: input.source.venueId,
      ownerUserId: input.ownerUserId,
      draft: {
        name: `${input.source.name} copy`,
        effectiveFrom: input.source.effectiveFrom,
        effectiveUntil: input.source.effectiveUntil,
        defaultSlotDurationMinutes: input.source.defaultSlotDurationMinutes,
        bufferMinutes: input.source.bufferMinutes,
        periods: input.source.periods,
      },
    });
  }

  async deleteDraft(timetableId: string, venueId: string) {
    const rows = await this.db.delete(venueTimetables).where(and(
      eq(venueTimetables.id, timetableId),
      eq(venueTimetables.venueId, venueId),
      eq(venueTimetables.status, "DRAFT"),
    )).returning({ id: venueTimetables.id });
    return rows.length > 0;
  }

  async publishTimetable(input: { timetableId: string; venueId: string; archiveIds: string[]; publishedAt: Date }) {
    await this.db.transaction(async (tx) => {
      if (input.archiveIds.length) {
        await tx.update(venueTimetables).set({
          status: "ARCHIVED",
          archivedAt: input.publishedAt,
          updatedAt: input.publishedAt,
        }).where(and(
          eq(venueTimetables.venueId, input.venueId),
          inArray(venueTimetables.id, input.archiveIds),
        ));
      }
      const [published] = await tx.update(venueTimetables).set({
        status: "PUBLISHED",
        publishedAt: input.publishedAt,
        archivedAt: null,
        updatedAt: input.publishedAt,
      }).where(and(
        eq(venueTimetables.id, input.timetableId),
        eq(venueTimetables.venueId, input.venueId),
        eq(venueTimetables.status, "DRAFT"),
      )).returning({ id: venueTimetables.id });
      if (!published) throw new Error("Draft timetable not found.");
    });
    const result = await this.getTimetable(input.timetableId);
    if (!result) throw new Error("Published timetable could not be loaded.");
    return result;
  }

  async truncatePublishedTimetable(input: {
    timetableId: string;
    venueId: string;
    effectiveUntil: string;
    updatedAt: Date;
  }) {
    await this.db.update(venueTimetables).set({
      effectiveUntil: input.effectiveUntil,
      updatedAt: input.updatedAt,
    }).where(and(
      eq(venueTimetables.id, input.timetableId),
      eq(venueTimetables.venueId, input.venueId),
      eq(venueTimetables.status, "PUBLISHED"),
    ));
  }

  async archiveTimetable(timetableId: string, venueId: string, archivedAt: Date) {
    const [row] = await this.db.update(venueTimetables).set({
      status: "ARCHIVED",
      archivedAt,
      updatedAt: archivedAt,
    }).where(and(
      eq(venueTimetables.id, timetableId),
      eq(venueTimetables.venueId, venueId),
      eq(venueTimetables.status, "PUBLISHED"),
    )).returning();
    return row ? this.hydrateTimetable(row) : null;
  }

  async listExceptions(venueId: string, from?: string, to?: string) {
    const conditions = [eq(venueTimetableExceptions.venueId, venueId)];
    if (from) conditions.push(gte(venueTimetableExceptions.date, from));
    if (to) conditions.push(lte(venueTimetableExceptions.date, to));
    const rows = await this.db.select().from(venueTimetableExceptions).where(and(...conditions));
    return rows.map(exception).sort((a, b) => a.date.localeCompare(b.date));
  }

  async createException(input: {
    venueId: string;
    ownerUserId: string;
    exception: Parameters<TimetableRepository["createException"]>[0]["exception"];
  }) {
    const [created] = await this.db.insert(venueTimetableExceptions).values({
      venueId: input.venueId,
      areaId: input.exception.areaId,
      date: input.exception.date,
      isClosed: input.exception.isClosed,
      periods: input.exception.periods,
      note: input.exception.note?.trim() || null,
      createdByUserId: input.ownerUserId,
    }).returning();
    if (!created) throw new Error("Timetable exception could not be created.");
    return exception(created);
  }

  async getException(exceptionId: string) {
    const [row] = await this.db.select()
      .from(venueTimetableExceptions)
      .where(eq(venueTimetableExceptions.id, exceptionId))
      .limit(1);
    return row ? exception(row) : null;
  }

  async updateException(input: {
    exceptionId: string;
    venueId: string;
    exception: Parameters<TimetableRepository["updateException"]>[0]["exception"];
  }) {
    const [updated] = await this.db.update(venueTimetableExceptions).set({
      areaId: input.exception.areaId,
      date: input.exception.date,
      isClosed: input.exception.isClosed,
      periods: input.exception.periods,
      note: input.exception.note?.trim() || null,
      updatedAt: new Date(),
    }).where(and(
      eq(venueTimetableExceptions.id, input.exceptionId),
      eq(venueTimetableExceptions.venueId, input.venueId),
    )).returning();
    return updated ? exception(updated) : null;
  }

  async deleteException(exceptionId: string, venueId: string) {
    const rows = await this.db.delete(venueTimetableExceptions).where(and(
      eq(venueTimetableExceptions.id, exceptionId),
      eq(venueTimetableExceptions.venueId, venueId),
    )).returning({ id: venueTimetableExceptions.id });
    return rows.length > 0;
  }

  async listOccupancies(venueId: string, startsAt: Date, endsAt: Date): Promise<TimetableOccupancyRecord[]> {
    const [bookingRows, blockRows, matchRows, promotionRows] = await Promise.all([
      this.db.select({
        id: bookings.id,
        areaId: bookings.areaId,
        areaName: venueAreas.name,
        startsAt: bookings.startsAt,
        endsAt: bookings.endsAt,
        priceAfn: bookings.priceAfn,
        source: bookings.source,
        customerName: bookings.customerName,
      }).from(bookings)
        .innerJoin(venueAreas, eq(bookings.areaId, venueAreas.id))
        .where(and(
          eq(bookings.venueId, venueId),
          inArray(bookings.status, ["PENDING", "CONFIRMED"]),
          lt(bookings.startsAt, endsAt),
          gt(bookings.endsAt, startsAt),
        )),
      this.db.select({
        id: venueBlocks.id,
        areaId: venueBlocks.areaId,
        areaName: venueAreas.name,
        startsAt: venueBlocks.startsAt,
        endsAt: venueBlocks.endsAt,
        reason: venueBlocks.reason,
      }).from(venueBlocks)
        .innerJoin(venueAreas, eq(venueBlocks.areaId, venueAreas.id))
        .where(and(eq(venueBlocks.venueId, venueId), lt(venueBlocks.startsAt, endsAt), gt(venueBlocks.endsAt, startsAt))),
      this.db.select({
        id: competitionMatches.id,
        areaId: competitionMatches.areaId,
        areaName: venueAreas.name,
        startsAt: competitionMatches.startsAt,
        endsAt: competitionMatches.endsAt,
        competitionName: competitions.name,
      }).from(competitionMatches)
        .innerJoin(competitions, eq(competitionMatches.competitionId, competitions.id))
        .innerJoin(venueAreas, eq(competitionMatches.areaId, venueAreas.id))
        .where(and(
          eq(competitionMatches.venueId, venueId),
          inArray(competitionMatches.status, ["SCHEDULED", "IN_PROGRESS", "COMPLETED"]),
          lt(competitionMatches.startsAt, endsAt),
          gt(competitionMatches.endsAt, startsAt),
        )),
      this.db.select({
        id: venuePromotions.id,
        areaId: venuePromotions.areaId,
        areaName: venueAreas.name,
        startsAt: venuePromotions.startsAt,
        endsAt: venuePromotions.endsAt,
        priceAfn: venuePromotions.discountedPriceAfn,
        title: venuePromotions.title,
      }).from(venuePromotions)
        .innerJoin(venueAreas, eq(venuePromotions.areaId, venueAreas.id))
        .where(and(
          eq(venuePromotions.venueId, venueId),
          eq(venuePromotions.status, "ACTIVE"),
          lt(venuePromotions.startsAt, endsAt),
          gt(venuePromotions.endsAt, startsAt),
        )),
    ]);

    return [
      ...bookingRows.map((row) => ({
        id: row.id,
        type: "BOOKING" as const,
        areaId: row.areaId,
        areaName: row.areaName,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        title: row.customerName || "Booking",
        priceAfn: row.priceAfn,
        source: row.source,
      })),
      ...blockRows.map((row) => ({
        id: row.id,
        type: "BLOCK" as const,
        areaId: row.areaId,
        areaName: row.areaName,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        title: row.reason || "Blocked",
        priceAfn: null,
      })),
      ...matchRows
        .filter((row): row is typeof row & { areaId: string; startsAt: Date; endsAt: Date } =>
          Boolean(row.areaId && row.startsAt && row.endsAt)
        )
        .map((row) => ({
          id: row.id,
          type: "COMPETITION_MATCH" as const,
          areaId: row.areaId,
          areaName: row.areaName,
          startsAt: row.startsAt,
          endsAt: row.endsAt,
          title: row.competitionName,
          priceAfn: null,
        })),
      ...promotionRows.map((row) => ({
        id: row.id,
        type: "PROMOTION" as const,
        areaId: row.areaId,
        areaName: row.areaName,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        title: row.title,
        priceAfn: row.priceAfn,
      })),
    ];
  }
}
