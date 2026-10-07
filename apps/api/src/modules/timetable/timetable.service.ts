import type {
  VenueCalendarDay,
  VenueCalendarEvent,
  VenueTimetableConflict,
  VenueTimetableDraftRequest,
  VenueTimetableDto,
  VenueTimetableExceptionDto,
  VenueTimetableExceptionRequest,
  VenueTimetableListResponse,
  VenueTimetablePublishResponse,
  VenueTimetableCalendarResponse,
  VenueOpeningHourInput,
} from "@leaguekick/contracts";
import { errors } from "../../lib/errors.js";
import type {
  ResolvedTimetableDay,
  TimetableExceptionRecord,
  TimetableOccupancyRecord,
  TimetableRecord,
  TimetableRepository,
  TimetableVenueRecord,
} from "./timetable.types.js";

function toDto(record: TimetableRecord): VenueTimetableDto {
  return {
    id: record.id,
    venueId: record.venueId,
    name: record.name,
    status: record.status,
    effectiveFrom: record.effectiveFrom,
    effectiveUntil: record.effectiveUntil,
    defaultSlotDurationMinutes: record.defaultSlotDurationMinutes,
    bufferMinutes: record.bufferMinutes,
    periods: record.periods,
    publishedAt: record.publishedAt?.toISOString() ?? null,
    archivedAt: record.archivedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function exceptionDto(record: TimetableExceptionRecord): VenueTimetableExceptionDto {
  return {
    id: record.id,
    venueId: record.venueId,
    areaId: record.areaId,
    date: record.date,
    isClosed: record.isClosed,
    periods: record.periods,
    note: record.note,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function dateParts(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw errors.badRequest("INVALID_DATE", "Use YYYY-MM-DD.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) throw errors.badRequest("INVALID_DATE", "Choose a real calendar date.");
  return { year, month, day };
}

function timeParts(time: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) throw errors.badRequest("INVALID_TIME", "Use HH:mm.");
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function timeZoneOffsetMs(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
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

function localDateTimeToUtc(date: string, time: string, timeZone: string) {
  const { year, month, day } = dateParts(date);
  const { hour, minute } = timeParts(time);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, 0);
  let instant = new Date(wallClock);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    instant = new Date(wallClock - timeZoneOffsetMs(instant, timeZone));
  }
  return instant;
}

function localDateForInstant(instant: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = Object.fromEntries(formatter.formatToParts(instant).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function weekdayForDate(date: string) {
  const { year, month, day } = dateParts(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function addDays(date: string, days: number) {
  const { year, month, day } = dateParts(date);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  const a = dateParts(from);
  const b = dateParts(to);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000);
}

function dayBounds(date: string, timeZone: string) {
  return {
    startsAt: localDateTimeToUtc(date, "00:00", timeZone),
    endsAt: localDateTimeToUtc(addDays(date, 1), "00:00", timeZone),
  };
}

function rangesOverlap(a: TimetableRecord, b: TimetableRecord) {
  const aEnd = a.effectiveUntil ?? "9999-12-31";
  const bEnd = b.effectiveUntil ?? "9999-12-31";
  return a.effectiveFrom <= bEnd && b.effectiveFrom <= aEnd;
}

function intervalOverlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

function recordForDate(records: TimetableRecord[], date: string) {
  return records
    .filter((record) =>
      record.status === "PUBLISHED"
      && record.effectiveFrom <= date
      && (!record.effectiveUntil || record.effectiveUntil >= date)
    )
    .sort((a, b) =>
      b.effectiveFrom.localeCompare(a.effectiveFrom)
      || (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)
    )[0] ?? null;
}

function periodsFor(
  record: TimetableRecord | null,
  exceptions: TimetableExceptionRecord[],
  date: string,
  areaId: string,
) {
  const specificException = exceptions.find((item) => item.date === date && item.areaId === areaId);
  const allException = exceptions.find((item) => item.date === date && item.areaId === null);
  const special = specificException ?? allException;
  if (special) {
    return special.isClosed
      ? []
      : special.periods.map(({ startsAt, endsAt, priceAfn }) => ({ startsAt, endsAt, priceAfn: priceAfn ?? null }));
  }

  if (!record) return null;
  const day = weekdayForDate(date);
  const specific = record.periods.filter((item) => item.dayOfWeek === day && item.areaId === areaId);
  const shared = record.periods.filter((item) => item.dayOfWeek === day && item.areaId === null);
  const chosen = specific.length ? specific : shared;
  return chosen.map(({ startsAt, endsAt, priceAfn }) => ({ startsAt, endsAt, priceAfn }));
}

function ensureAreaReferences(venue: TimetableVenueRecord, periods: Array<{ areaId: string | null }>) {
  const ids = new Set(venue.areas.map((area) => area.id));
  const invalid = periods.find((item) => item.areaId !== null && !ids.has(item.areaId));
  if (invalid) throw errors.badRequest("TIMETABLE_AREA_INVALID", "A timetable period references an area outside this venue.");
}

function legacyPeriods(fallback?: { isClosed: boolean; opensAt: string | null; closesAt: string | null }) {
  if (!fallback || fallback.isClosed || !fallback.opensAt || !fallback.closesAt) return [];
  return [{ startsAt: fallback.opensAt, endsAt: fallback.closesAt, priceAfn: null }];
}

export class TimetableService {
  constructor(
    private readonly repository: TimetableRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async ownerVenue(ownerUserId: string) {
    const venue = await this.repository.getVenueByOwner(ownerUserId);
    if (!venue) throw errors.badRequest("VENUE_REQUIRED", "Complete venue setup first.");
    return venue;
  }

  async list(ownerUserId: string): Promise<VenueTimetableListResponse> {
    const venue = await this.ownerVenue(ownerUserId);
    const [records, exceptions] = await Promise.all([
      this.repository.listTimetables(venue.id),
      this.repository.listExceptions(venue.id),
    ]);
    const today = localDateForInstant(this.now(), venue.timezone);
    const published = records.filter((item) => item.status === "PUBLISHED");
    const current = recordForDate(published, today);
    const future = published
      .filter((item) => item.id !== current?.id && item.effectiveFrom > today)
      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
    const history = records
      .filter((item) =>
        item.status === "ARCHIVED"
        || (item.status === "PUBLISHED" && Boolean(item.effectiveUntil) && item.effectiveUntil! < today)
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return {
      current: current ? toDto(current) : null,
      drafts: records.filter((item) => item.status === "DRAFT").sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).map(toDto),
      future: future.map(toDto),
      archived: history.map(toDto),
      exceptions: exceptions.map(exceptionDto),
    };
  }

  async createDraft(ownerUserId: string, draft: VenueTimetableDraftRequest) {
    const venue = await this.ownerVenue(ownerUserId);
    ensureAreaReferences(venue, draft.periods);
    return { timetable: toDto(await this.repository.createTimetable({ venueId: venue.id, ownerUserId, draft })) };
  }

  async updateDraft(ownerUserId: string, timetableId: string, draft: VenueTimetableDraftRequest) {
    const venue = await this.ownerVenue(ownerUserId);
    ensureAreaReferences(venue, draft.periods);
    const existing = await this.repository.getTimetable(timetableId);
    if (!existing || existing.venueId !== venue.id) throw errors.badRequest("TIMETABLE_NOT_FOUND", "Timetable not found.");
    if (existing.status !== "DRAFT") throw errors.badRequest("TIMETABLE_IMMUTABLE", "Published timetable history cannot be edited. Duplicate it to create a new draft.");
    return { timetable: toDto(await this.repository.updateDraft({ timetableId, venueId: venue.id, draft })) };
  }

  async duplicate(ownerUserId: string, timetableId: string) {
    const venue = await this.ownerVenue(ownerUserId);
    const source = await this.repository.getTimetable(timetableId);
    if (!source || source.venueId !== venue.id) throw errors.badRequest("TIMETABLE_NOT_FOUND", "Timetable not found.");
    return { timetable: toDto(await this.repository.duplicateTimetable({ source, ownerUserId })) };
  }

  async deleteDraft(ownerUserId: string, timetableId: string) {
    const venue = await this.ownerVenue(ownerUserId);
    if (!(await this.repository.deleteDraft(timetableId, venue.id))) {
      throw errors.badRequest("TIMETABLE_DELETE_DENIED", "Only draft timetables can be permanently deleted.");
    }
    return { deleted: true };
  }

  private intervalAllowedBy(
    timetable: TimetableRecord,
    exceptions: TimetableExceptionRecord[],
    venue: TimetableVenueRecord,
    areaId: string,
    startsAt: Date,
    endsAt: Date,
  ) {
    const localDate = localDateForInstant(startsAt, venue.timezone);
    if (localDateForInstant(new Date(endsAt.getTime() - 1), venue.timezone) !== localDate) return false;
    const periods = periodsFor(timetable, exceptions, localDate, areaId) ?? [];
    return periods.some((period) => {
      const open = localDateTimeToUtc(localDate, period.startsAt, venue.timezone);
      const close = localDateTimeToUtc(localDate, period.endsAt, venue.timezone);
      return startsAt.getTime() >= open.getTime() && endsAt.getTime() <= close.getTime();
    });
  }

  async publish(ownerUserId: string, timetableId: string): Promise<VenueTimetablePublishResponse> {
    const venue = await this.ownerVenue(ownerUserId);
    const [draft, records, exceptions] = await Promise.all([
      this.repository.getTimetable(timetableId),
      this.repository.listTimetables(venue.id),
      this.repository.listExceptions(venue.id),
    ]);
    if (!draft || draft.venueId !== venue.id || draft.status !== "DRAFT") {
      throw errors.badRequest("TIMETABLE_DRAFT_REQUIRED", "Choose a draft timetable to publish.");
    }

    ensureAreaReferences(venue, draft.periods);
    const today = localDateForInstant(this.now(), venue.timezone);
    const checkFrom = draft.effectiveFrom > today ? draft.effectiveFrom : today;
    const checkTo = draft.effectiveUntil ?? addDays(checkFrom, 730);
    const bounds = {
      startsAt: dayBounds(checkFrom, venue.timezone).startsAt,
      endsAt: dayBounds(addDays(checkTo, 1), venue.timezone).startsAt,
    };
    const occupancies = await this.repository.listOccupancies(venue.id, bounds.startsAt, bounds.endsAt);
    const conflicts: VenueTimetableConflict[] = occupancies
      .filter((item): item is TimetableOccupancyRecord & { type: "BOOKING" | "BLOCK" | "COMPETITION_MATCH" } => item.type !== "PROMOTION")
      .filter((item) => !this.intervalAllowedBy(draft, exceptions, venue, item.areaId, item.startsAt, item.endsAt))
      .map((item) => ({
        type: item.type,
        areaId: item.areaId,
        areaName: item.areaName,
        startsAt: item.startsAt.toISOString(),
        endsAt: item.endsAt.toISOString(),
        title: item.title,
      }));

    if (conflicts.length) {
      return { timetable: toDto(draft), conflicts };
    }

    const publishedAt = this.now();
    const overlapping = records.filter((item) => item.status === "PUBLISHED" && rangesOverlap(item, draft));
    const predecessor = overlapping
      .filter((item) => item.effectiveFrom < draft.effectiveFrom)
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0] ?? null;

    if (predecessor) {
      const previousDay = addDays(draft.effectiveFrom, -1);
      if (!predecessor.effectiveUntil || predecessor.effectiveUntil >= draft.effectiveFrom) {
        await this.repository.truncatePublishedTimetable({
          timetableId: predecessor.id,
          venueId: venue.id,
          effectiveUntil: previousDay,
          updatedAt: publishedAt,
        });
      }
    }

    const archiveIds = overlapping
      .filter((item) => item.id !== predecessor?.id && item.effectiveFrom >= draft.effectiveFrom)
      .map((item) => item.id);
    const published = await this.repository.publishTimetable({
      timetableId,
      venueId: venue.id,
      archiveIds,
      publishedAt,
    });
    return { timetable: toDto(published), conflicts: [] };
  }

  async archive(ownerUserId: string, timetableId: string) {
    const venue = await this.ownerVenue(ownerUserId);
    const record = await this.repository.getTimetable(timetableId);
    if (!record || record.venueId !== venue.id) throw errors.badRequest("TIMETABLE_NOT_FOUND", "Timetable not found.");
    const today = localDateForInstant(this.now(), venue.timezone);
    if (
      record.status === "PUBLISHED"
      && record.effectiveFrom <= today
      && (!record.effectiveUntil || record.effectiveUntil >= today)
    ) {
      throw errors.badRequest("TIMETABLE_ACTIVE", "Publish a replacement timetable before archiving the active timetable.");
    }
    const archived = await this.repository.archiveTimetable(timetableId, venue.id, this.now());
    if (!archived) throw errors.badRequest("TIMETABLE_ARCHIVE_DENIED", "Only published timetables can be archived.");
    return { timetable: toDto(archived) };
  }

  private async assertExceptionSafe(
    venue: TimetableVenueRecord,
    input: VenueTimetableExceptionRequest,
    ignoreExceptionId?: string,
  ) {
    const today = localDateForInstant(this.now(), venue.timezone);
    if (input.date < today) {
      throw errors.badRequest("TIMETABLE_EXCEPTION_PAST", "Special schedules can only be created or edited for today or a future date.");
    }

    const [records, sameDateExceptions] = await Promise.all([
      this.repository.listTimetables(venue.id),
      this.repository.listExceptions(venue.id, input.date, input.date),
    ]);
    if (!recordForDate(records, input.date)) {
      throw errors.badRequest(
        "TIMETABLE_EXCEPTION_REQUIRES_TIMETABLE",
        "Publish a weekly timetable that covers this date before creating a special schedule.",
      );
    }

    const duplicate = sameDateExceptions.find((item) =>
      item.id !== ignoreExceptionId && item.areaId === input.areaId
    );
    if (duplicate) {
      throw errors.conflict(
        "TIMETABLE_EXCEPTION_EXISTS",
        "A special schedule already exists for this date. Edit the existing one instead.",
        { exceptionId: duplicate.id, date: duplicate.date },
      );
    }

    const affectedAreaIds = input.areaId
      ? [input.areaId]
      : venue.areas.filter((area) => area.active).map((area) => area.id);
    const bounds = dayBounds(input.date, venue.timezone);
    const occupancies = (await this.repository.listOccupancies(
      venue.id,
      bounds.startsAt,
      bounds.endsAt,
    )).filter((item) => item.type !== "PROMOTION" && affectedAreaIds.includes(item.areaId));

    const conflicts = occupancies.filter((item) => {
      if (input.isClosed) return true;
      return !input.periods.some((period) => {
        const open = localDateTimeToUtc(input.date, period.startsAt, venue.timezone);
        const close = localDateTimeToUtc(input.date, period.endsAt, venue.timezone);
        return item.startsAt.getTime() >= open.getTime() && item.endsAt.getTime() <= close.getTime();
      });
    });

    if (conflicts.length) {
      throw errors.conflict(
        "TIMETABLE_EXCEPTION_CONFLICT",
        "Existing bookings, blocks, or competition matches fall outside this special schedule.",
        {
          conflicts: conflicts.map((item) => ({
            type: item.type,
            areaId: item.areaId,
            areaName: item.areaName,
            startsAt: item.startsAt.toISOString(),
            endsAt: item.endsAt.toISOString(),
            title: item.title,
          })),
        },
      );
    }
  }

  async createException(ownerUserId: string, input: VenueTimetableExceptionRequest) {
    const venue = await this.ownerVenue(ownerUserId);
    ensureAreaReferences(venue, [{ areaId: input.areaId }]);
    await this.assertExceptionSafe(venue, input);
    return { exception: exceptionDto(await this.repository.createException({ venueId: venue.id, ownerUserId, exception: input })) };
  }

  async updateException(ownerUserId: string, exceptionId: string, input: VenueTimetableExceptionRequest) {
    const venue = await this.ownerVenue(ownerUserId);
    ensureAreaReferences(venue, [{ areaId: input.areaId }]);
    const existing = await this.repository.getException(exceptionId);
    if (!existing || existing.venueId !== venue.id) {
      throw errors.badRequest("TIMETABLE_EXCEPTION_NOT_FOUND", "Special schedule not found.");
    }
    await this.assertExceptionSafe(venue, input, exceptionId);
    const updated = await this.repository.updateException({
      exceptionId,
      venueId: venue.id,
      exception: input,
    });
    if (!updated) throw errors.badRequest("TIMETABLE_EXCEPTION_NOT_FOUND", "Special schedule not found.");
    return { exception: exceptionDto(updated) };
  }

  async deleteException(ownerUserId: string, exceptionId: string) {
    const venue = await this.ownerVenue(ownerUserId);
    const existing = await this.repository.getException(exceptionId);
    if (!existing || existing.venueId !== venue.id) {
      throw errors.badRequest("TIMETABLE_EXCEPTION_NOT_FOUND", "Special schedule not found.");
    }

    const today = localDateForInstant(this.now(), venue.timezone);
    if (existing.date >= today) {
      const [records, sameDateExceptions] = await Promise.all([
        this.repository.listTimetables(venue.id),
        this.repository.listExceptions(venue.id, existing.date, existing.date),
      ]);
      const timetable = recordForDate(records, existing.date);
      if (timetable) {
        const remaining = sameDateExceptions.filter((item) => item.id !== exceptionId);
        const bounds = dayBounds(existing.date, venue.timezone);
        const affectedAreaIds = existing.areaId
          ? [existing.areaId]
          : venue.areas.filter((area) => area.active).map((area) => area.id);
        const conflicts = (await this.repository.listOccupancies(
          venue.id,
          bounds.startsAt,
          bounds.endsAt,
        ))
          .filter((item) => item.type !== "PROMOTION" && affectedAreaIds.includes(item.areaId))
          .filter((item) => !this.intervalAllowedBy(
            timetable,
            remaining,
            venue,
            item.areaId,
            item.startsAt,
            item.endsAt,
          ));

        if (conflicts.length) {
          throw errors.conflict(
            "TIMETABLE_EXCEPTION_DELETE_CONFLICT",
            "Deleting this special schedule would place existing activity outside the regular weekly timetable.",
            {
              conflicts: conflicts.map((item) => ({
                type: item.type,
                areaId: item.areaId,
                areaName: item.areaName,
                startsAt: item.startsAt.toISOString(),
                endsAt: item.endsAt.toISOString(),
                title: item.title,
              })),
            },
          );
        }
      }
    }

    if (!(await this.repository.deleteException(exceptionId, venue.id))) {
      throw errors.badRequest("TIMETABLE_EXCEPTION_NOT_FOUND", "Special schedule not found.");
    }
    return { deleted: true };
  }

  async resolveDay(input: {
    venueId: string;
    date: string;
    areaId: string;
    fallback?: VenueOpeningHourInput;
  }): Promise<ResolvedTimetableDay> {
    dateParts(input.date);
    const [records, exceptions] = await Promise.all([
      this.repository.listTimetables(input.venueId),
      this.repository.listExceptions(input.venueId, input.date, input.date),
    ]);
    const active = recordForDate(records, input.date);
    if (!active) {
      return {
        periods: legacyPeriods(input.fallback),
        slotDurationMinutes: null,
        bufferMinutes: 0,
        source: "LEGACY",
      };
    }
    return {
      periods: periodsFor(active, exceptions, input.date, input.areaId) ?? [],
      slotDurationMinutes: active.defaultSlotDurationMinutes,
      bufferMinutes: active.bufferMinutes,
      source: "TIMETABLE",
    };
  }

  async assertIntervalAllowed(input: {
    venueId: string;
    areaId: string;
    startsAt: Date;
    endsAt: Date;
    timeZone: string;
    fallback?: VenueOpeningHourInput;
  }) {
    const date = localDateForInstant(input.startsAt, input.timeZone);
    if (localDateForInstant(new Date(input.endsAt.getTime() - 1), input.timeZone) !== date) {
      throw errors.badRequest("OUTSIDE_TIMETABLE", "The interval must stay within one operating day.");
    }
    const resolved = await this.resolveDay({
      venueId: input.venueId,
      date,
      areaId: input.areaId,
      ...(input.fallback ? { fallback: input.fallback } : {}),
    });
    const allowedPeriod = resolved.periods.find((period) => {
      const open = localDateTimeToUtc(date, period.startsAt, input.timeZone);
      const close = localDateTimeToUtc(date, period.endsAt, input.timeZone);
      return input.startsAt.getTime() >= open.getTime() && input.endsAt.getTime() <= close.getTime();
    });
    if (!allowedPeriod) throw errors.badRequest("OUTSIDE_TIMETABLE", "This interval is outside the published venue timetable.");
    return allowedPeriod;
  }

  async calendar(ownerUserId: string, from: string, to: string, areaId: string | null): Promise<VenueTimetableCalendarResponse> {
    dateParts(from);
    dateParts(to);
    const span = daysBetween(from, to);
    if (span < 0 || span > 41) throw errors.badRequest("CALENDAR_RANGE_INVALID", "Calendar range must be between 1 and 42 days.");

    const venue = await this.ownerVenue(ownerUserId);
    if (areaId && !venue.areas.some((area) => area.id === areaId)) {
      throw errors.badRequest("AREA_NOT_AVAILABLE", "This area is not part of the venue.");
    }

    const [records, exceptions] = await Promise.all([
      this.repository.listTimetables(venue.id),
      this.repository.listExceptions(venue.id, from, to),
    ]);
    const rangeStart = dayBounds(from, venue.timezone).startsAt;
    const rangeEnd = dayBounds(addDays(to, 1), venue.timezone).startsAt;
    const rawEvents = await this.repository.listOccupancies(venue.id, rangeStart, rangeEnd);
    const selectedAreas = venue.areas.filter((area) => area.active && (!areaId || area.id === areaId));
    const days: VenueCalendarDay[] = [];

    for (let offset = 0; offset <= span; offset += 1) {
      const date = addDays(from, offset);
      const record = recordForDate(records, date);
      const eventsForDate = rawEvents.filter((event) => localDateForInstant(event.startsAt, venue.timezone) === date);
      const events: VenueCalendarEvent[] = [];
      let availableCount = 0;
      let closedAreas = 0;

      for (const area of selectedAreas) {
        const periods = periodsFor(record, exceptions, date, area.id)
          ?? [];
        if (!periods.length) {
          closedAreas += 1;
          events.push({
            id: `closed-${area.id}-${date}`,
            type: "CLOSED",
            areaId: area.id,
            areaName: area.name,
            startsAt: null,
            endsAt: null,
            title: "Closed",
            priceAfn: null,
          });
          continue;
        }

        const durationMinutes = record?.defaultSlotDurationMinutes ?? area.defaultSessionDurationMinutes;
        const bufferMinutes = record?.bufferMinutes ?? 0;
        const stepMs = (durationMinutes + bufferMinutes) * 60_000;
        const durationMs = durationMinutes * 60_000;
        const blocking = eventsForDate.filter((event) =>
          event.areaId === area.id && event.type !== "PROMOTION"
        );
        const promotions = eventsForDate.filter((event) =>
          event.areaId === area.id && event.type === "PROMOTION"
        );

        for (const period of periods) {
          const open = localDateTimeToUtc(date, period.startsAt, venue.timezone);
          const close = localDateTimeToUtc(date, period.endsAt, venue.timezone);
          for (let cursor = open.getTime(); cursor + durationMs <= close.getTime(); cursor += stepMs) {
            const startsAt = new Date(cursor);
            const endsAt = new Date(cursor + durationMs);
            if (blocking.some((event) => intervalOverlaps(startsAt, endsAt, event.startsAt, event.endsAt))) continue;
            const promotion = promotions.find((event) => intervalOverlaps(startsAt, endsAt, event.startsAt, event.endsAt));
            availableCount += 1;
            events.push({
              id: `available-${area.id}-${startsAt.toISOString()}`,
              type: promotion ? "PROMOTION" : "AVAILABLE",
              areaId: area.id,
              areaName: area.name,
              startsAt: startsAt.toISOString(),
              endsAt: endsAt.toISOString(),
              title: promotion?.title ?? "Available",
              priceAfn: promotion?.priceAfn ?? period.priceAfn ?? area.basePriceAfn,
            });
          }
        }
      }

      for (const event of eventsForDate) {
        if (areaId && event.areaId !== areaId) continue;
        if (event.type === "PROMOTION") continue;
        const area = selectedAreas.find((candidate) => candidate.id === event.areaId);
        const eventPeriods = periodsFor(record, exceptions, date, event.areaId) ?? [];
        const eventStartTime = new Intl.DateTimeFormat("en-GB", {
          timeZone: venue.timezone,
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(event.startsAt);
        const timetablePeriod = eventPeriods.find((period) =>
          eventStartTime >= period.startsAt && eventStartTime < period.endsAt
        );
        events.push({
          id: event.id,
          type: event.type === "BOOKING"
            ? (event.source === "MANUAL" ? "MANUAL_BOOKING" : "ONLINE_BOOKING")
            : event.type === "COMPETITION_MATCH"
              ? "COMPETITION"
              : event.type === "BLOCK"
                ? "BLOCKED"
                : "PROMOTION",
          areaId: event.areaId,
          areaName: event.areaName,
          startsAt: event.startsAt.toISOString(),
          endsAt: event.endsAt.toISOString(),
          title: event.title,
          priceAfn: event.priceAfn ?? timetablePeriod?.priceAfn ?? area?.basePriceAfn ?? null,
        });
      }

      days.push({
        date,
        availableCount,
        bookedCount: eventsForDate.filter((item) => item.type === "BOOKING").length,
        manualCount: eventsForDate.filter((item) => item.type === "BOOKING" && item.source === "MANUAL").length,
        competitionCount: eventsForDate.filter((item) => item.type === "COMPETITION_MATCH").length,
        blockedCount: eventsForDate.filter((item) => item.type === "BLOCK").length,
        promotionCount: eventsForDate.filter((item) => item.type === "PROMOTION").length,
        revenueAfn: eventsForDate
          .filter((item) => item.type === "BOOKING")
          .reduce((sum, item) => sum + (item.priceAfn ?? 0), 0),
        closed: selectedAreas.length > 0 && closedAreas === selectedAreas.length,
        events: events.sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? "") || a.areaName.localeCompare(b.areaName)),
      });
    }

    return {
      from,
      to,
      generatedAt: this.now().toISOString(),
      areaId,
      days,
    };
  }
}
