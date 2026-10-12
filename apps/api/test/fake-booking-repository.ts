import { randomUUID } from "node:crypto";
import type { BookingDto, VenueBlockDto } from "@leaguekick/contracts";
import { errors } from "../src/lib/errors.js";
import type {
  BookingRepository,
  BookingVenueRecord,
  CreateBookingRecordInput,
  OccupancyRecord,
  PromotionPriceRecord,
} from "../src/modules/booking/booking.types.js";

function overlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

export class FakeBookingRepository implements BookingRepository {
  venues = new Map<string, BookingVenueRecord>();
  bookings = new Map<string, BookingDto>();
  blocks = new Map<string, VenueBlockDto>();
  promotionPrices: PromotionPriceRecord[] = [];
  followerCounts=new Map<string,number>();
  async countVenueFollowers(){return this.followerCounts;}
  reviews=new Map<string,import("@leaguekick/contracts").VenueReviewDto>();
  savedTimes=new Map<string,string>();
  watches=new Map<string,import("@leaguekick/contracts").VenueSlotWatchDto&{userId:string}>();
  async listVerifiedReviews(venueId:string,limit:number){
    const all=[...this.reviews.values()].filter(x=>x.venueId===venueId)
      .sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    return {averageRating:all.length?all.reduce((n,x)=>n+x.rating,0)/all.length:0,
      reviewCount:all.length,reviews:all.slice(0,limit)};
  }
  async createVerifiedReview(input:{venueId:string;bookingId:string;userId:string;
    rating:number;body:string;createdAt:Date}){
    if(this.reviews.has(input.bookingId))throw errors.badRequest("ALREADY_REVIEWED","Already reviewed");
    const review={id:randomUUID(),venueId:input.venueId,bookingId:input.bookingId,
      rating:input.rating,body:input.body,createdAt:input.createdAt.toISOString(),verified:true as const};
    this.reviews.set(input.bookingId,review);
    return review;
  }
  async getSavedVenueTime(userId:string,venueId:string){
    return this.savedTimes.get(userId+"|"+venueId)??null;
  }
  async setSavedVenueTime(userId:string,venueId:string,time:string|null,_now:Date){
    const key=userId+"|"+venueId;
    if(time===null)this.savedTimes.delete(key);else this.savedTimes.set(key,time);
  }
  async watchVenueSlot(input:{userId:string;venueId:string;areaId:string;startsAt:Date;expiresAt:Date}){
    const old=[...this.watches.values()].find(x=>x.userId===input.userId&&
      x.areaId===input.areaId&&x.startsAt===input.startsAt.toISOString());
    const watch={id:old?.id??randomUUID(),userId:input.userId,venueId:input.venueId,
      areaId:input.areaId,startsAt:input.startsAt.toISOString(),expiresAt:input.expiresAt.toISOString()};
    this.watches.set(watch.id,watch);
    const {userId:_,...publicWatch}=watch;
    return publicWatch;
  }
  async listMyVenueSlotWatches(userId:string,venueId:string,now:Date){
    return [...this.watches.values()].filter(x=>x.userId===userId&&x.venueId===venueId&&
      Date.parse(x.expiresAt)>now.getTime()).map(({userId:_,...x})=>x);
  }
  async listVenueSlotWatches(areaId:string,startsAt:Date,now:Date){
    return [...this.watches.values()].filter(x=>x.areaId===areaId&&
      x.startsAt===startsAt.toISOString()&&Date.parse(x.expiresAt)>now.getTime());
  }
  async removeVenueSlotWatch(userId:string,watchId:string){
    if(this.watches.get(watchId)?.userId!==userId)return false;
    this.watches.delete(watchId);return true;
  }
  private tail: Promise<void> = Promise.resolve();

