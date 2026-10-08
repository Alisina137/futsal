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
  id: string;
  areaId: string;
  playerUserId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  source: "ONLINE" | "MANUAL";
  startsAt: Date;
  endsAt: Date;
  priceAfn: number;
  cancellationReason: string | null;
  cancelledAt: Date | null;
  createdAt: Date;
};

export type AnalyticsTimetableRecord = {
  id: string;
  status: "PUBLISHED" | "ARCHIVED";
  effectiveFrom: string;
  effectiveUntil: string | null;
  periods: Array<{
    areaId: string | null;
    dayOfWeek: number;
    startsAt: string;
    endsAt: string;
    priceAfn: number;
  }>;
};

export type AnalyticsExceptionRecord = {
  date: string;
  areaId: string | null;
  isClosed: boolean;
  periods: Array<{ startsAt: string; endsAt: string; priceAfn?: number | null }>;
};

export type AnalyticsBlockRecord = {
  areaId: string;
  startsAt: Date;
  endsAt: Date;
};

export type AnalyticsPromotionRecord = {
  id: string;
  areaId: string;
  startsAt: Date;
  endsAt: Date;
  originalPriceAfn: number;
  discountedPriceAfn: number;
  status: "ACTIVE" | "CLOSED" | "EXPIRED";
  createdAt: Date;
};

export type AnalyticsSocialPostRecord = {
  id: string;
  publishedAt: Date;
  likeCount: number;
  commentCount: number;
};

export type AnalyticsCompetitionRecord = {
  id: string;
  status: "DRAFT" | "REGISTRATION_OPEN" | "REGISTRATION_CLOSED" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "ARCHIVED" | "CANCELLED";
  registrationFeeAfn: number;
  startsAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

export type AnalyticsCompetitionTeamRecord = {
  competitionId: string;
  status: "INVITED" | "APPLIED" | "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
  feeStatus: "UNPAID" | "PENDING" | "PAID" | "WAIVED";
};

export type AnalyticsCompetitionMatchRecord = {
  competitionId: string;
  status: "UNSCHEDULED" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "POSTPONED" | "CANCELLED" | "CORRECTED";
  startsAt: Date | null;
  endsAt: Date | null;
};

export type OwnerAnalyticsSnapshot = {
  venue: CommercialVenueRecord;
  activeAreaCount: number;
  openingHours: VenueOpeningHourInput[];
  bookings: AnalyticsBookingRecord[];
  timetables: AnalyticsTimetableRecord[];
  exceptions: AnalyticsExceptionRecord[];
  blocks: AnalyticsBlockRecord[];
  promotions: AnalyticsPromotionRecord[];
  followerCount: number;
  followerCreatedAt: Date[];
  posts: AnalyticsSocialPostRecord[];
  competitions: AnalyticsCompetitionRecord[];
  competitionTeams: AnalyticsCompetitionTeamRecord[];
  competitionMatches: AnalyticsCompetitionMatchRecord[];
};

export interface CommercialRepository {
  getOwnerVenue(ownerUserId: string): Promise<CommercialVenueRecord | null>;
  getVenue(venueId: string): Promise<CommercialVenueRecord | null>;
  getSettings(): Promise<CommercialSettingsRecord | null>;
  listPayments(venueId: string): Promise<SubscriptionPaymentDto[]>;
  requestReactivation(ownerUserId: string, venueId: string, createdAt: Date): Promise<void>;
  analyticsSnapshot(ownerUserId: string, startsAt: Date, endsAt: Date, from: string, to: string): Promise<OwnerAnalyticsSnapshot | null>;

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
