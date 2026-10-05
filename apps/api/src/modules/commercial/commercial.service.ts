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
} from "./commercial.types.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SETTINGS = {
  monthlyPriceAfn: 1500,
  annualPriceAfn: 15000,
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
    const startsAt = localMidnightToUtc(from, venue.timezone);
    const endsAt = localMidnightToUtc(addDateDays(to, 1), venue.timezone);
    const snapshot = await this.repository.analyticsSnapshot(ownerUserId, startsAt, endsAt);
    if (!snapshot) throw errors.badRequest("VENUE_REQUIRED", "Complete venue setup first.");

    const nonCancelled = snapshot.bookings.filter((booking) => booking.status !== "CANCELLED");
    const onlineBookingCount = nonCancelled.filter((booking) => booking.source === "ONLINE").length;
    const manualBookingCount = nonCancelled.filter((booking) => booking.source === "MANUAL").length;
    const bookedMinutes = nonCancelled.reduce(
      (sum, booking) => sum + Math.max(0, Math.round((booking.endsAt.getTime() - booking.startsAt.getTime()) / 60_000)),
      0,
    );

    let availableMinutes = 0;
    for (let offset = 0; offset <= distance; offset += 1) {
      const date = addDateDays(from, offset);
      const { year, month, day } = dateParts(date);
      const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
      const hours = snapshot.openingHours.find((item) => item.dayOfWeek === weekday);
      if (!hours || hours.isClosed || !hours.opensAt || !hours.closesAt) continue;
      availableMinutes += minutesBetween(hours.opensAt, hours.closesAt) * snapshot.activeAreaCount;
    }

    return {
      from,
      to,
      generatedAt: this.now().toISOString(),
      bookingCount: snapshot.bookings.length,
      confirmedBookingCount: snapshot.bookings.filter((booking) => booking.status === "CONFIRMED").length,
      cancelledBookingCount: snapshot.bookings.filter((booking) => booking.status === "CANCELLED").length,
      onlineBookingCount,
      manualBookingCount,
      onlineBookingShare: nonCancelled.length ? onlineBookingCount / nonCancelled.length : 0,
      grossBookingValueAfn: nonCancelled.reduce((sum, booking) => sum + booking.priceAfn, 0),
      bookedMinutes,
      availableMinutes,
      occupancyRate: availableMinutes ? Math.min(1, bookedMinutes / availableMinutes) : 0,
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
