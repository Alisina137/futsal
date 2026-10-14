import type {
  BookingDto,
  ManualBookingRequest,
  OnlineBookingRequest,
  OwnerScheduleResponse,
  PublicVenueListResponse,
  VenueAvailabilityResponse,
  VenueDirectoryFilters,
  VenueDirectoryResponse,
  VenueBlockRequest,
} from "@leaguekick/contracts";
import { normalizeAfghanistanPhone } from "@leaguekick/contracts";
import { errors } from "../../lib/errors.js";
import type { BookingRepository, BookingVenueRecord } from "./booking.types.js";
import { toPublicVenueDto } from "./booking.types.js";
import type { NotificationPublisher } from "../notifications/notification.types.js";
import { hasPremiumWriteAccess } from "../billing/entitlement.js";
import { buildVenueDiscovery } from "./venue-discovery.js";
import {venueDirectoryRow,rankVenueDirectory} from "./venue-directory.js";
import type { TimetableService } from "../timetable/timetable.service.js";

function assertBookableVenue(venue: BookingVenueRecord | null, now: Date): asserts venue is BookingVenueRecord {
  if (!venue || venue.status !== "ACTIVE") {
    throw errors.badRequest("VENUE_NOT_BOOKABLE", "Online booking is unavailable for this venue.");
  }
  if (!hasPremiumWriteAccess(venue.subscription, now)) {
    throw errors.badRequest("VENUE_NOT_BOOKABLE", "Online booking is unavailable for this venue.");
  }
}

function assertOwnerWritable(venue: BookingVenueRecord | null, now: Date): asserts venue is BookingVenueRecord {
  if (!venue) throw errors.badRequest("VENUE_REQUIRED", "Complete venue setup first.");
  if (venue.status === "SUSPENDED") throw errors.forbidden("VENUE_SUSPENDED", "This venue is suspended.");
  if (!hasPremiumWriteAccess(venue.subscription, now)) {
    throw errors.forbidden("SUBSCRIPTION_REQUIRED", "An active Premium trial or subscription is required.");
  }
}

function dateParts(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) throw errors.badRequest("INVALID_DATE", "Use a valid YYYY-MM-DD date.");
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw errors.badRequest("INVALID_DATE", "Use a real calendar date.");
  }
  return { year, month, day };
}

function timeParts(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  if (hour === undefined || minute === undefined) throw errors.badRequest("INVALID_TIME", "Use HH:mm time.");
  return { hour, minute };
}

function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const values = Object.fromEntries(formatter.formatToParts(instant).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return asUtc - instant.getTime();
}

function localDateTimeToUtc(date: string, time: string, timeZone: string): Date {
  const { year, month, day } = dateParts(date);
  const { hour, minute } = timeParts(time);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, 0);
  let instant = new Date(wallClock);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    instant = new Date(wallClock - timeZoneOffsetMs(instant, timeZone));
  }
  return instant;
}

