import { createHash } from "node:crypto";
import type {
  OwnerOnboardingStatus,
  OwnerVenueDto,
  OwnerVenueSetupRequest,
  VenueSubscriptionDto,
} from "@leaguekick/contracts";
import { normalizeAfghanistanPhone } from "@leaguekick/contracts";
import { errors } from "../../lib/errors.js";
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
      trialStartedAt: null,
      trialEndsAt: null,
      activeUntil: null,
      remainingSeconds: null,
    };
  }

  const remainingSeconds = subscription.status === "TRIAL" && subscription.trialEndsAt
    ? Math.max(0, Math.floor((subscription.trialEndsAt.getTime() - now.getTime()) / 1000))
    : null;

  return {
    state: subscription.status,
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
  ) {}

  private async normalizeAggregate(aggregate: OwnerAggregate | null): Promise<OwnerAggregate | null> {
    if (!aggregate?.subscription) return aggregate;
    const now = this.now();
    if (
      aggregate.subscription.status === "TRIAL" &&
      aggregate.subscription.trialEndsAt &&
      aggregate.subscription.trialEndsAt.getTime() <= now.getTime()
    ) {
      await this.repository.expireTrial(aggregate.venue.id, now);
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
    const endsAt = new Date(startedAt.getTime() + TRIAL_DURATION_MS);
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
}

export { TRIAL_DURATION_MS };
