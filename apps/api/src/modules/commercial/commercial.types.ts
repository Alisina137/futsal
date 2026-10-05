import type {
  AdminAuditLogDto,
  AdminUserDto,
  AdminVenueDto,
  SubscriptionPaymentDto,
  UserRole,
  VenueOpeningHourInput,
  VenueSubscriptionState,
  VenueVerificationStatus,
} from "@leaguekick/contracts";

export type CommercialSubscriptionRecord = {
  venueId: string;
  status: Exclude<VenueSubscriptionState, "NOT_STARTED">;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  activeUntil: Date | null;
};

export type CommercialVenueRecord = {
  id: string;
  ownerUserId: string;
  name: string;
  province: string;
  city: string;
  address: string;
  timezone: string;
  status: "DRAFT" | "READY" | "ACTIVE" | "SUSPENDED";
  verificationStatus: VenueVerificationStatus;
  createdAt: Date;
  subscription: CommercialSubscriptionRecord | null;
};

export type CommercialSettingsRecord = {
  monthlyPriceAfn: number;
  annualPriceAfn: number;
  trialDurationHours: number;
  featureFlags: Record<string, boolean>;
  notificationTemplates: Record<string, string>;
  updatedAt: Date;
};

export type AnalyticsBookingRecord = {
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  source: "ONLINE" | "MANUAL";
  startsAt: Date;
  endsAt: Date;
  priceAfn: number;
};

export type OwnerAnalyticsSnapshot = {
  venue: CommercialVenueRecord;
  activeAreaCount: number;
  openingHours: VenueOpeningHourInput[];
  bookings: AnalyticsBookingRecord[];
};

export interface CommercialRepository {
  getOwnerVenue(ownerUserId: string): Promise<CommercialVenueRecord | null>;
  getVenue(venueId: string): Promise<CommercialVenueRecord | null>;
  getSettings(): Promise<CommercialSettingsRecord | null>;
  listPayments(venueId: string): Promise<SubscriptionPaymentDto[]>;
  requestReactivation(ownerUserId: string, venueId: string, createdAt: Date): Promise<void>;
  analyticsSnapshot(ownerUserId: string, startsAt: Date, endsAt: Date): Promise<OwnerAnalyticsSnapshot | null>;

  adminDashboard(now: Date): Promise<{
    activeUsers: number;
    activeVenues: number;
    pendingVenueVerifications: number;
    trialVenues: number;
    paidVenues: number;
    expiredVenues: number;
    recordedPaymentsAfn: number;
    bookingGmvAfn: number;
  }>;
  listUsers(query?: string): Promise<AdminUserDto[]>;
  listVenues(query?: string): Promise<AdminVenueDto[]>;
  setUserStatus(actorUserId: string, userId: string, status: "ACTIVE" | "SUSPENDED", reason: string, now: Date): Promise<void>;
  applyVenueAction(actorUserId: string, venueId: string, action: "VERIFY" | "REJECT" | "SUSPEND" | "RESTORE", reason: string, now: Date): Promise<void>;
  activateSubscription(input: {
    actorUserId: string;
    venueId: string;
    months: number;
    amountAfn: number;
    provider: string;
    providerReference: string | null;
    note: string | null;
    now: Date;
  }): Promise<void>;
  extendTrial(actorUserId: string, venueId: string, hours: number, reason: string, now: Date): Promise<void>;
  voidPayment(actorUserId: string, paymentId: string, reason: string, now: Date): Promise<void>;
  updateSettings(actorUserId: string, input: {
    monthlyPriceAfn: number;
    annualPriceAfn: number;
    trialDurationHours: number;
    featureFlags: Record<string, boolean>;
    notificationTemplates: Record<string, string>;
  }, now: Date): Promise<CommercialSettingsRecord>;
  listAuditLogs(): Promise<AdminAuditLogDto[]>;
  addSupportNote(actorUserId: string, targetType: "USER" | "VENUE", targetId: string, note: string, now: Date): Promise<void>;
  unpublishPost(actorUserId: string, postId: string, reason: string, now: Date): Promise<void>;
  closePromotion(actorUserId: string, promotionId: string, reason: string, now: Date): Promise<void>;
}

export type { UserRole };