function localDateForInstant(instant: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = Object.fromEntries(formatter.formatToParts(instant).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function weekdayForDate(date: string): number {
  const { year, month, day } = dateParts(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

function dayBounds(date: string, timeZone: string) {
  return {
    startsAt: localDateTimeToUtc(date, "00:00", timeZone),
    endsAt: localDateTimeToUtc(nextDate(date), "00:00", timeZone),
  };
}

function nextDate(date: string): string {
  const { year, month, day } = dateParts(date);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
}

function assertIntervalWithinOpeningHours(venue: BookingVenueRecord, startsAt: Date, endsAt: Date) {
  const localDate = localDateForInstant(startsAt, venue.timezone);
  if (localDateForInstant(endsAt, venue.timezone) !== localDate) {
    throw errors.badRequest("OUTSIDE_OPENING_HOURS", "The interval must stay within one operating day.");
  }
  const hours = venue.openingHours.find((item) => item.dayOfWeek === weekdayForDate(localDate));
  if (!hours || hours.isClosed || !hours.opensAt || !hours.closesAt) {
    throw errors.badRequest("OUTSIDE_OPENING_HOURS", "The venue is closed at that time.");
  }
  const open = localDateTimeToUtc(localDate, hours.opensAt, venue.timezone);
  const close = localDateTimeToUtc(localDate, hours.closesAt, venue.timezone);
  if (startsAt.getTime() < open.getTime() || endsAt.getTime() > close.getTime()) {
    throw errors.badRequest("OUTSIDE_OPENING_HOURS", "The interval is outside venue opening hours.");
  }
}

export class BookingService {
  constructor(
    private readonly repository: BookingRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly notifications?: NotificationPublisher,
    private readonly timetable?: TimetableService,
  ) {}

  async venueDiscovery(filters:{q?:string;province?:string}){
    const records=await this.repository.listVenueDiscoveryRecords();
    return {...buildVenueDiscovery(records,this.now(),filters),generatedAt:this.now().toISOString()};
  }

  async listPublicVenues(filters: { city?: string; province?: string; q?: string }): Promise<PublicVenueListResponse> {
    const now = this.now();
    const records = await this.repository.listPublicVenueRecords(filters);
    return {
      generatedAt: now.toISOString(),
      venues: records
        .filter((venue) => venue.status === "ACTIVE" && hasPremiumWriteAccess(venue.subscription, now))
        .map(toPublicVenueDto),
    };
  }

  /** Filter by actual availability for one Kabul-local date, never guessed opening hours. */
  async searchVenueDirectory(filters:VenueDirectoryFilters):Promise<VenueDirectoryResponse>{
    const now=this.now();
    const today=localDateForInstant(now,"Asia/Kabul");
    const latest=new Date(Date.parse(today+"T12:00:00Z")+60*86400000).toISOString().slice(0,10);
    if(filters.date<today||filters.date>latest)
      throw errors.badRequest("INVALID_SEARCH_DATE","Search dates must be within the next 60 days.");
    const {venues}=await this.listPublicVenues({
      ...(filters.province?{province:filters.province}:{}),
      ...(filters.q?{q:filters.q}:{}),
    });
    const followers=await this.repository.countVenueFollowers?.()??new Map<string,number>();
    const rows:VenueDirectoryResponse["results"]=[];
    // No silent truncation: evaluate every eligible venue using small, bounded batches.
    // An unavailable inventory service fails the search rather than falsely claiming no slots.
    for(let start=0;start<venues.length;start+=5){
      const part=await Promise.all(venues.slice(start,start+5).map(async venue=>{
        const slots=venue.onlineBookingEnabled?
          (await this.getAvailability(venue.id,filters.date)).slots:[];
        return venueDirectoryRow(venue,slots,filters,followers.get(venue.id)??0);
      }));
      for(const item of part)if(item)rows.push(item);
    }
    return {
      date:filters.date,
      results:rankVenueDirectory(rows,filters.sort),
      generatedAt:now.toISOString(),
    };
  }

  /** Only real customers with ended CONFIRMED ONLINE bookings can review. */
  async venueReviews(venueId:string,page=1,sort:import("@leaguekick/contracts").VenueReviewSort="recent"){
    await this.getPublicVenue(venueId);
    return {venueId,...await this.repository.listVerifiedReviews(venueId,20,page,sort)};
  }
  async myReviewedVenueBookings(userId:string,venueId:string){
    await this.getPublicVenue(venueId);
    return {venueId,reviewedBookingIds:
      await this.repository.listReviewedBookingIds(userId,venueId)};
  }
  async submitVenueReview(userId:string,input:import("@leaguekick/contracts").VenueReviewCreate){
    const booking=await this.repository.getBooking(input.bookingId);
    if(!booking||booking.playerUserId!==userId||booking.source!=="ONLINE"||
      booking.status!=="CONFIRMED"||Date.parse(booking.endsAt)>this.now().getTime())
      throw errors.forbidden("REVIEW_NOT_ELIGIBLE",
        "You can only review a venue after your completed, confirmed online reservation.");
    await this.getPublicVenue(booking.venueId);
    return this.repository.createVerifiedReview({
      venueId:booking.venueId,bookingId:booking.id,userId,
      rating:input.rating,body:input.body,createdAt:this.now(),
    });
  }
  async savedVenueTime(userId:string,venueId:string){
    await this.getPublicVenue(venueId);
    return {venueId,preferredStart:await this.repository.getSavedVenueTime(userId,venueId)};
  }
  async updateSavedVenueTime(userId:string,venueId:string,preferredStart:string|null){
    await this.getPublicVenue(venueId);
    await this.repository.setSavedVenueTime(userId,venueId,preferredStart,this.now());
    return {venueId,preferredStart};
  }
  async watchUnavailableSlot(userId:string,input:import("@leaguekick/contracts").VenueSlotWatchCreate){
    const venue=await this.getPublicVenue(input.venueId);
    const start=new Date(input.startsAt);
    if(start.getTime()<=this.now().getTime()||!venue.onlineBookingEnabled)
      throw errors.badRequest("SLOT_WATCH_INVALID","This slot cannot be watched.");
    const date=localDateForInstant(start,venue.timezone);
    const {timeline}=await this.getAvailability(input.venueId,date);
    const blocked=timeline?.find(x=>x.areaId===input.areaId&&
      x.startsAt===input.startsAt&&x.status==="UNAVAILABLE");
    if(!blocked)throw errors.badRequest("SLOT_WATCH_INVALID",
      "Only currently reserved future slots can be watched.");
    // A timetable block, competition match or overlapping longer interval is
    // also UNAVAILABLE. Only a real booking for the identical court and exact
    // start/end interval can produce a cancellation-based reopening notification.
    const bounds=dayBounds(date,venue.timezone);
    const bookings=await this.repository.listVenueBookings(venue.id,bounds.startsAt,bounds.endsAt);
    if(!bookings.some(booking=>booking.areaId===input.areaId&&
      booking.startsAt===blocked.startsAt&&booking.endsAt===blocked.endsAt&&
      (booking.status==="PENDING"||booking.status==="CONFIRMED"))){
      throw errors.badRequest("SLOT_WATCH_INVALID",
        "Slot alerts require a reserved booking, not a venue block or match.");
    }
    const mine=await this.repository.listPlayerBookings(userId);
    if(mine.some(x=>x.areaId===input.areaId&&x.startsAt===input.startsAt&&
      x.status!=="CANCELLED"))
      throw errors.badRequest("SLOT_WATCH_OWN_BOOKING","You already hold this slot.");
    return this.repository.watchVenueSlot({userId,venueId:input.venueId,areaId:input.areaId,
      startsAt:start,expiresAt:new Date(blocked.endsAt)});
  }
  async myVenueSlotWatches(userId:string,venueId:string){
    await this.getPublicVenue(venueId);
    return {watches:await this.repository.listMyVenueSlotWatches(userId,venueId,this.now())};
  }
  async removeVenueSlotWatch(userId:string,watchId:string){
    return {removed:await this.repository.removeVenueSlotWatch(userId,watchId)};
  }
  private async announceReopenedSlot(booking:BookingDto){
    if(!this.notifications||Date.parse(booking.startsAt)<=this.now().getTime())return;
    try{
      const watches=await this.repository.listVenueSlotWatches(booking.areaId,
        new Date(booking.startsAt),this.now());
      if(!watches.length)return;
      const venue=await this.repository.getVenueRecord(booking.venueId);
      if(!venue)return;
      const date=localDateForInstant(new Date(booking.startsAt),venue.timezone);
      const current=await this.getAvailability(booking.venueId,date);
      if(!current.slots.some(slot=>slot.areaId===booking.areaId&&
        slot.startsAt===booking.startsAt))return;
      for(const watch of watches){
        try{
          await this.notifications.slotAvailable({
            userId:watch.userId,watchId:watch.id,venueId:booking.venueId,
            areaId:booking.areaId,venueName:booking.venueName,startsAt:booking.startsAt,
          });
          await this.repository.removeVenueSlotWatch(watch.userId,watch.id);
        }catch{/* Retain the one-shot watch if persistence/delivery fails. */}
      }
    }catch{/* Cancellation must remain successful even if alert queries fail. */}
  }

  /** Ten closest subscribed and active venues with owner-confirmed map coordinates. */
  async nearbyVenues(latitude:number,longitude:number){
    const result=await this.listPublicVenues({});
    const rad=(degree:number)=>degree*Math.PI/180;
    const distance=(la:number,lo:number,lb:number,lob:number)=>{
      const a=Math.sin(rad(lb-la)/2)**2+Math.cos(rad(la))*Math.cos(rad(lb))*Math.sin(rad(lob-lo)/2)**2;
      return 6371.0088*2*Math.atan2(Math.sqrt(Math.min(1,a)),Math.sqrt(Math.max(0,1-a)));
    };
    const venues=result.venues.flatMap(venue=>{
      if(venue.latitude===null||venue.longitude===null)return [];
      return [{
        id:venue.id,name:venue.name,city:venue.city,province:venue.province,
        imageUrl:venue.pageProfileImageUrl??venue.pageCoverImageUrl,
        onlineBookingEnabled:venue.onlineBookingEnabled,
        latitude:venue.latitude,longitude:venue.longitude,
        distanceKm:distance(latitude,longitude,venue.latitude,venue.longitude),
      }];
    }).sort((a,b)=>a.distanceKm-b.distanceKm||a.name.localeCompare(b.name)||a.id.localeCompare(b.id)).slice(0,10);
    return {venues,generatedAt:result.generatedAt};
  }

  async getPublicVenue(venueId: string) {
    const venue = await this.repository.getVenueRecord(venueId);
    assertBookableVenue(venue, this.now());
    return toPublicVenueDto(venue);
  }

  async getAvailability(venueId: string, date: string): Promise<VenueAvailabilityResponse> {
    dateParts(date);
    const now = this.now();
    const venue = await this.repository.getVenueRecord(venueId);
    assertBookableVenue(venue, now);

    if (!venue.onlineBookingEnabled) {
      return { venue: toPublicVenueDto(venue), date, generatedAt: now.toISOString(), live: true, slots: [] };
    }

    const earliestOnlineStart = now.getTime() + venue.minimumBookingNoticeMinutes * 60_000;
    const latestOnlineStart = now.getTime() + venue.maximumAdvanceBookingDays * 24 * 60 * 60_000;
    const dayBoundsValue = dayBounds(date, venue.timezone);
    const [occupancies, promotionPrices] = await Promise.all([
      this.repository.listOccupancies(venue.id, dayBoundsValue.startsAt, dayBoundsValue.endsAt),
      this.repository.listActivePromotionPrices(venue.id, dayBoundsValue.startsAt, dayBoundsValue.endsAt, now),
    ]);
    const slots: VenueAvailabilityResponse["slots"] = [];
    const timeline: NonNullable<VenueAvailabilityResponse["timeline"]> = [];

    for (const area of venue.areas.filter((item) => item.active)) {
      const fallback = venue.openingHours.find((item) => item.dayOfWeek === weekdayForDate(date));
      const resolved = this.timetable
        ? await this.timetable.resolveDay({
            venueId: venue.id,
            date,
            areaId: area.id,
            ...(fallback ? { fallback } : {}),
          })
        : {
            periods: fallback && !fallback.isClosed && fallback.opensAt && fallback.closesAt
              ? [{ startsAt: fallback.opensAt, endsAt: fallback.closesAt, priceAfn: null }]
              : [],
            slotDurationMinutes: null,
            bufferMinutes: 0,
            source: "LEGACY" as const,
          };

      const durationMinutes = resolved.slotDurationMinutes ?? area.defaultSessionDurationMinutes;
      const durationMs = durationMinutes * 60_000;
      const stepMs = (durationMinutes + resolved.bufferMinutes) * 60_000;

      for (const period of resolved.periods) {
        const open = localDateTimeToUtc(date, period.startsAt, venue.timezone);
        const close = localDateTimeToUtc(date, period.endsAt, venue.timezone);
        for (let cursor = open.getTime(); cursor + durationMs <= close.getTime(); cursor += stepMs) {
          const startsAt = new Date(cursor);
          const endsAt = new Date(cursor + durationMs);
          const occupied=occupancies.some((item) => item.areaId === area.id &&
            intervalsOverlap(startsAt, endsAt, item.startsAt, item.endsAt));
          const past=startsAt.getTime() <= now.getTime();
          const notice=startsAt.getTime() < earliestOnlineStart ||
            startsAt.getTime() > latestOnlineStart;
          const promotion = !occupied && !past && !notice ? promotionPrices.find((item) =>
            item.areaId === area.id &&
            item.startsAt.getTime() === startsAt.getTime() &&
            item.endsAt.getTime() === endsAt.getTime()
          ):undefined;
          const price=promotion?.discountedPriceAfn ?? period.priceAfn ?? area.basePriceAfn;
          const status = past ? "PAST" as const :
            occupied ? "UNAVAILABLE" as const :
            notice ? "NOTICE_REQUIRED" as const :
            promotion ? "PROMOTION" as const : "AVAILABLE" as const;
          timeline.push({
            venueId:venue.id,areaId:area.id,startsAt:startsAt.toISOString(),
            endsAt:endsAt.toISOString(),priceAfn:price,
            originalPriceAfn:promotion ? (period.priceAfn ?? area.basePriceAfn):null,
            promotionId:promotion?.id ?? null,status,
          });
          if(status!=="AVAILABLE" && status!=="PROMOTION")continue;
          slots.push({
            venueId: venue.id,
            areaId: area.id,
            areaName: area.name,
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            priceAfn: price,
            originalPriceAfn: promotion ? (period.priceAfn ?? area.basePriceAfn) : null,
            promotionId: promotion?.id ?? null,
            currency: "AFN",
            status: "AVAILABLE",
          });
        }
      }
    }

    slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.areaName.localeCompare(b.areaName));
    timeline.sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
    return { venue: toPublicVenueDto(venue), date, generatedAt: now.toISOString(), live: true, slots, timeline };
  }

  async createOnlineBooking(playerUserId: string, input: OnlineBookingRequest): Promise<BookingDto> {
    const replay = await this.repository.getBookingByIdempotency(playerUserId, input.idempotencyKey);
    if (replay) return replay;

    const now = this.now();
    const startsAt = new Date(input.startsAt);
    if (startsAt.getTime() <= now.getTime()) throw errors.badRequest("BOOKING_IN_PAST", "Choose a future slot.");

    const venue = await this.repository.getVenueRecordByAreaId(input.areaId);
    assertBookableVenue(venue, now);
    if (!venue.onlineBookingEnabled) {
      throw errors.badRequest("ONLINE_BOOKING_PAUSED", "This venue has temporarily paused online booking.");
    }
    const earliestOnlineStart = now.getTime() + venue.minimumBookingNoticeMinutes * 60_000;
    if (startsAt.getTime() < earliestOnlineStart) {
      throw errors.badRequest("BOOKING_NOTICE_REQUIRED", "This booking is too close to the start time for this venue.");
    }
    const latestOnlineStart = now.getTime() + venue.maximumAdvanceBookingDays * 24 * 60 * 60_000;
    if (startsAt.getTime() > latestOnlineStart) {
      throw errors.badRequest("BOOKING_TOO_FAR_AHEAD", "This venue does not accept bookings that far in advance.");
    }

    const area = venue.areas.find((candidate) => candidate.id === input.areaId && candidate.active);
    if (!area) throw errors.badRequest("AREA_NOT_AVAILABLE", "This playing area is unavailable.");

    const availability = await this.getAvailability(venue.id, localDateForInstant(startsAt, venue.timezone));
    const liveSlot = availability.slots.find((slot) => slot.areaId === area.id && slot.startsAt === startsAt.toISOString());
    if (!liveSlot) throw errors.conflict("SLOT_UNAVAILABLE", "That slot is no longer available.");

    const created = await this.repository.createBookingAtomic({
      venueId: venue.id,
      areaId: area.id,
      playerUserId,
      createdByUserId: playerUserId,
      source: "ONLINE",
      status: venue.bookingMode === "APPROVAL" ? "PENDING" : "CONFIRMED",
      startsAt,
      endsAt: new Date(liveSlot.endsAt),
      priceAfn: liveSlot.priceAfn,
      customerName: null,
      customerPhone: null,
      note: input.note?.trim() || null,
      cancellationPolicySnapshot: venue.cancellationPolicy,
      idempotencyKey: input.idempotencyKey,
    });
    if(created.status==="PENDING"&&venue.ownerUserId){
      try{
        await this.notifications?.bookingRequest({
          ownerUserId:venue.ownerUserId,bookingId:created.id,venueId:venue.id,
          venueName:venue.name,startsAt:created.startsAt,
        });
      }catch{
        // The pending booking remains committed even if the owner's alert fails.
      }
    }
    if (created.status === "CONFIRMED") {
      try {
        await this.notifications?.bookingConfirmed({
          userId: playerUserId,
          bookingId: created.id,
          venueName: created.venueName,
          startsAt: created.startsAt,
        });
      } catch {
        // Notification delivery must never turn a committed booking into an apparent booking failure.
      }
    }
    return created;
  }

  async listPlayerBookings(playerUserId: string) {
    return { bookings: await this.repository.listPlayerBookings(playerUserId), generatedAt: this.now().toISOString() };
  }

  async cancelPlayerBooking(playerUserId: string, bookingId: string, reason?: string) {
    const booking = await this.repository.getBooking(bookingId);
    if (!booking || booking.playerUserId !== playerUserId) throw errors.forbidden("BOOKING_ACCESS_DENIED", "You cannot manage this booking.");
    if (booking.status === "CANCELLED") return booking;
    const now = this.now();
    if (Date.parse(booking.startsAt) <= now.getTime()) throw errors.badRequest("CANCELLATION_CLOSED", "This booking can no longer be cancelled.");
    const cancelled = await this.repository.cancelBooking({ bookingId, cancelledByUserId: playerUserId, reason: reason?.trim() || null, cancelledAt: now });
    try {
      await this.notifications?.bookingCancelled({
        userId: playerUserId,
        bookingId: cancelled.id,
        venueName: cancelled.venueName,
      });
    } catch {
      // Cancellation is authoritative even when notification persistence/delivery fails.
    }
    await this.announceReopenedSlot(cancelled);
    return cancelled;
  }

  /** An owner-specific approvals inbox separate from calendar-range queries.
   * A successful PENDING reservation remains here until approved or declined. */
  async getOwnerPendingBookings(ownerUserId:string) {
    const venue=await this.repository.getOwnerVenueRecord(ownerUserId);
    if(!venue)throw errors.badRequest("VENUE_REQUIRED","Complete venue setup first.");
    return {
      bookings:await this.repository.listPendingOnlineVenueBookings(venue.id),
      generatedAt:this.now().toISOString(),
    };
  }

  async getOwnerSchedule(ownerUserId: string, date: string): Promise<OwnerScheduleResponse> {
    dateParts(date);
    const venue = await this.repository.getOwnerVenueRecord(ownerUserId);
    if (!venue) throw errors.badRequest("VENUE_REQUIRED", "Complete venue setup first.");
    const bounds = dayBounds(date, venue.timezone);
    const [bookings, blocks] = await Promise.all([
      this.repository.listVenueBookings(venue.id, bounds.startsAt, bounds.endsAt),
      this.repository.listVenueBlocks(venue.id, bounds.startsAt, bounds.endsAt),
    ]);
    return { date, generatedAt: this.now().toISOString(), bookings, blocks };
  }

  async createManualBooking(ownerUserId: string, input: ManualBookingRequest): Promise<BookingDto> {
    const now = this.now();
    const venue = await this.repository.getOwnerVenueRecord(ownerUserId);
    assertOwnerWritable(venue, now);
    const area = venue.areas.find((candidate) => candidate.id === input.areaId && candidate.active);
    if (!area) throw errors.badRequest("AREA_NOT_AVAILABLE", "This playing area is unavailable.");

    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (startsAt.getTime() <= now.getTime()) throw errors.badRequest("BOOKING_IN_PAST", "Choose a future interval.");
    const fallback = venue.openingHours.find((item) => item.dayOfWeek === weekdayForDate(localDateForInstant(startsAt, venue.timezone)));
    let timetablePriceAfn: number | null = null;
    if (this.timetable) {
      const allowedPeriod = await this.timetable.assertIntervalAllowed({
        venueId: venue.id,
        areaId: area.id,
        startsAt,
        endsAt,
        timeZone: venue.timezone,
        ...(fallback ? { fallback } : {}),
      });
      timetablePriceAfn = allowedPeriod.priceAfn;
    } else {
      assertIntervalWithinOpeningHours(venue, startsAt, endsAt);
    }

    let customerPhone: string | null = null;
    if (input.customerPhone) {
      try { customerPhone = normalizeAfghanistanPhone(input.customerPhone); }
      catch { throw errors.badRequest("INVALID_PHONE", "Enter a valid Afghanistan phone number."); }
    }

    return this.repository.createBookingAtomic({
      venueId: venue.id,
      areaId: area.id,
      playerUserId: null,
      createdByUserId: ownerUserId,
      source: "MANUAL",
      status: "CONFIRMED",
      startsAt,
      endsAt,
      priceAfn: input.priceAfn ?? timetablePriceAfn ?? area.basePriceAfn,
      customerName: input.customerName.trim(),
      customerPhone,
      note: input.note?.trim() || null,
      cancellationPolicySnapshot: venue.cancellationPolicy,
      idempotencyKey: null,
    });
  }

  async createBlock(ownerUserId: string, input: VenueBlockRequest) {
    const now = this.now();
    const venue = await this.repository.getOwnerVenueRecord(ownerUserId);
    assertOwnerWritable(venue, now);
    const area = venue.areas.find((candidate) => candidate.id === input.areaId && candidate.active);
    if (!area) throw errors.badRequest("AREA_NOT_AVAILABLE", "This playing area is unavailable.");
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (startsAt.getTime() <= now.getTime()) throw errors.badRequest("BLOCK_IN_PAST", "Choose a future interval.");
    const fallback = venue.openingHours.find((item) => item.dayOfWeek === weekdayForDate(localDateForInstant(startsAt, venue.timezone)));
    if (this.timetable) {
      await this.timetable.assertIntervalAllowed({
        venueId: venue.id,
        areaId: area.id,
        startsAt,
        endsAt,
        timeZone: venue.timezone,
        ...(fallback ? { fallback } : {}),
      });
    } else {
      assertIntervalWithinOpeningHours(venue, startsAt, endsAt);
    }
    return this.repository.createBlockAtomic({
      venueId: venue.id,
      areaId: area.id,
      ownerUserId,
      startsAt,
      endsAt,
      reason: input.reason?.trim() || null,
    });
  }

  async updateBlock(ownerUserId: string, blockId: string, input: VenueBlockRequest) {
    const now = this.now();
    const venue = await this.repository.getOwnerVenueRecord(ownerUserId);
    assertOwnerWritable(venue, now);
    const area = venue.areas.find((candidate) => candidate.id === input.areaId && candidate.active);
    if (!area) throw errors.badRequest("AREA_NOT_AVAILABLE", "This playing area is unavailable.");

    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (startsAt.getTime() <= now.getTime()) {
      throw errors.badRequest("BLOCK_IN_PAST", "Choose a future interval.");
    }

    const fallback = venue.openingHours.find((item) =>
      item.dayOfWeek === weekdayForDate(localDateForInstant(startsAt, venue.timezone))
    );
    if (this.timetable) {
      await this.timetable.assertIntervalAllowed({
        venueId: venue.id,
        areaId: area.id,
        startsAt,
        endsAt,
        timeZone: venue.timezone,
        ...(fallback ? { fallback } : {}),
      });
    } else {
      assertIntervalWithinOpeningHours(venue, startsAt, endsAt);
    }

    const updated = await this.repository.updateBlockAtomic({
      blockId,
      venueId: venue.id,
      areaId: area.id,
      ownerUserId,
      startsAt,
      endsAt,
      reason: input.reason?.trim() || null,
    });
    if (!updated) throw errors.badRequest("BLOCK_NOT_FOUND", "The block was not found.");
    return updated;
  }

  async deleteBlock(ownerUserId: string, blockId: string) {
    const venue = await this.repository.getOwnerVenueRecord(ownerUserId);
    assertOwnerWritable(venue, this.now());
    if (!(await this.repository.deleteBlock(ownerUserId, blockId))) {
      throw errors.badRequest("BLOCK_NOT_FOUND", "The block was not found.");
    }
  }

  async confirmOwnerBooking(ownerUserId:string,bookingId:string){
    const venue=await this.repository.getOwnerVenueRecord(ownerUserId);
    if(!venue)throw errors.badRequest("VENUE_REQUIRED","Complete venue setup first.");
    const booking=await this.repository.getBooking(bookingId);
    if(!booking||booking.venueId!==venue.id)throw errors.forbidden("BOOKING_ACCESS_DENIED","You cannot manage this booking.");
    if(booking.status==="CONFIRMED")return booking;
    if(booking.status!=="PENDING")throw errors.badRequest("BOOKING_NOT_PENDING","This booking is no longer pending approval.");
    if(Date.parse(booking.startsAt)<=this.now().getTime()){
      throw errors.badRequest("BOOKING_ALREADY_STARTED","This booking can no longer be approved.");
    }
    const confirmed=await this.repository.confirmBooking(bookingId,this.now());
    if(confirmed.playerUserId){
      try{
        await this.notifications?.bookingConfirmed({
          userId:confirmed.playerUserId,
          bookingId:confirmed.id,
          venueName:confirmed.venueName,
          startsAt:confirmed.startsAt,
        });
      }catch{
        // Approval remains authoritative even if notification delivery fails.
      }
    }
    return confirmed;
  }

  async cancelOwnerBooking(ownerUserId: string, bookingId: string, reason?: string) {
    const venue = await this.repository.getOwnerVenueRecord(ownerUserId);
    if (!venue) throw errors.badRequest("VENUE_REQUIRED", "Complete venue setup first.");
    const booking = await this.repository.getBooking(bookingId);
    if (!booking || booking.venueId !== venue.id) throw errors.forbidden("BOOKING_ACCESS_DENIED", "You cannot manage this booking.");
    if (booking.status === "CANCELLED") return booking;
    const cancelled = await this.repository.cancelBooking({
      bookingId,
      cancelledByUserId: ownerUserId,
      reason: reason?.trim() || null,
      cancelledAt: this.now(),
    });
    if (cancelled.playerUserId) {
      try {
        await this.notifications?.bookingCancelled({
          userId: cancelled.playerUserId,
          bookingId: cancelled.id,
          venueName: cancelled.venueName,
        });
      } catch {
        // Owner cancellation remains successful independently of notification delivery.
      }
    }
    await this.announceReopenedSlot(cancelled);
    return cancelled;
  }
}
