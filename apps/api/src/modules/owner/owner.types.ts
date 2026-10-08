import type {
  OwnerVenueSettingsUpdateRequest,
  OwnerVenueSetupRequest,
  VenueOpeningHourInput,
  VenueRefereeDto,
} from "@leaguekick/contracts";

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
  timezone: string;
  bookingMode: "INSTANT" | "APPROVAL";
  onlineBookingEnabled: boolean;
  minimumBookingNoticeMinutes: number;
  maximumAdvanceBookingDays: number;
  cancellationPolicy: string;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
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
  updateVenueSettings(input: {
    ownerUserId: string;
    settings: OwnerVenueSettingsUpdateRequest;
    publicPhone: string;
    whatsappPhone: string | null;
    updatedAt: Date;
  }): Promise<OwnerAggregate>;
  resolveActiveUser(input: { usernameNormalized?: string; phoneE164?: string }): Promise<{
    id: string;
    displayName: string;
    username: string | null;
    phoneE164: string;
  } | null>;
  listVenueReferees(venueId: string): Promise<VenueRefereeDto[]>;
  grantVenueReferee(input: { venueId: string; userId: string; assignedByUserId: string; assignedAt: Date }): Promise<void>;
  removeVenueReferee(venueId: string, userId: string): Promise<void>;
}
