import { randomUUID } from "node:crypto";
import type { BookingDto, VenueBlockDto } from "@leaguekick/contracts";
import { errors } from "../src/lib/errors.js";
import type {
  BookingRepository,
  BookingVenueRecord,
  CreateBookingRecordInput,
  OccupancyRecord,
} from "../src/modules/booking/booking.types.js";

function overlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

export class FakeBookingRepository implements BookingRepository {
  venues = new Map<string, BookingVenueRecord>();
  bookings = new Map<string, BookingDto>();
  blocks = new Map<string, VenueBlockDto>();
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

  async listPublicVenueRecords(filters: { city?: string; province?: string }) {
    return [...this.venues.values()].filter((venue) =>
      (!filters.city || venue.city === filters.city) &&
      (!filters.province || venue.province === filters.province));
  }

  async getVenueRecord(venueId: string) { return this.venues.get(venueId) ?? null; }
  async getOwnerVenueRecord(ownerUserId: string) {
    return [...this.venues.values()].find((venue) => venue.ownerUserId === ownerUserId) ?? null;
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
        const existing = [...this.bookings.values()].find((booking) => (booking as BookingDto & { idempotencyKey?: string }).idempotencyKey === input.idempotencyKey);
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
      };
      this.bookings.set(booking.id, booking);
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
      return block;
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

  async listPlayerBookings(playerUserId: string) {
    return [...this.bookings.values()].filter((booking) => booking.playerUserId === playerUserId);
  }

  async listVenueBookings(venueId: string, startsAt: Date, endsAt: Date) {
    return [...this.bookings.values()].filter((booking) =>
      booking.venueId === venueId && overlap(new Date(booking.startsAt), new Date(booking.endsAt), startsAt, endsAt));
  }

  async listVenueBlocks(venueId: string, startsAt: Date, endsAt: Date) {
    return [...this.blocks.values()].filter((block) =>
      block.venueId === venueId && overlap(new Date(block.startsAt), new Date(block.endsAt), startsAt, endsAt));
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
