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

function effectiveEntitlement(venue: BookingVenueRecord, now: Date): "TRIAL" | "ACTIVE" | "EXPIRED" | "NONE" {
  const subscription = venue.subscription;
  if (!subscription) return "NONE";
  if (subscription.status === "TRIAL") {
    return subscription.trialEndsAt && subscription.trialEndsAt.getTime() > now.getTime() ? "TRIAL" : "EXPIRED";
  }
  if (subscription.status === "ACTIVE") {
    return !subscription.activeUntil || subscription.activeUntil.getTime() > now.getTime() ? "ACTIVE" : "EXPIRED";
  }
  return "EXPIRED";
}

function assertBookableVenue(venue: BookingVenueRecord | null, now: Date): asserts venue is BookingVenueRecord {
  if (!venue || venue.status !== "ACTIVE") {
    throw errors.badRequest("VENUE_NOT_BOOKABLE", "Online booking is unavailable for this venue.");
  }
  const entitlement = effectiveEntitlement(venue, now);
  if (entitlement !== "TRIAL" && entitlement !== "ACTIVE") {
    throw errors.badRequest("VENUE_NOT_BOOKABLE", "Online booking is unavailable for this venue.");
  }
}

function assertOwnerWritable(venue: BookingVenueRecord | null, now: Date): asserts venue is BookingVenueRecord {
  if (!venue) throw errors.badRequest("VENUE_REQUIRED", "Complete venue setup first.");
  if (venue.status === "SUSPENDED") throw errors.forbidden("VENUE_SUSPENDED", "This venue is suspended.");
  const entitlement = effectiveEntitlement(venue, now);
  if (entitlement !== "TRIAL" && entitlement !== "ACTIVE") {
    throw errors.forbidden("SUBSCRIPTION_REQUIRED", "An active Premium trial or subscription is required.");
  }
}

function dateParts(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) throw errors.badRequest("INVALID_DATE", "Use a valid YYYY-MM-DD date.");
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
  ) {}

  async listPublicVenues(filters: { city?: string; province?: string }): Promise<PublicVenueListResponse> {
    const now = this.now();
    const records = await this.repository.listPublicVenueRecords(filters);
    return {
      generatedAt: now.toISOString(),
      venues: records
        .filter((venue) => venue.status === "ACTIVE" && ["TRIAL", "ACTIVE"].includes(effectiveEntitlement(venue, now)))
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

    const day = venue.openingHours.find((item) => item.dayOfWeek === weekdayForDate(date));
    if (!day || day.isClosed || !day.opensAt || !day.closesAt) {
      return { venue: toPublicVenueDto(venue), date, generatedAt: now.toISOString(), live: true, slots: [] };
    }

    const open = localDateTimeToUtc(date, day.opensAt, venue.timezone);
    const close = localDateTimeToUtc(date, day.closesAt, venue.timezone);
    const occupancies = await this.repository.listOccupancies(venue.id, open, close);
    const slots: VenueAvailabilityResponse["slots"] = [];

    for (const area of venue.areas.filter((item) => item.active)) {
      const durationMs = area.defaultSessionDurationMinutes * 60_000;
      for (let cursor = open.getTime(); cursor + durationMs <= close.getTime(); cursor += durationMs) {
        const startsAt = new Date(cursor);
        const endsAt = new Date(cursor + durationMs);
        if (startsAt.getTime() <= now.getTime()) continue;
        if (occupancies.some((item) => item.areaId === area.id && intervalsOverlap(startsAt, endsAt, item.startsAt, item.endsAt))) continue;
        slots.push({
          venueId: venue.id,
          areaId: area.id,
          areaName: area.name,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          priceAfn: area.basePriceAfn,
          currency: "AFN",
          status: "AVAILABLE",
        });
      }
    }

    slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.areaName.localeCompare(b.areaName));
    return { venue: toPublicVenueDto(venue), date, generatedAt: now.toISOString(), live: true, slots };
  }

  async createOnlineBooking(playerUserId: string, input: OnlineBookingRequest): Promise<BookingDto> {
    const now = this.now();
    const startsAt = new Date(input.startsAt);
    if (startsAt.getTime() <= now.getTime()) throw errors.badRequest("BOOKING_IN_PAST", "Choose a future slot.");

    const venueCandidates = await this.repository.listPublicVenueRecords({});
    const venue = venueCandidates.find((candidate) => candidate.areas.some((area) => area.id === input.areaId)) ?? null;
    assertBookableVenue(venue, now);

    const area = venue.areas.find((candidate) => candidate.id === input.areaId && candidate.active);
    if (!area) throw errors.badRequest("AREA_NOT_AVAILABLE", "This playing area is unavailable.");

    const availability = await this.getAvailability(venue.id, localDateForInstant(startsAt, venue.timezone));
    const liveSlot = availability.slots.find((slot) => slot.areaId === area.id && slot.startsAt === startsAt.toISOString());
    if (!liveSlot) throw errors.conflict("SLOT_UNAVAILABLE", "That slot is no longer available.");

    return this.repository.createBookingAtomic({
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
    return this.repository.cancelBooking({ bookingId, cancelledByUserId: playerUserId, reason: reason?.trim() || null, cancelledAt: now });
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
    assertIntervalWithinOpeningHours(venue, startsAt, endsAt);

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
      priceAfn: input.priceAfn ?? area.basePriceAfn,
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
    assertIntervalWithinOpeningHours(venue, startsAt, endsAt);
    return this.repository.createBlockAtomic({
      venueId: venue.id,
      areaId: area.id,
      ownerUserId,
      startsAt,
      endsAt,
      reason: input.reason?.trim() || null,
    });
  }

  async deleteBlock(ownerUserId: string, blockId: string) {
    const venue = await this.repository.getOwnerVenueRecord(ownerUserId);
    assertOwnerWritable(venue, this.now());
    if (!(await this.repository.deleteBlock(ownerUserId, blockId))) {
      throw errors.badRequest("BLOCK_NOT_FOUND", "The block was not found.");
    }
  }

  async cancelOwnerBooking(ownerUserId: string, bookingId: string, reason?: string) {
    const venue = await this.repository.getOwnerVenueRecord(ownerUserId);
    if (!venue) throw errors.badRequest("VENUE_REQUIRED", "Complete venue setup first.");
    const booking = await this.repository.getBooking(bookingId);
    if (!booking || booking.venueId !== venue.id) throw errors.forbidden("BOOKING_ACCESS_DENIED", "You cannot manage this booking.");
    if (booking.status === "CANCELLED") return booking;
    return this.repository.cancelBooking({
      bookingId,
      cancelledByUserId: ownerUserId,
      reason: reason?.trim() || null,
      cancelledAt: this.now(),
    });
  }
}
