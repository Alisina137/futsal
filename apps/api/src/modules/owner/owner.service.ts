import { createHash } from "node:crypto";
import type {
  OwnerOnboardingStatus,
  OwnerVenueDto,
  OwnerVenueSettingsDto,
  OwnerVenueSettingsUpdateRequest,
  OwnerVenueSetupRequest,
  VenueRefereeGrantRequest,
  VenueSubscriptionDto,
} from "@leaguekick/contracts";
import { normalizeAfghanistanPhone, normalizeUsername } from "@leaguekick/contracts";
import { errors } from "../../lib/errors.js";
import { evaluateVenueEntitlement } from "../billing/entitlement.js";
import type { OwnerAggregate, OwnerOnboardingRepository, OwnerSubscriptionRecord, OwnerVenueRecord } from "./owner.types.js";

const TRIAL_DURATION_MS = 72 * 60 * 60 * 1000;

function normalizeIdentityPart(value: string) {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

function identityHash(name: string, province: string, city: string, address: string): string {
  const canonical = [
    normalizeIdentityPart(name),
    normalizeIdentityPart(province),
    normalizeIdentityPart(city),
    normalizeIdentityPart(address),
  ].join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

function trialIdentityHash(venue: OwnerVenueRecord): string {
  return identityHash(venue.name, venue.province, venue.city, venue.address);
}

function setupIdentityHash(setup: OwnerVenueSetupRequest): string {
  return identityHash(setup.venue.name, setup.venue.province, setup.venue.city, setup.venue.address);
}

function toVenueDto(venue: OwnerVenueRecord): OwnerVenueDto {
  return {
    id: venue.id,
    name: venue.name,
    publicPhone: venue.publicPhone,
    whatsappPhone: venue.whatsappPhone,
    province: venue.province,
    city: venue.city,
    address: venue.address,
    latitude: venue.latitude,
    longitude: venue.longitude,
    timezone: venue.timezone,
    bookingMode: venue.bookingMode,
    onlineBookingEnabled: venue.onlineBookingEnabled,
    minimumBookingNoticeMinutes: venue.minimumBookingNoticeMinutes,
    maximumAdvanceBookingDays: venue.maximumAdvanceBookingDays,
    cancellationPolicy: venue.cancellationPolicy,
    verificationStatus: venue.verificationStatus,
    status: venue.status,
    setupCompletedAt: venue.setupCompletedAt?.toISOString() ?? null,
    areas: venue.areas,
    openingHours: venue.openingHours,
  };
}

function toSubscriptionDto(subscription: OwnerSubscriptionRecord | null, now: Date): VenueSubscriptionDto {
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
  const remainingSeconds = entitlement.state === "TRIAL" && subscription.trialEndsAt
    ? Math.max(0, Math.floor((subscription.trialEndsAt.getTime() - now.getTime()) / 1000))
    : null;

  return {
    state: entitlement.state,
    accessMode: entitlement.accessMode,
    canCreateBookableInventory: entitlement.canCreateBookableInventory,
    canServiceExistingBookings: entitlement.canServiceExistingBookings,
    trialStartedAt: subscription.trialStartedAt?.toISOString() ?? null,
    trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
    activeUntil: subscription.activeUntil?.toISOString() ?? null,
    remainingSeconds,
  };
}

export class OwnerOnboardingService {
  constructor(
    private readonly repository: OwnerOnboardingRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly trialDurationMs: () => Promise<number> | number = () => TRIAL_DURATION_MS,
  ) {}

  private async normalizeAggregate(aggregate: OwnerAggregate | null): Promise<OwnerAggregate | null> {
    if (!aggregate?.subscription) return aggregate;
    const now = this.now();
    const entitlement = evaluateVenueEntitlement(aggregate.subscription, now);
    if (entitlement.state === "EXPIRED" && aggregate.subscription.status !== "EXPIRED") {
      await this.repository.markExpired(aggregate.venue.id, now);
      return {
        ...aggregate,
        subscription: { ...aggregate.subscription, status: "EXPIRED" },
      };
    }
    return aggregate;
  }

  private toStatus(aggregate: OwnerAggregate | null): OwnerOnboardingStatus {
    const now = this.now();
    return {
      setupComplete: Boolean(aggregate?.venue.setupCompletedAt),
      venue: aggregate ? toVenueDto(aggregate.venue) : null,
      subscription: toSubscriptionDto(aggregate?.subscription ?? null, now),
    };
  }

  async getStatus(ownerUserId: string): Promise<OwnerOnboardingStatus> {
    return this.toStatus(await this.normalizeAggregate(await this.repository.getByOwnerId(ownerUserId)));
  }

  async saveSetup(ownerUserId: string, setup: OwnerVenueSetupRequest): Promise<OwnerOnboardingStatus> {
    if (setup.areas.length !== 1) {
      throw errors.badRequest(
        "SINGLE_COURT_REQUIRED",
        "Each venue-owner account can manage exactly one court. Create another account and subscription for another court.",
      );
    }
    const current = await this.normalizeAggregate(await this.repository.getByOwnerId(ownerUserId));
    if (current?.subscription && setupIdentityHash(setup) !== trialIdentityHash(current.venue)) {
      throw errors.conflict(
        "VENUE_IDENTITY_LOCKED",
        "Venue identity cannot be changed after a trial or subscription has started.",
      );
    }

    let publicPhone: string;
    let whatsappPhone: string | null = null;

    try {
      publicPhone = normalizeAfghanistanPhone(setup.venue.publicPhone);
      if (setup.venue.whatsappPhone) whatsappPhone = normalizeAfghanistanPhone(setup.venue.whatsappPhone);
    } catch {
      throw errors.badRequest("INVALID_VENUE_PHONE", "Enter a valid Afghanistan venue phone number.");
    }

    const aggregate = await this.repository.saveSetup({
      ownerUserId,
      setup,
      publicPhone,
      whatsappPhone,
      completedAt: this.now(),
    });
    return this.toStatus(await this.normalizeAggregate(aggregate));
  }

  private toVenueSettings(aggregate: OwnerAggregate): OwnerVenueSettingsDto {
    const court = aggregate.venue.areas[0];
    if (!court) throw errors.badRequest("COURT_REQUIRED", "This venue does not have an active court.");
    return {
      venueId: aggregate.venue.id,
      identityLocked: Boolean(aggregate.subscription),
      name: aggregate.venue.name,
      province: aggregate.venue.province,
      city: aggregate.venue.city,
      address: aggregate.venue.address,
      publicPhone: aggregate.venue.publicPhone,
      whatsappPhone: aggregate.venue.whatsappPhone,
      latitude: aggregate.venue.latitude,
      longitude: aggregate.venue.longitude,
      timezone: aggregate.venue.timezone,
      bookingMode: aggregate.venue.bookingMode,
      onlineBookingEnabled: aggregate.venue.onlineBookingEnabled,
      minimumBookingNoticeMinutes: aggregate.venue.minimumBookingNoticeMinutes,
      maximumAdvanceBookingDays: aggregate.venue.maximumAdvanceBookingDays,
      cancellationPolicy: aggregate.venue.cancellationPolicy,
      verificationStatus: aggregate.venue.verificationStatus,
      venueStatus: aggregate.venue.status,
      court,
      subscription: toSubscriptionDto(aggregate.subscription, this.now()),
    };
  }

  async getVenueSettings(ownerUserId: string) {
    const aggregate = await this.normalizeAggregate(await this.repository.getByOwnerId(ownerUserId));
    if (!aggregate) throw errors.badRequest("VENUE_REQUIRED", "Complete venue setup first.");
    return { settings: this.toVenueSettings(aggregate) };
  }

  async updateVenueSettings(ownerUserId: string, input: OwnerVenueSettingsUpdateRequest) {
    const current = await this.normalizeAggregate(await this.repository.getByOwnerId(ownerUserId));
    if (!current) throw errors.badRequest("VENUE_REQUIRED", "Complete venue setup first.");
    if (current.venue.status === "SUSPENDED") {
      throw errors.forbidden("VENUE_SUSPENDED", "This venue is suspended.");
    }

    let publicPhone: string;
    let whatsappPhone: string | null = null;
    try {
      publicPhone = normalizeAfghanistanPhone(input.publicPhone);
      if (input.whatsappPhone) whatsappPhone = normalizeAfghanistanPhone(input.whatsappPhone);
    } catch {
      throw errors.badRequest("INVALID_VENUE_PHONE", "Enter a valid Afghanistan venue phone number.");
    }

    const updated = await this.repository.updateVenueSettings({
      ownerUserId,
      settings: input,
      publicPhone,
      whatsappPhone,
      updatedAt: this.now(),
    });
    return { settings: this.toVenueSettings(await this.normalizeAggregate(updated) ?? updated) };
  }

  async startTrial(ownerUserId: string): Promise<OwnerOnboardingStatus> {
    const current = await this.normalizeAggregate(await this.repository.getByOwnerId(ownerUserId));
    if (!current?.venue.setupCompletedAt) {
      throw errors.badRequest("SETUP_INCOMPLETE", "Complete venue setup before starting the Premium trial.");
    }
    if (current.venue.status === "SUSPENDED") {
      throw errors.forbidden("VENUE_SUSPENDED", "This venue is suspended.");
    }

    if (current.subscription) {
      return this.toStatus(current);
    }

    const startedAt = this.now();
    const durationMs = await this.trialDurationMs();
    const endsAt = new Date(startedAt.getTime() + durationMs);
    const subscription = await this.repository.startTrial({
      ownerUserId,
      venueId: current.venue.id,
      identityHash: trialIdentityHash(current.venue),
      startedAt,
      endsAt,
    });

    return this.toStatus({
      venue: { ...current.venue, status: "ACTIVE" },
      subscription,
    });
  }

  async listReferees(ownerUserId: string) {
    const aggregate = await this.repository.getByOwnerId(ownerUserId);
    if (!aggregate) throw errors.badRequest("VENUE_REQUIRED", "Complete venue setup first.");
    return { referees: await this.repository.listVenueReferees(aggregate.venue.id) };
  }

  async grantReferee(ownerUserId: string, input: VenueRefereeGrantRequest) {
    const aggregate = await this.repository.getByOwnerId(ownerUserId);
    if (!aggregate) throw errors.badRequest("VENUE_REQUIRED", "Complete venue setup first.");

    const raw = input.identifier.trim();
    let phoneE164: string | undefined;
    try { phoneE164 = normalizeAfghanistanPhone(raw); } catch { phoneE164 = undefined; }
    const usernameNormalized = phoneE164 ? undefined : normalizeUsername(raw) || undefined;
    const target = await this.repository.resolveActiveUser({
      ...(usernameNormalized ? { usernameNormalized } : {}),
      ...(phoneE164 ? { phoneE164 } : {}),
    });
    if (!target) throw errors.badRequest("REFEREE_USER_NOT_FOUND", "No active user matches that username or phone number.");
    if (target.id === ownerUserId) {
      throw errors.badRequest("OWNER_CANNOT_BE_REFEREE", "The venue owner already has venue management access.");
    }

    await this.repository.grantVenueReferee({
      venueId: aggregate.venue.id,
      userId: target.id,
      assignedByUserId: ownerUserId,
      assignedAt: this.now(),
    });
    return { referees: await this.repository.listVenueReferees(aggregate.venue.id) };
  }

  async removeReferee(ownerUserId: string, userId: string) {
    const aggregate = await this.repository.getByOwnerId(ownerUserId);
    if (!aggregate) throw errors.badRequest("VENUE_REQUIRED", "Complete venue setup first.");
    await this.repository.removeVenueReferee(aggregate.venue.id, userId);
    return { referees: await this.repository.listVenueReferees(aggregate.venue.id) };
  }

}

export { TRIAL_DURATION_MS };
