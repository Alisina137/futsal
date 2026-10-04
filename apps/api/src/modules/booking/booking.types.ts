import type {
  BookingDto,
  BookingMode,
  BookingSource,
  BookingStatus,
  ManualBookingRequest,
  PublicVenueDto,
  VenueBlockDto,
  VenueOpeningHourInput,
} from "@leaguekick/contracts";

export type BookingAreaRecord = {
  id: string;
  venueId: string;
  name: string;
  defaultSessionDurationMinutes: number;
  basePriceAfn: number;
  active: boolean;
};

export type BookingVenueRecord = {
  id: string;
  ownerUserId: string;
  name: string;
  province: string;
  city: string;
  address: string;
  publicPhone: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  bookingMode: BookingMode;
  cancellationPolicy: string;
  status: "DRAFT" | "READY" | "ACTIVE" | "SUSPENDED";
  areas: BookingAreaRecord[];
  openingHours: VenueOpeningHourInput[];
  subscription: {
    status: "TRIAL" | "ACTIVE" | "EXPIRED" | "CANCELLED";
    trialEndsAt: Date | null;
    activeUntil: Date | null;
  } | null;
};

export type OccupancyRecord = {
  areaId: string;
  startsAt: Date;
  endsAt: Date;
  kind: "BOOKING" | "BLOCK";
};

export type CreateBookingRecordInput = {
  venueId: string;
  areaId: string;
  playerUserId: string | null;
  createdByUserId: string;
  source: BookingSource;
  status: Exclude<BookingStatus, "CANCELLED">;
  startsAt: Date;
  endsAt: Date;
  priceAfn: number;
  customerName: string | null;
  customerPhone: string | null;
  note: string | null;
  cancellationPolicySnapshot: string;
  idempotencyKey: string | null;
};

export interface BookingRepository {
  listPublicVenueRecords(filters: { city?: string; province?: string }): Promise<BookingVenueRecord[]>;
  getVenueRecord(venueId: string): Promise<BookingVenueRecord | null>;
  getOwnerVenueRecord(ownerUserId: string): Promise<BookingVenueRecord | null>;
  listOccupancies(venueId: string, startsAt: Date, endsAt: Date): Promise<OccupancyRecord[]>;
  createBookingAtomic(input: CreateBookingRecordInput): Promise<BookingDto>;
  createBlockAtomic(input: {
    venueId: string;
    areaId: string;
    ownerUserId: string;
    startsAt: Date;
    endsAt: Date;
    reason: string | null;
  }): Promise<VenueBlockDto>;
  deleteBlock(ownerUserId: string, blockId: string): Promise<boolean>;
  getBooking(bookingId: string): Promise<BookingDto | null>;
  listPlayerBookings(playerUserId: string): Promise<BookingDto[]>;
  listVenueBookings(venueId: string, startsAt: Date, endsAt: Date): Promise<BookingDto[]>;
  listVenueBlocks(venueId: string, startsAt: Date, endsAt: Date): Promise<VenueBlockDto[]>;
  cancelBooking(input: { bookingId: string; cancelledByUserId: string; reason: string | null; cancelledAt: Date }): Promise<BookingDto>;
}

export function toPublicVenueDto(venue: BookingVenueRecord): PublicVenueDto {
  return {
    id: venue.id,
    name: venue.name,
    province: venue.province,
    city: venue.city,
    address: venue.address,
    publicPhone: venue.publicPhone,
    latitude: venue.latitude,
    longitude: venue.longitude,
    timezone: venue.timezone,
    bookingMode: venue.bookingMode,
    areas: venue.areas.filter((area) => area.active).map((area) => ({
      id: area.id,
      name: area.name,
      defaultSessionDurationMinutes: area.defaultSessionDurationMinutes,
      basePriceAfn: area.basePriceAfn,
    })),
  };
}

export type { ManualBookingRequest };
