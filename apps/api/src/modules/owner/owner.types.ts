import type { OwnerVenueSetupRequest, VenueOpeningHourInput } from "@leaguekick/contracts";

export type OwnerAreaRecord = {
  id: string;
  name: string;
  defaultSessionDurationMinutes: number;
  basePriceAfn: number;
};

export type OwnerVenueRecord = {
  id: string;
  ownerUserId: string;
  name: string;
  publicPhone: string;
  whatsappPhone: string | null;
  province: string;
  city: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: "DRAFT" | "READY" | "ACTIVE" | "SUSPENDED";
  setupCompletedAt: Date | null;
  areas: OwnerAreaRecord[];
  openingHours: VenueOpeningHourInput[];
};

export type OwnerSubscriptionRecord = {
  venueId: string;
  status: "TRIAL" | "ACTIVE" | "EXPIRED" | "CANCELLED";
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  activeUntil: Date | null;
};

export type OwnerAggregate = {
  venue: OwnerVenueRecord;
  subscription: OwnerSubscriptionRecord | null;
};

export interface OwnerOnboardingRepository {
  getByOwnerId(ownerUserId: string): Promise<OwnerAggregate | null>;
  saveSetup(input: {
    ownerUserId: string;
    setup: OwnerVenueSetupRequest;
    publicPhone: string;
    whatsappPhone: string | null;
    completedAt: Date;
  }): Promise<OwnerAggregate>;
  startTrial(input: {
    ownerUserId: string;
    venueId: string;
    identityHash: string;
    startedAt: Date;
    endsAt: Date;
  }): Promise<OwnerSubscriptionRecord>;
  markExpired(venueId: string, expiredAt: Date): Promise<void>;
}