  seedVenue(ownerUserId: string, options?: { trialEndsAt?: Date; status?: BookingVenueRecord["status"] }) {
    const venueId = randomUUID();
    const areaId = randomUUID();
    const venue: BookingVenueRecord = {
      id: venueId,
      ownerUserId,
      name: "Kabul Arena",
      province: "Kabul",
      city: "Kabul",
      address: "District 10, Kabul",
      publicPhone: "+93795556677",
      latitude: null,
      longitude: null,
      timezone: "Asia/Kabul",
      bookingMode: "INSTANT",
      onlineBookingEnabled: true,
      minimumBookingNoticeMinutes: 0,
      maximumAdvanceBookingDays: 30,
      cancellationPolicy: "Cancel before start time.",
      status: options?.status ?? "ACTIVE",
      areas: [{
        id: areaId,
        venueId,
        name: "Pitch 1",
        defaultSessionDurationMinutes: 90,
        basePriceAfn: 1800,
        active: true,
      }],
      openingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({
        dayOfWeek,
        isClosed: false,
        opensAt: "08:00",
        closesAt: "22:00",
      })),
      subscription: {
        status: "TRIAL",
        trialEndsAt: options?.trialEndsAt ?? new Date("2026-10-07T00:00:00.000Z"),
        activeUntil: null,
      },
    };
    this.venues.set(venue.id, venue);
    return { venue, areaId };
  }

  private async exclusive<T>(fn: () => Promise<T> | T): Promise<T> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try { return await fn(); }
    finally { release(); }
  }

  async listVenueDiscoveryRecords(){
    return [...this.venues.values()].map(venue=>({
      id:venue.id,name:venue.name,province:venue.province,city:venue.city,
      address:venue.address,status:venue.status,subscription:venue.subscription,
    }));
  }

  async listPublicVenueRecords(filters: { city?: string; province?: string; q?: string }) {
    return [...this.venues.values()].filter((venue) =>
      (!filters.city || venue.city === filters.city) &&
      (!filters.province || venue.province === filters.province) &&
      (!filters.q || [venue.name,venue.city,venue.province,venue.address]
        .some(text=>text.toLocaleLowerCase("en-US").includes(filters.q!.toLocaleLowerCase("en-US")))));
  }

  async getVenueRecord(venueId: string) { return this.venues.get(venueId) ?? null; }
  async getVenueRecordByAreaId(areaId: string) {
    return [...this.venues.values()].find((venue) => venue.areas.some((area) => area.id === areaId)) ?? null;
  }
  async getOwnerVenueRecord(ownerUserId: string) {
    return [...this.venues.values()].find((venue) => venue.ownerUserId === ownerUserId) ?? null;
  }

  async listActivePromotionPrices(venueId: string, startsAt: Date, endsAt: Date, now: Date) {
    const areaIds = new Set(this.venues.get(venueId)?.areas.map((area) => area.id) ?? []);
    return this.promotionPrices.filter((promotion) =>
      areaIds.has(promotion.areaId) &&
      promotion.endsAt.getTime() > now.getTime() &&
      overlap(promotion.startsAt, promotion.endsAt, startsAt, endsAt));
  }

  async listOccupancies(venueId: string, startsAt: Date, endsAt: Date): Promise<OccupancyRecord[]> {
    const bookingRows: OccupancyRecord[] = [...this.bookings.values()]
      .filter((booking) => booking.venueId === venueId && booking.status !== "CANCELLED" &&
        overlap(new Date(booking.startsAt), new Date(booking.endsAt), startsAt, endsAt))
      .map((booking) => ({ areaId: booking.areaId, startsAt: new Date(booking.startsAt), endsAt: new Date(booking.endsAt), kind: "BOOKING" }));
    const blockRows: OccupancyRecord[] = [...this.blocks.values()]
      .filter((block) => block.venueId === venueId && overlap(new Date(block.startsAt), new Date(block.endsAt), startsAt, endsAt))
      .map((block) => ({ areaId: block.areaId, startsAt: new Date(block.startsAt), endsAt: new Date(block.endsAt), kind: "BLOCK" }));
    return [...bookingRows, ...blockRows];
  }

  async createBookingAtomic(input: CreateBookingRecordInput): Promise<BookingDto> {
    return this.exclusive(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2));
      if (input.idempotencyKey) {
        const existing = [...this.bookings.values()].find((booking) => {
          const value = booking as BookingDto & { idempotencyKey?: string; createdByUserId?: string };
          return value.idempotencyKey === input.idempotencyKey && value.createdByUserId === input.createdByUserId;
        });
        if (existing) return existing;
      }
      const occupancies = await this.listOccupancies(input.venueId, input.startsAt, input.endsAt);
      if (occupancies.some((item) => item.areaId === input.areaId)) {
        throw errors.conflict("SLOT_UNAVAILABLE", "That time is no longer available.");
      }
      const venue = this.venues.get(input.venueId)!;
      const area = venue.areas.find((candidate) => candidate.id === input.areaId)!;
      const booking: BookingDto & { idempotencyKey?: string } = {
        id: randomUUID(),
        venueId: input.venueId,
        venueName: venue.name,
        areaId: input.areaId,
        areaName: area.name,
        playerUserId: input.playerUserId,
        source: input.source,
        status: input.status,
        startsAt: input.startsAt.toISOString(),
        endsAt: input.endsAt.toISOString(),
        priceAfn: input.priceAfn,
        currency: "AFN",
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        note: input.note,
        cancellationPolicySnapshot: input.cancellationPolicySnapshot,
        cancelledAt: null,
        cancellationReason: null,
        ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
        createdByUserId: input.createdByUserId,
      } as BookingDto & { idempotencyKey?: string; createdByUserId: string };
      this.bookings.set(booking.id, booking);
      this.promotionPrices = this.promotionPrices.filter((promotion) =>
        !(promotion.areaId === input.areaId && overlap(promotion.startsAt, promotion.endsAt, input.startsAt, input.endsAt)));
      return booking;
    });
  }

  async createBlockAtomic(input: {
    venueId: string;
    areaId: string;
    ownerUserId: string;
    startsAt: Date;
    endsAt: Date;
    reason: string | null;
  }) {
    return this.exclusive(async () => {
      const occupancies = await this.listOccupancies(input.venueId, input.startsAt, input.endsAt);
      if (occupancies.some((item) => item.areaId === input.areaId)) {
        throw errors.conflict("SLOT_UNAVAILABLE", "That time is already occupied.");
      }
      const venue = this.venues.get(input.venueId)!;
      const area = venue.areas.find((candidate) => candidate.id === input.areaId)!;
      const block: VenueBlockDto = {
        id: randomUUID(),
        venueId: input.venueId,
        areaId: input.areaId,
        areaName: area.name,
        startsAt: input.startsAt.toISOString(),
        endsAt: input.endsAt.toISOString(),
        reason: input.reason,
      };
      this.blocks.set(block.id, block);
      this.promotionPrices = this.promotionPrices.filter((promotion) =>
        !(promotion.areaId === input.areaId && overlap(promotion.startsAt, promotion.endsAt, input.startsAt, input.endsAt)));
      return block;
    });
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
    return this.exclusive(async () => {
      const current = this.blocks.get(input.blockId);
      const venue = this.venues.get(input.venueId);
      if (!current || current.venueId !== input.venueId || !venue || venue.ownerUserId !== input.ownerUserId) {
        return null;
      }

      const bookingConflict = [...this.bookings.values()].some((booking) =>
        booking.venueId === input.venueId
        && booking.areaId === input.areaId
        && booking.status !== "CANCELLED"
        && overlap(new Date(booking.startsAt), new Date(booking.endsAt), input.startsAt, input.endsAt)
      );
      const blockConflict = [...this.blocks.values()].some((block) =>
        block.id !== input.blockId
        && block.venueId === input.venueId
        && block.areaId === input.areaId
        && overlap(new Date(block.startsAt), new Date(block.endsAt), input.startsAt, input.endsAt)
      );
      if (bookingConflict || blockConflict) {
        throw errors.conflict("SLOT_UNAVAILABLE", "That time is already occupied.");
      }

      const area = venue.areas.find((candidate) => candidate.id === input.areaId);
      if (!area) return null;
      const updated: VenueBlockDto = {
        ...current,
        areaId: input.areaId,
        areaName: area.name,
        startsAt: input.startsAt.toISOString(),
        endsAt: input.endsAt.toISOString(),
        reason: input.reason,
      };
      this.blocks.set(updated.id, updated);
      this.promotionPrices = this.promotionPrices.filter((promotion) =>
        !(promotion.areaId === input.areaId && overlap(promotion.startsAt, promotion.endsAt, input.startsAt, input.endsAt))
      );
      return updated;
    });
  }

  async deleteBlock(ownerUserId: string, blockId: string) {
    const block = this.blocks.get(blockId);
    if (!block) return false;
    const venue = this.venues.get(block.venueId);
    if (!venue || venue.ownerUserId !== ownerUserId) return false;
    return this.blocks.delete(blockId);
  }

  async getBooking(bookingId: string) { return this.bookings.get(bookingId) ?? null; }

  async getBookingByIdempotency(createdByUserId: string, idempotencyKey: string) {
    return [...this.bookings.values()].find((booking) => {
      const value = booking as BookingDto & { idempotencyKey?: string; createdByUserId?: string };
      return value.createdByUserId === createdByUserId && value.idempotencyKey === idempotencyKey;
    }) ?? null;
  }

  async listPlayerBookings(playerUserId: string) {
    return [...this.bookings.values()].filter((booking) => booking.playerUserId === playerUserId);
  }

  async listPendingOnlineVenueBookings(venueId:string):Promise<BookingDto[]>{
    return [...this.bookings.values()]
      .filter(booking=>booking.venueId===venueId&&booking.source==="ONLINE"&&booking.status==="PENDING")
      .sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
  }

  async listVenueBookings(venueId: string, startsAt: Date, endsAt: Date) {
    return [...this.bookings.values()].filter((booking) =>
      booking.venueId === venueId && overlap(new Date(booking.startsAt), new Date(booking.endsAt), startsAt, endsAt));
  }

  async listVenueBlocks(venueId: string, startsAt: Date, endsAt: Date) {
    return [...this.blocks.values()].filter((block) =>
      block.venueId === venueId && overlap(new Date(block.startsAt), new Date(block.endsAt), startsAt, endsAt));
  }

  async confirmBooking(bookingId: string, _confirmedAt: Date) {
    const current = this.bookings.get(bookingId);
    if (!current || current.status !== "PENDING") {
      throw errors.badRequest("BOOKING_NOT_PENDING", "This booking is no longer pending approval.");
    }
    const next: BookingDto = { ...current, status: "CONFIRMED" };
    this.bookings.set(next.id, next);
    return next;
  }

  async cancelBooking(input: { bookingId: string; cancelledByUserId: string; reason: string | null; cancelledAt: Date }) {
    const current = this.bookings.get(input.bookingId);
    if (!current) throw errors.badRequest("BOOKING_NOT_FOUND", "The booking was not found.");
    const next: BookingDto = {
      ...current,
      status: "CANCELLED",
      cancelledAt: input.cancelledAt.toISOString(),
      cancellationReason: input.reason,
    };
    this.bookings.set(next.id, next);
    return next;
  }
}
