import type {
  AdminSubscriptionActivationRequest,
  AdminSupportNoteRequest,
  AdminTrialExtensionRequest,
  AdminUserStatusRequest,
  AdminVenueActionRequest,
  OwnerAnalyticsResponse,
  OwnerBillingSummary,
  PlatformSettingsDto,
  PlatformSettingsUpdateRequest,
  VenueSubscriptionDto,
} from "@leaguekick/contracts";
import { errors } from "../../lib/errors.js";
import { evaluateVenueEntitlement } from "../billing/entitlement.js";
import type {
  CommercialRepository,
  CommercialSettingsRecord,
  CommercialSubscriptionRecord,
  OwnerAnalyticsSnapshot,
} from "./commercial.types.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SETTINGS = {
  monthlyPriceAfn: 1000,
  annualPriceAfn: 12000,
  trialDurationHours: 72,
  featureFlags: {},
  notificationTemplates: {},
} satisfies Omit<CommercialSettingsRecord, "updatedAt">;

function toSettingsDto(settings: CommercialSettingsRecord | null, now: Date): PlatformSettingsDto {
  return {
    monthlyPriceAfn: settings?.monthlyPriceAfn ?? DEFAULT_SETTINGS.monthlyPriceAfn,
    annualPriceAfn: settings?.annualPriceAfn ?? DEFAULT_SETTINGS.annualPriceAfn,
    trialDurationHours: settings?.trialDurationHours ?? DEFAULT_SETTINGS.trialDurationHours,
    featureFlags: settings?.featureFlags ?? DEFAULT_SETTINGS.featureFlags,
    notificationTemplates: settings?.notificationTemplates ?? DEFAULT_SETTINGS.notificationTemplates,
    updatedAt: (settings?.updatedAt ?? now).toISOString(),
  };
}

function toSubscriptionDto(
  subscription: CommercialSubscriptionRecord | null,
  now: Date,
): VenueSubscriptionDto {
  if (!subscription) {
    return {
      state: "NOT_STARTED",
      accessMode: "NONE",
      canCreateBookableInventory: false,
      canServiceExistingBookings: false,
      trialStartedAt: null,
      trialEndsAt: null,
      activeUntil: null,
      remainingSeconds: null,
    };
  }
  const entitlement = evaluateVenueEntitlement(subscription, now);
  return {
    state: entitlement.state,
    accessMode: entitlement.accessMode,
    canCreateBookableInventory: entitlement.canCreateBookableInventory,
    canServiceExistingBookings: entitlement.canServiceExistingBookings,
    trialStartedAt: subscription.trialStartedAt?.toISOString() ?? null,
    trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
    activeUntil: subscription.activeUntil?.toISOString() ?? null,
    remainingSeconds: entitlement.state === "TRIAL" && subscription.trialEndsAt
      ? Math.max(0, Math.floor((subscription.trialEndsAt.getTime() - now.getTime()) / 1000))
      : null,
  };
}

function dateParts(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) throw errors.badRequest("INVALID_DATE", "Use YYYY-MM-DD.");
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
  const values = Object.fromEntries(
    formatter.formatToParts(instant)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  ) - instant.getTime();
}

function localMidnightToUtc(date: string, timeZone: string): Date {
  const { year, month, day } = dateParts(date);
  const guess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const first = new Date(guess.getTime() - timeZoneOffsetMs(guess, timeZone));
  return new Date(guess.getTime() - timeZoneOffsetMs(first, timeZone));
}

function addDateDays(date: string, days: number): string {
  const { year, month, day } = dateParts(date);
  return new Date(Date.UTC(year, month - 1, day) + days * DAY_MS).toISOString().slice(0, 10);
}

function dateDistance(from: string, to: string): number {
  const a = dateParts(from);
  const b = dateParts(to);
  return Math.round((
    Date.UTC(b.year, b.month - 1, b.day) -
    Date.UTC(a.year, a.month - 1, a.day)
  ) / DAY_MS);
}

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (Number(eh) * 60 + Number(em)) - (Number(sh) * 60 + Number(sm)));
}

