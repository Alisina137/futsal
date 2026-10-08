import type {
  VenueTimetableDraftRequest,
  VenueTimetableExceptionRequest,
} from "@leaguekick/contracts";

export type TimetableVenueRecord = {
  id: string;
  ownerUserId: string;
  timezone: string;
  areas: Array<{
    id: string;
    name: string;
    active: boolean;
    defaultSessionDurationMinutes: number;
    basePriceAfn: number;
  }>;
};

export type TimetableRecord = {
  id: string;
  venueId: string;
  name: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  effectiveFrom: string;
  effectiveUntil: string | null;
  defaultSlotDurationMinutes: number;
  bufferMinutes: number;
  createdByUserId: string;
  publishedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  periods: Array<{
    areaId: string | null;
    dayOfWeek: number;
    startsAt: string;
    endsAt: string;
    priceAfn: number;
  }>;
};

export type TimetableExceptionRecord = {
  id: string;
  venueId: string;
  areaId: string | null;
  date: string;
  isClosed: boolean;
  periods: Array<{ startsAt: string; endsAt: string; priceAfn: number | null }>;
  note: string | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TimetableOccupancyRecord = {
  id: string;
  type: "BOOKING" | "BLOCK" | "COMPETITION_MATCH" | "PROMOTION";
  areaId: string;
  areaName: string;
  startsAt: Date;
  endsAt: Date;
  title: string;
  priceAfn: number | null;
  source?: "ONLINE" | "MANUAL";
  bookingStatus?: "PENDING" | "CONFIRMED";
};

export interface TimetableRepository {
  getVenueByOwner(ownerUserId: string): Promise<TimetableVenueRecord | null>;
  getVenue(venueId: string): Promise<TimetableVenueRecord | null>;
  listTimetables(venueId: string): Promise<TimetableRecord[]>;
  getTimetable(timetableId: string): Promise<TimetableRecord | null>;
  createTimetable(input: {
    venueId: string;
    ownerUserId: string;
    draft: VenueTimetableDraftRequest;
  }): Promise<TimetableRecord>;
  updateDraft(input: {
    timetableId: string;
    venueId: string;
    draft: VenueTimetableDraftRequest;
  }): Promise<TimetableRecord>;
  duplicateTimetable(input: {
    source: TimetableRecord;
    ownerUserId: string;
  }): Promise<TimetableRecord>;
  deleteDraft(timetableId: string, venueId: string): Promise<boolean>;
  publishTimetable(input: {
    timetableId: string;
    venueId: string;
    archiveIds: string[];
    publishedAt: Date;
  }): Promise<TimetableRecord>;
  truncatePublishedTimetable(input: {
    timetableId: string;
    venueId: string;
    effectiveUntil: string;
    updatedAt: Date;
  }): Promise<void>;
  archiveTimetable(timetableId: string, venueId: string, archivedAt: Date): Promise<TimetableRecord | null>;
  listExceptions(venueId: string, from?: string, to?: string): Promise<TimetableExceptionRecord[]>;
  createException(input: {
    venueId: string;
    ownerUserId: string;
    exception: VenueTimetableExceptionRequest;
  }): Promise<TimetableExceptionRecord>;
  getException(exceptionId: string): Promise<TimetableExceptionRecord | null>;
  updateException(input: {
    exceptionId: string;
    venueId: string;
    exception: VenueTimetableExceptionRequest;
  }): Promise<TimetableExceptionRecord | null>;
  deleteException(exceptionId: string, venueId: string): Promise<boolean>;
  listOccupancies(venueId: string, startsAt: Date, endsAt: Date): Promise<TimetableOccupancyRecord[]>;
}

export type ResolvedTimetableDay = {
  periods: Array<{ startsAt: string; endsAt: string; priceAfn: number | null }>;
  slotDurationMinutes: number | null;
  bufferMinutes: number;
  source: "TIMETABLE" | "LEGACY";
};

export interface TimetableAvailabilityResolver {
  resolveDay(input: {
    venueId: string;
    date: string;
    areaId: string;
    fallback?: { isClosed: boolean; opensAt: string | null; closesAt: string | null };
  }): Promise<ResolvedTimetableDay>;
}
