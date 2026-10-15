import type { BookingDto, VenueOpeningHourInput } from "@leaguekick/contracts";
import type { Database } from "@leaguekick/database";
import {
  bookings,
  competitionMatches,
  users,
  venueAreas,
  venueBlocks,
  venueOpeningHours,
  venuePromotions,
  socialFollows,
  venueReviews,
  venueSavedTimes,
  venueSlotWatches,
  venueSubscriptions,
  venues,
} from "@leaguekick/database";
import { and, asc, desc, eq, gt, gte, ilike, inArray, lt, ne, or, sql } from "drizzle-orm";
import { errors } from "../../lib/errors.js";
import type {
  BookingRepository,
  BookingVenueRecord,
  CreateBookingRecordInput,
  OccupancyRecord,
  OwnerBookingDirectoryFilters,
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

  async listReviewedBookingIds(userId:string,venueId:string){
    const rows=await this.db.select({bookingId:venueReviews.bookingId}).from(venueReviews)
      .where(and(eq(venueReviews.userId,userId),eq(venueReviews.venueId,venueId)));
    return rows.map(row=>row.bookingId);
  }
  async listVerifiedReviews(venueId:string,limit:number,page=1,sort:import("@leaguekick/contracts").VenueReviewSort="recent"){
    const [summary,stars,reviews]=await Promise.all([
      this.db.select({
        average:sql<number>`coalesce(avg(${venueReviews.rating}),0)::float8`,
        total:sql<number>`count(*)::int`,
      }).from(venueReviews).where(eq(venueReviews.venueId,venueId)).then(rows=>rows[0]),
      this.db.select({rating:venueReviews.rating,total:sql<number>`count(*)::int`})
        .from(venueReviews).where(eq(venueReviews.venueId,venueId)).groupBy(venueReviews.rating),
      this.db.select().from(venueReviews).where(eq(venueReviews.venueId,venueId))
        .orderBy(...(sort==="highest"
          ?[desc(venueReviews.rating),desc(venueReviews.createdAt),desc(venueReviews.id)]
          :sort==="lowest"
          ?[asc(venueReviews.rating),desc(venueReviews.createdAt),desc(venueReviews.id)]
          :[desc(venueReviews.createdAt),desc(venueReviews.id)]))
        .limit(limit).offset((page-1)*limit),
    ]);
    const count=Number(summary?.total??0);
    return {
      averageRating:Number(summary?.average??0),reviewCount:count,
      ratingCounts:[1,2,3,4,5].map(n=>Number(stars.find(row=>row.rating===n)?.total??0)),
      page,hasMore:page*limit<count,
      reviews:reviews.map(row=>({id:row.id,venueId:row.venueId,
        rating:row.rating,body:row.body,createdAt:row.createdAt.toISOString(),verified:true as const})),
    };
  }
  async createVerifiedReview(input:{venueId:string;bookingId:string;userId:string;
    rating:number;body:string;createdAt:Date}){
    const [created]=await this.db.insert(venueReviews).values(input)
      .onConflictDoNothing({target:venueReviews.bookingId}).returning();
    if(!created)throw errors.badRequest("ALREADY_REVIEWED","This booking already has a review.");
    return {id:created.id,venueId:created.venueId,
      rating:created.rating,body:created.body,createdAt:created.createdAt.toISOString(),
      verified:true as const};
  }
  async getSavedVenueTime(userId:string,venueId:string){
    const [row]=await this.db.select({value:venueSavedTimes.preferredStart})
      .from(venueSavedTimes).where(and(eq(venueSavedTimes.userId,userId),
        eq(venueSavedTimes.venueId,venueId))).limit(1);
    return row?.value.slice(0,5)??null;
  }
  async setSavedVenueTime(userId:string,venueId:string,time:string|null,now:Date){
    if(time===null){
      await this.db.delete(venueSavedTimes).where(and(eq(venueSavedTimes.userId,userId),
        eq(venueSavedTimes.venueId,venueId)));
      return;
    }
    await this.db.insert(venueSavedTimes).values({userId,venueId,preferredStart:time,updatedAt:now})
      .onConflictDoUpdate({target:[venueSavedTimes.userId,venueSavedTimes.venueId],
        set:{preferredStart:time,updatedAt:now}});
  }
  private watchDto(row:typeof venueSlotWatches.$inferSelect){
    return {id:row.id,venueId:row.venueId,areaId:row.areaId,
      startsAt:row.startsAt.toISOString(),expiresAt:row.expiresAt.toISOString()};
  }
  async watchVenueSlot(input:{userId:string;venueId:string;areaId:string;startsAt:Date;expiresAt:Date}){
    const [row]=await this.db.insert(venueSlotWatches).values(input)
      .onConflictDoUpdate({target:[venueSlotWatches.userId,venueSlotWatches.areaId,venueSlotWatches.startsAt],
        set:{expiresAt:input.expiresAt}}).returning();
    if(!row)throw new Error("Could not create slot alert");
    return this.watchDto(row);
  }
  async listMyVenueSlotWatches(userId:string,venueId:string,now:Date){
    const rows=await this.db.select().from(venueSlotWatches).where(and(
      eq(venueSlotWatches.userId,userId),eq(venueSlotWatches.venueId,venueId),
      gt(venueSlotWatches.expiresAt,now))).orderBy(venueSlotWatches.startsAt).limit(100);
    return rows.map(row=>this.watchDto(row));
  }
  async listVenueSlotWatches(areaId:string,startsAt:Date,now:Date){
    const rows=await this.db.select().from(venueSlotWatches).where(and(
      eq(venueSlotWatches.areaId,areaId),eq(venueSlotWatches.startsAt,startsAt),
      gt(venueSlotWatches.expiresAt,now))).limit(200);
    return rows.map(row=>({...this.watchDto(row),userId:row.userId}));
  }
  async removeVenueSlotWatch(userId:string,watchId:string){
    const rows=await this.db.delete(venueSlotWatches).where(and(
      eq(venueSlotWatches.userId,userId),eq(venueSlotWatches.id,watchId)))
      .returning({id:venueSlotWatches.id});
    return rows.length>0;
  }

  async countVenueFollowers(){
    const rows=await this.db.select({venueId:socialFollows.entityId,
      followers:sql<number>`count(*)::integer`}).from(socialFollows)
      .where(eq(socialFollows.entityType,"VENUE")).groupBy(socialFollows.entityId);
    return new Map(rows.map(row=>[row.venueId,Number(row.followers)]));
  }

  private async hydrateVenue(row: typeof venues.$inferSelect): Promise<BookingVenueRecord> {
    const [areas, hours, subscriptionRows] = await Promise.all([
      this.db.select().from(venueAreas).where(and(
      eq(venueAreas.venueId, row.id),
      eq(venueAreas.active, true),
    )),
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
      whatsappPhone: row.whatsappPhone,
      pageProfileImageUrl: row.pageProfileImageUrl,
      pageCoverImageUrl: row.pageCoverImageUrl,
      pageBio: row.pageBio,
      latitude: row.latitude,
      longitude: row.longitude,
      timezone: row.timezone,
      bookingMode: row.bookingMode,
      onlineBookingEnabled: row.onlineBookingEnabled,
      minimumBookingNoticeMinutes: row.minimumBookingNoticeMinutes,
      maximumAdvanceBookingDays: row.maximumAdvanceBookingDays,
      cancellationPolicy: row.cancellationPolicy,
      verificationStatus:row.verificationStatus,
      amenities:row.amenities,
      houseRules:row.houseRules,
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

  async listVenueDiscoveryRecords(){
    return this.db.select({
      id:venues.id,name:venues.name,province:venues.province,city:venues.city,
      address:venues.address,status:venues.status,
      subscriptionStatus:venueSubscriptions.status,
      trialEndsAt:venueSubscriptions.trialEndsAt,
      activeUntil:venueSubscriptions.activeUntil,
    }).from(venues).innerJoin(venueSubscriptions,eq(venues.id,venueSubscriptions.venueId))
      .where(eq(venues.status,"ACTIVE"))
      .then(rows=>rows.map(row=>({
        id:row.id,name:row.name,province:row.province,city:row.city,
        address:row.address,status:row.status,
        subscription:{status:row.subscriptionStatus,trialEndsAt:row.trialEndsAt,activeUntil:row.activeUntil},
      })));
  }

  async listPublicVenueRecords(filters: { city?: string; province?: string; q?: string }): Promise<BookingVenueRecord[]> {
    const conditions = [eq(venues.status, "ACTIVE")];
    if (filters.city) conditions.push(eq(venues.city, filters.city));
    if (filters.province) conditions.push(eq(venues.province, filters.province));
    if (filters.q) {
      // ILIKE across venue identity and location. The search phrase remains data,
      // and user wildcard characters are escaped as literal input.
      const match="%"+filters.q.replace(/[\\%_]/g,(char)=>"\\"+char)+"%";
      conditions.push(or(
        ilike(venues.name,match),ilike(venues.city,match),
        ilike(venues.province,match),ilike(venues.address,match)
      )!);
    }
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
    const [bookingRows, blockRows, matchRows] = await Promise.all([
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
      this.db.select({ areaId: competitionMatches.areaId, startsAt: competitionMatches.startsAt, endsAt: competitionMatches.endsAt })
        .from(competitionMatches)
        .where(and(
          eq(competitionMatches.venueId, venueId),
          inArray(competitionMatches.status, ["SCHEDULED", "IN_PROGRESS"]),
          lt(competitionMatches.startsAt, endsAt),
          gt(competitionMatches.endsAt, startsAt),
        )),
    ]);
    return [
      ...bookingRows.map((row) => ({ ...row, kind: "BOOKING" as const })),
      ...blockRows.map((row) => ({ ...row, kind: "BLOCK" as const })),
      ...matchRows
        .filter((row): row is { areaId: string; startsAt: Date; endsAt: Date } => Boolean(row.areaId && row.startsAt && row.endsAt))
        .map((row) => ({ ...row, kind: "COMPETITION_MATCH" as const })),
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

  private async overlapExists(
    tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
    areaId: string,
    startsAt: Date,
    endsAt: Date,
    excludeBlockId?: string,
  ) {
    const [bookingOverlap] = await tx.select({ id: bookings.id }).from(bookings).where(and(
      eq(bookings.areaId, areaId),
      inArray(bookings.status, ["PENDING", "CONFIRMED"]),
      lt(bookings.startsAt, endsAt),
      gt(bookings.endsAt, startsAt),
    )).limit(1);
    if (bookingOverlap) return true;

    const [blockOverlap] = await tx.select({ id: venueBlocks.id }).from(venueBlocks).where(
      excludeBlockId
        ? and(
            eq(venueBlocks.areaId, areaId),
            ne(venueBlocks.id, excludeBlockId),
            lt(venueBlocks.startsAt, endsAt),
            gt(venueBlocks.endsAt, startsAt),
          )
        : and(
            eq(venueBlocks.areaId, areaId),
            lt(venueBlocks.startsAt, endsAt),
            gt(venueBlocks.endsAt, startsAt),
          ),
    ).limit(1);
    if (blockOverlap) return true;

    const [matchOverlap] = await tx.select({ id: competitionMatches.id }).from(competitionMatches).where(and(
      eq(competitionMatches.areaId, areaId),
      inArray(competitionMatches.status, ["SCHEDULED", "IN_PROGRESS"]),
      lt(competitionMatches.startsAt, endsAt),
      gt(competitionMatches.endsAt, startsAt),
    )).limit(1);
    return Boolean(matchOverlap);
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

  async updateBlockAtomic(input: {
    blockId: string;
    venueId: string;
    areaId: string;
    ownerUserId: string;
    startsAt: Date;
    endsAt: Date;
    reason: string | null;
  }) {
    const updatedId = await this.db.transaction(async (tx) => {
      const [owned] = await tx.select({
        id: venueBlocks.id,
        areaId: venueBlocks.areaId,
      }).from(venueBlocks)
        .innerJoin(venues, eq(venueBlocks.venueId, venues.id))
        .where(and(
          eq(venueBlocks.id, input.blockId),
          eq(venueBlocks.venueId, input.venueId),
          eq(venues.ownerUserId, input.ownerUserId),
        ))
        .limit(1);
      if (!owned) return null;

      const lockIds = Array.from(new Set([owned.areaId, input.areaId])).sort();
      for (const areaId of lockIds) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${areaId}))`);
      }

      if (await this.overlapExists(tx, input.areaId, input.startsAt, input.endsAt, input.blockId)) {
        throw errors.conflict("SLOT_UNAVAILABLE", "That time is already occupied.");
      }

      const [updated] = await tx.update(venueBlocks).set({
        areaId: input.areaId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        reason: input.reason,
      }).where(eq(venueBlocks.id, input.blockId)).returning({ id: venueBlocks.id });
      if (!updated) return null;

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

      return updated.id;
    });

    if (!updatedId) return null;
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
      .where(eq(venueBlocks.id, updatedId))
      .limit(1);
    if (!row) return null;
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

  async listOwnerBookingDirectory(venueId:string,filters:OwnerBookingDirectoryFilters){
    const q=filters.q.trim().replace(/[\\%_]/g,character=>"\\"+character);
    const conditions=[
      eq(bookings.venueId,venueId),
      ...(filters.status?[eq(bookings.status,filters.status)]:[]),
      ...(filters.source?[eq(bookings.source,filters.source)]:[]),
      ...(filters.from?[gte(bookings.startsAt,filters.from)]:[]),
      ...(filters.toExclusive?[lt(bookings.startsAt,filters.toExclusive)]:[]),
      ...(filters.scope==="UPCOMING"?[
        eq(bookings.status,"CONFIRMED" as const),gte(bookings.startsAt,filters.now),
      ]:filters.scope==="HISTORY"?[
        or(eq(bookings.status,"CANCELLED" as const),and(
          eq(bookings.status,"CONFIRMED" as const),lt(bookings.endsAt,filters.now),
        ))!,
      ]:[]),
      ...(q?[or(
        ilike(bookings.customerName,`%${q}%`),
        ilike(bookings.customerPhone,`%${q}%`),
        ilike(users.displayName,`%${q}%`),
        ilike(users.phoneE164,`%${q}%`),
        ilike(venueAreas.name,`%${q}%`),
      )!]:[]),
    ];
    const where=and(...conditions);
    const sorting=filters.scope==="UPCOMING"?
      [asc(bookings.startsAt),asc(bookings.id)]:
      [desc(bookings.startsAt),desc(bookings.id)];
    const [rows,totals]=await Promise.all([
      this.bookingProjectionQuery().where(where)
        .orderBy(...sorting).limit(filters.pageSize+1)
        .offset((filters.page-1)*filters.pageSize),
      this.db.select({total:sql<number>`count(*)::int`}).from(bookings)
        .innerJoin(venueAreas,eq(bookings.areaId,venueAreas.id))
        .leftJoin(users,eq(bookings.playerUserId,users.id))
        .where(where),
    ]);
    return {
      bookings:rows.slice(0,filters.pageSize).map(bookingDto),
      page:filters.page,pageSize:filters.pageSize,
      total:Number(totals[0]?.total??0),hasMore:rows.length>filters.pageSize,
    };
  }

  async listPendingOnlineVenueBookings(venueId: string) {
    // Never filter by a selected calendar range. Pending requests across
    // future dates (and overdue items that require rejection) must be visible.
    const rows = await this.bookingProjectionQuery().where(and(
      eq(bookings.venueId, venueId),
      eq(bookings.source, "ONLINE"),
      eq(bookings.status, "PENDING"),
    ));
    return rows.map(bookingDto).sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
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

  async confirmBooking(bookingId:string,confirmedAt:Date){
    const [updated]=await this.db.update(bookings).set({
      status:"CONFIRMED",
      updatedAt:confirmedAt,
    }).where(and(
      eq(bookings.id,bookingId),
      eq(bookings.status,"PENDING"),
    )).returning({id:bookings.id});
    if(!updated)throw errors.badRequest("BOOKING_NOT_PENDING","This booking is no longer pending approval.");
    return this.projectBooking(updated.id);
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