function localDateKey(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function localHour(value: Date, timeZone: string): number {
  return Number(new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(value));
}

function durationMinutes(startsAt: Date, endsAt: Date): number {
  return Math.max(0, Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000));
}

function inDateRange(value: Date, from: string, to: string, timeZone: string): boolean {
  const key = localDateKey(value, timeZone);
  return key >= from && key <= to;
}

function customerKey(booking: OwnerAnalyticsSnapshot["bookings"][number]): string | null {
  if (booking.playerUserId) return `user:${booking.playerUserId}`;
  if (booking.customerPhone?.trim()) return `phone:${booking.customerPhone.replace(/\D/g, "")}`;
  if (booking.customerName?.trim()) return `name:${booking.customerName.trim().toLocaleLowerCase("en-US")}`;
  return null;
}

function scheduledMinutesForDate(snapshot: OwnerAnalyticsSnapshot, date: string): number {
  const exception = snapshot.exceptions
    .filter((item) => item.date === date)
    .sort((a, b) => Number(Boolean(b.areaId)) - Number(Boolean(a.areaId)))[0];
  if (exception) {
    if (exception.isClosed) return 0;
    return exception.periods.reduce((sum, period) => sum + minutesBetween(period.startsAt, period.endsAt), 0);
  }

  const timetable = snapshot.timetables
    .filter((item) => item.effectiveFrom <= date && (!item.effectiveUntil || item.effectiveUntil >= date))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  if (timetable) {
    const { year, month, day } = dateParts(date);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return timetable.periods
      .filter((period) => period.dayOfWeek === weekday)
      .reduce((sum, period) => sum + minutesBetween(period.startsAt, period.endsAt), 0);
  }

  const { year, month, day } = dateParts(date);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const hours = snapshot.openingHours.find((item) => item.dayOfWeek === weekday);
  if (!hours || hours.isClosed || !hours.opensAt || !hours.closesAt) return 0;
  return minutesBetween(hours.opensAt, hours.closesAt) * Math.max(1, snapshot.activeAreaCount);
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous;
}

type AnalyticsSummary = Omit<OwnerAnalyticsResponse, "comparison">;

