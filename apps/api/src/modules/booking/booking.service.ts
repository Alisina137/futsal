import type {
  BookingDto,
  ManualBookingRequest,
  OnlineBookingRequest,
  OwnerScheduleResponse,
  PublicVenueListResponse,
  VenueAvailabilityResponse,
  VenueBlockRequest,
} from "@leaguekick/contracts";
import { normalizeAfghanistanPhone } from "@leaguekick/contracts";
import { errors } from "../../lib/errors.js";
import type { BookingRepository, BookingVenueRecord } from "./booking.types.js";
import { toPublicVenueDto } from "./booking.types.js";
import type { NotificationPublisher } from "../notifications/notification.types.js";
import { hasPremiumWriteAccess } from "../billing/entitlement.js";
import { buildVenueDiscovery } from "./venue-discovery.js";
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
          if (startsAt.getTime() <= now.getTime()) continue;
          if (startsAt.getTime() < earliestOnlineStart) continue;
          if (startsAt.getTime() > latestOnlineStart) continue;
          if (occupancies.some((item) => item.areaId === area.id && intervalsOverlap(startsAt, endsAt, item.startsAt, item.endsAt))) continue;
          const promotion = promotionPrices.find((item) =>
            item.areaId === area.id &&
            item.startsAt.getTime() === startsAt.getTime() &&
            item.endsAt.getTime() === endsAt.getTime()
          );
          slots.push({
            venueId: venue.id,
            areaId: area.id,
            areaName: area.name,
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            priceAfn: promotion?.discountedPriceAfn ?? period.priceAfn ?? area.basePriceAfn,
            originalPriceAfn: promotion ? (period.priceAfn ?? area.basePriceAfn) : null,
            promotionId: promotion?.id ?? null,
            currency: "AFN",
            status: "AVAILABLE",
          });
        }
      }
    }

    slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.areaName.localeCompare(b.areaName));
    return { venue: toPublicVenueDto(venue), date, generatedAt: now.toISOString(), live: true, slots };
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
    return cancelled;
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
    return cancelled;
  }
}