function summarizeAnalytics(
  snapshot: OwnerAnalyticsSnapshot,
  from: string,
  to: string,
  generatedAt: string,
): AnalyticsSummary {
  const distance = dateDistance(from, to);
  const timeZone = snapshot.venue.timezone;
  const nonCancelled = snapshot.bookings.filter((booking) => booking.status !== "CANCELLED");
  const confirmed = snapshot.bookings.filter((booking) => booking.status === "CONFIRMED");
  const cancelled = snapshot.bookings.filter((booking) => booking.status === "CANCELLED");
  const online = nonCancelled.filter((booking) => booking.source === "ONLINE");
  const manual = nonCancelled.filter((booking) => booking.source === "MANUAL");

  const daily = Array.from({ length: distance + 1 }, (_, offset) => {
    const date = addDateDays(from, offset);
    const dayBookings = snapshot.bookings.filter((booking) => localDateKey(booking.startsAt, timeZone) === date);
    const activeBookings = dayBookings.filter((booking) => booking.status !== "CANCELLED");
    const scheduledMinutes = scheduledMinutesForDate(snapshot, date);
    const bookedMinutes = activeBookings.reduce(
      (sum, booking) => sum + durationMinutes(booking.startsAt, booking.endsAt),
      0,
    );
    return {
      date,
      bookingCount: dayBookings.length,
      confirmedBookingCount: dayBookings.filter((booking) => booking.status === "CONFIRMED").length,
      cancelledBookingCount: dayBookings.filter((booking) => booking.status === "CANCELLED").length,
      revenueAfn: activeBookings.reduce((sum, booking) => sum + booking.priceAfn, 0),
      bookedMinutes,
      scheduledMinutes,
      occupancyRate: scheduledMinutes ? Math.min(1, bookedMinutes / scheduledMinutes) : 0,
    };
  });

  const scheduledMinutes = daily.reduce((sum, item) => sum + item.scheduledMinutes, 0);
  const bookedMinutes = nonCancelled.reduce(
    (sum, booking) => sum + durationMinutes(booking.startsAt, booking.endsAt),
    0,
  );
  const blockedMinutes = snapshot.blocks.reduce(
    (sum, block) => sum + durationMinutes(block.startsAt, block.endsAt),
    0,
  );
  const activeCompetitionMatches = snapshot.competitionMatches.filter(
    (match) => match.status !== "CANCELLED" && match.startsAt && match.endsAt,
  );
  const competitionMinutes = activeCompetitionMatches.reduce(
    (sum, match) => sum + durationMinutes(match.startsAt!, match.endsAt!),
    0,
  );

  const grossBookingValueAfn = nonCancelled.reduce((sum, booking) => sum + booking.priceAfn, 0);
  const cancelledBookingValueAfn = cancelled.reduce((sum, booking) => sum + booking.priceAfn, 0);

  const customerCounts = new Map<string, number>();
  for (const booking of nonCancelled) {
    const key = customerKey(booking);
    if (!key) continue;
    customerCounts.set(key, (customerCounts.get(key) ?? 0) + 1);
  }
  const uniqueCustomerCount = customerCounts.size;
  const repeatCustomerCount = [...customerCounts.values()].filter((count) => count > 1).length;

  const promotionBookings = nonCancelled.filter((booking) => snapshot.promotions.some(
    (promotion) =>
      promotion.areaId === booking.areaId &&
      promotion.startsAt.getTime() === booking.startsAt.getTime() &&
      promotion.endsAt.getTime() === booking.endsAt.getTime(),
  ));
  const discountGrantedAfn = promotionBookings.reduce((sum, booking) => {
    const promotion = snapshot.promotions.find(
      (item) =>
        item.areaId === booking.areaId &&
        item.startsAt.getTime() === booking.startsAt.getTime() &&
        item.endsAt.getTime() === booking.endsAt.getTime(),
    );
    return sum + Math.max(0, (promotion?.originalPriceAfn ?? booking.priceAfn) - booking.priceAfn);
  }, 0);
  const discountPercents = snapshot.promotions
    .filter((promotion) => promotion.originalPriceAfn > 0)
    .map((promotion) => ((promotion.originalPriceAfn - promotion.discountedPriceAfn) / promotion.originalPriceAfn) * 100);

  const postLikeCount = snapshot.posts.reduce((sum, post) => sum + post.likeCount, 0);
  const postCommentCount = snapshot.posts.reduce((sum, post) => sum + post.commentCount, 0);
  const selectedCompetitions = snapshot.competitions.filter((competition) =>
    inDateRange(competition.startsAt ?? competition.createdAt, from, to, timeZone),
  );
  const selectedCompetitionIds = new Set(selectedCompetitions.map((competition) => competition.id));
  const selectedCompetitionTeams = snapshot.competitionTeams.filter((team) => selectedCompetitionIds.has(team.competitionId));
  const feeByCompetition = new Map(selectedCompetitions.map((competition) => [competition.id, competition.registrationFeeAfn]));
  const competitionFeesCollectedAfn = selectedCompetitionTeams
    .filter((team) => team.feeStatus === "PAID")
    .reduce((sum, team) => sum + (feeByCompetition.get(team.competitionId) ?? 0), 0);

  const weekdays = Array.from({ length: 7 }, (_, dayOfWeek) => {
    const days = daily.filter((item) => {
      const { year, month, day } = dateParts(item.date);
      return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === dayOfWeek;
    });
    const dayScheduled = days.reduce((sum, item) => sum + item.scheduledMinutes, 0);
    const dayBooked = days.reduce((sum, item) => sum + item.bookedMinutes, 0);
    return {
      dayOfWeek,
      bookingCount: days.reduce((sum, item) => sum + item.bookingCount, 0),
      revenueAfn: days.reduce((sum, item) => sum + item.revenueAfn, 0),
      bookedMinutes: dayBooked,
      scheduledMinutes: dayScheduled,
      occupancyRate: dayScheduled ? Math.min(1, dayBooked / dayScheduled) : 0,
    };
  });

  const hours = Array.from({ length: 24 }, (_, hour) => {
    const bookingsAtHour = nonCancelled.filter((booking) => localHour(booking.startsAt, timeZone) === hour);
    return {
      hour,
      bookingCount: bookingsAtHour.length,
      revenueAfn: bookingsAtHour.reduce((sum, booking) => sum + booking.priceAfn, 0),
    };
  });

  const cancellationMap = new Map<string, number>();
  for (const booking of cancelled) {
    const reason = booking.cancellationReason?.trim() || "UNSPECIFIED";
    cancellationMap.set(reason, (cancellationMap.get(reason) ?? 0) + 1);
  }
  const cancellationReasons = [...cancellationMap.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
    .slice(0, 6);

  const peakDay = [...weekdays].sort((a, b) => b.bookingCount - a.bookingCount || b.revenueAfn - a.revenueAfn)[0];
  const peakHourPoint = [...hours].sort((a, b) => b.bookingCount - a.bookingCount || b.revenueAfn - a.revenueAfn)[0];
  const bestRevenue = [...daily].sort((a, b) => b.revenueAfn - a.revenueAfn || b.bookingCount - a.bookingCount)[0];

  const occupancyRate = scheduledMinutes ? Math.min(1, bookedMinutes / scheduledMinutes) : 0;
  const productiveUtilizationRate = scheduledMinutes
    ? Math.min(1, (bookedMinutes + competitionMinutes) / scheduledMinutes)
    : 0;
  const blockedRate = scheduledMinutes ? Math.min(1, blockedMinutes / scheduledMinutes) : 0;

  return {
    from,
    to,
    generatedAt,
    bookingCount: snapshot.bookings.length,
    confirmedBookingCount: confirmed.length,
    cancelledBookingCount: cancelled.length,
    onlineBookingCount: online.length,
    manualBookingCount: manual.length,
    onlineBookingShare: nonCancelled.length ? online.length / nonCancelled.length : 0,
    confirmedRate: snapshot.bookings.length ? confirmed.length / snapshot.bookings.length : 0,
    cancellationRate: snapshot.bookings.length ? cancelled.length / snapshot.bookings.length : 0,

    grossBookingValueAfn,
    cancelledBookingValueAfn,
    averageBookingValueAfn: nonCancelled.length ? Math.round(grossBookingValueAfn / nonCancelled.length) : 0,
    revenuePerBookedHourAfn: bookedMinutes ? Math.round(grossBookingValueAfn / (bookedMinutes / 60)) : 0,

    bookedMinutes,
    availableMinutes: scheduledMinutes,
    scheduledMinutes,
    competitionMinutes,
    blockedMinutes,
    remainingOpenMinutes: Math.max(0, scheduledMinutes - bookedMinutes - competitionMinutes - blockedMinutes),
    occupancyRate,
    productiveUtilizationRate,
    blockedRate,

    uniqueCustomerCount,
    repeatCustomerCount,
    repeatCustomerRate: uniqueCustomerCount ? repeatCustomerCount / uniqueCustomerCount : 0,
    averageBookingsPerCustomer: uniqueCustomerCount ? nonCancelled.length / uniqueCustomerCount : 0,

    promotionCount: snapshot.promotions.length,
    promotionBookingCount: promotionBookings.length,
    promotionRevenueAfn: promotionBookings.reduce((sum, booking) => sum + booking.priceAfn, 0),
    discountGrantedAfn,
    averageDiscountPercent: discountPercents.length
      ? discountPercents.reduce((sum, value) => sum + value, 0) / discountPercents.length
      : 0,

    followerCount: snapshot.followerCount,
    newFollowerCount: snapshot.followerCreatedAt.filter((createdAt) => inDateRange(createdAt, from, to, timeZone)).length,
    postCount: snapshot.posts.length,
    postLikeCount,
    postCommentCount,
    engagementPerPost: snapshot.posts.length ? (postLikeCount + postCommentCount) / snapshot.posts.length : 0,

    competitionCount: selectedCompetitions.length,
    activeCompetitionCount: selectedCompetitions.filter((competition) =>
      ["REGISTRATION_OPEN", "REGISTRATION_CLOSED", "SCHEDULED", "IN_PROGRESS"].includes(competition.status),
    ).length,
    completedCompetitionCount: selectedCompetitions.filter((competition) => competition.status === "COMPLETED").length,
    competitionTeamCount: selectedCompetitionTeams.filter((team) => team.status === "ACCEPTED").length,
    competitionMatchCount: activeCompetitionMatches.length,
    competitionFeesCollectedAfn,

    peakDayOfWeek: peakDay && peakDay.bookingCount > 0 ? peakDay.dayOfWeek : null,
    peakHour: peakHourPoint && peakHourPoint.bookingCount > 0 ? peakHourPoint.hour : null,
    bestRevenueDate: bestRevenue && bestRevenue.revenueAfn > 0 ? bestRevenue.date : null,

    daily,
    weekdays,
    hours,
    cancellationReasons,
  };
}

export class CommercialService {
  constructor(
    private readonly repository: CommercialRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async ownerBilling(ownerUserId: string): Promise<OwnerBillingSummary> {
    const venue = await this.repository.getOwnerVenue(ownerUserId);
    if (!venue) throw errors.badRequest("VENUE_REQUIRED", "Complete venue setup first.");
    const now = this.now();
    const [settings, payments] = await Promise.all([
      this.repository.getSettings(),
      this.repository.listPayments(venue.id),
    ]);
    const subscription = toSubscriptionDto(venue.subscription, now);
    return {
      venueId: venue.id,
      verificationStatus: venue.verificationStatus,
      subscription,
      settings: toSettingsDto(settings, now),
      payments,
      canReactivate: subscription.accessMode !== "FULL",
    };
  }

  async requestReactivation(ownerUserId: string) {
    const venue = await this.repository.getOwnerVenue(ownerUserId);
    if (!venue) throw errors.badRequest("VENUE_REQUIRED", "Complete venue setup first.");
    const entitlement = evaluateVenueEntitlement(venue.subscription, this.now());
    if (entitlement.accessMode === "FULL") {
      throw errors.conflict("SUBSCRIPTION_ALREADY_ACTIVE", "This venue already has active Premium access.");
    }
    await this.repository.requestReactivation(ownerUserId, venue.id, this.now());
  }

  async ownerAnalytics(ownerUserId: string, from: string, to: string): Promise<OwnerAnalyticsResponse> {
    const distance = dateDistance(from, to);
    if (distance < 0) throw errors.badRequest("INVALID_DATE_RANGE", "The end date must be on or after the start date.");
    if (distance > 365) throw errors.badRequest("DATE_RANGE_TOO_LARGE", "Analytics range cannot exceed 366 days.");

    const venue = await this.repository.getOwnerVenue(ownerUserId);
    if (!venue) throw errors.badRequest("VENUE_REQUIRED", "Complete venue setup first.");

    const previousTo = addDateDays(from, -1);
    const previousFrom = addDateDays(previousTo, -distance);

    const startsAt = localMidnightToUtc(from, venue.timezone);
    const endsAt = localMidnightToUtc(addDateDays(to, 1), venue.timezone);
    const previousStartsAt = localMidnightToUtc(previousFrom, venue.timezone);
    const previousEndsAt = localMidnightToUtc(addDateDays(previousTo, 1), venue.timezone);

    const [snapshot, previousSnapshot] = await Promise.all([
      this.repository.analyticsSnapshot(ownerUserId, startsAt, endsAt, from, to),
      this.repository.analyticsSnapshot(ownerUserId, previousStartsAt, previousEndsAt, previousFrom, previousTo),
    ]);
    if (!snapshot || !previousSnapshot) {
      throw errors.badRequest("VENUE_REQUIRED", "Complete venue setup first.");
    }

    const generatedAt = this.now().toISOString();
    const current = summarizeAnalytics(snapshot, from, to, generatedAt);
    const previous = summarizeAnalytics(previousSnapshot, previousFrom, previousTo, generatedAt);

    return {
      ...current,
      comparison: {
        previousFrom,
        previousTo,
        revenueChangeRate: percentChange(current.grossBookingValueAfn, previous.grossBookingValueAfn),
        bookingChangeRate: percentChange(current.bookingCount, previous.bookingCount),
        occupancyChangeRate: percentChange(current.occupancyRate, previous.occupancyRate),
        cancellationRateDelta: current.cancellationRate - previous.cancellationRate,
      },
    };
  }

  adminDashboard() {
    return this.repository.adminDashboard(this.now()).then((metrics) => ({
      generatedAt: this.now().toISOString(),
      ...metrics,
    }));
  }

  listUsers(query?: string) {
    return this.repository.listUsers(query);
  }

  listVenues(query?: string) {
    return this.repository.listVenues(query);
  }

  async venuePayments(venueId: string) {
    const venue = await this.repository.getVenue(venueId);
    if (!venue) throw errors.badRequest("VENUE_NOT_FOUND", "Venue not found.");
    return this.repository.listPayments(venueId);
  }

  async duplicateVenues() {
    const venues = await this.repository.listVenues();
    const groups = new Map<string, typeof venues>();
    for (const venue of venues) {
      const key = [venue.name, venue.city, venue.address]
        .map((value) => value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " "))
        .join("|");
      groups.set(key, [...(groups.get(key) ?? []), venue]);
    }
    return [...groups.values()].filter((group) => group.length > 1);
  }

  async setUserStatus(actorUserId: string, userId: string, input: AdminUserStatusRequest) {
    await this.repository.setUserStatus(actorUserId, userId, input.status, input.reason, this.now());
  }

  async applyVenueAction(actorUserId: string, venueId: string, input: AdminVenueActionRequest) {
    await this.repository.applyVenueAction(actorUserId, venueId, input.action, input.reason, this.now());
  }

  async activateSubscription(actorUserId: string, venueId: string, input: AdminSubscriptionActivationRequest) {
    await this.repository.activateSubscription({
      actorUserId,
      venueId,
      months: input.months,
      amountAfn: input.amountAfn,
      provider: input.provider.trim(),
      providerReference: input.providerReference?.trim() || null,
      note: input.note?.trim() || null,
      now: this.now(),
    });
  }

  async extendTrial(actorUserId: string, venueId: string, input: AdminTrialExtensionRequest) {
    await this.repository.extendTrial(actorUserId, venueId, input.hours, input.reason, this.now());
  }

  async voidPayment(actorUserId: string, paymentId: string, reason: string) {
    if (reason.trim().length < 3) throw errors.badRequest("REASON_REQUIRED", "A reconciliation reason is required.");
    await this.repository.voidPayment(actorUserId, paymentId, reason.trim(), this.now());
  }

  async settings(): Promise<PlatformSettingsDto> {
    return toSettingsDto(await this.repository.getSettings(), this.now());
  }

  async updateSettings(actorUserId: string, input: PlatformSettingsUpdateRequest): Promise<PlatformSettingsDto> {
    return toSettingsDto(await this.repository.updateSettings(actorUserId, input, this.now()), this.now());
  }

  auditLogs() {
    return this.repository.listAuditLogs();
  }

  async supportNote(actorUserId: string, input: AdminSupportNoteRequest) {
    await this.repository.addSupportNote(actorUserId, input.targetType, input.targetId, input.note, this.now());
  }

  async unpublishPost(actorUserId: string, postId: string, reason: string) {
    if (reason.trim().length < 3) throw errors.badRequest("REASON_REQUIRED", "A moderation reason is required.");
    await this.repository.unpublishPost(actorUserId, postId, reason.trim(), this.now());
  }

  async closePromotion(actorUserId: string, promotionId: string, reason: string) {
    if (reason.trim().length < 3) throw errors.badRequest("REASON_REQUIRED", "A moderation reason is required.");
    await this.repository.closePromotion(actorUserId, promotionId, reason.trim(), this.now());
  }
}

export { DEFAULT_SETTINGS };
