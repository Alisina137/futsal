import { z } from "zod";

export const languageCodeSchema = z.enum(["fa-AF", "ps-AF", "en"]);
export type LanguageCode = z.infer<typeof languageCodeSchema>;

export const userRoleSchema = z.enum([
  "PLAYER",
  "TEAM_MANAGER",
  "REFEREE",
  "VENUE_STAFF",
  "COMPETITION_ADMIN",
  "VENUE_OWNER",
  "PLATFORM_ADMIN",
]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(12)
  .regex(/^[A-Za-z0-9_]+$/, "Username may contain only letters, numbers, and underscore.");

export const phoneInputSchema = z
  .string()
  .trim()
  .min(9)
  .max(20)
  .regex(/^\+?[0-9\s()-]+$/, "Invalid phone number.");

export const passwordSchema = z.string().min(8).max(128);

export const newPasswordSchema = passwordSchema
  .regex(/\p{L}/u, "Password must include at least one letter.")
  .regex(/\p{N}/u, "Password must include at least one number.")
  .regex(
    /[^\p{L}\p{N}\s]/u,
    "Password must include at least one special character.",
  );

export const registerRequestSchema = z.object({
  username: usernameSchema,
  phone: phoneInputSchema,
  password: newPasswordSchema,
  confirmPassword: newPasswordSchema,
  preferredLanguage: languageCodeSchema.default("fa-AF"),
}).superRefine((value, ctx) => {
  if (value.password !== value.confirmPassword) {
    ctx.addIssue({
      code: "custom",
      path: ["confirmPassword"],
      message: "Passwords do not match.",
    });
  }
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const paidRoleSchema = z.enum(["VENUE_OWNER", "TEAM_MANAGER"]);
export type PaidRole = z.infer<typeof paidRoleSchema>;

export const selfAssignableRoleSchema = paidRoleSchema;
export type SelfAssignableRole = PaidRole;

export const roleSubscriptionStatusSchema = z.enum(["NONE", "PENDING", "ACTIVE", "EXPIRED", "CANCELLED"]);
export type RoleSubscriptionStatus = z.infer<typeof roleSubscriptionStatusSchema>;

export const roleSubscriptionRequestSchema = z.object({
  paymentReference: z.string().trim().max(120).optional().or(z.literal("")),
});
export type RoleSubscriptionRequest = z.infer<typeof roleSubscriptionRequestSchema>;

export const accountProfileUpdateRequestSchema = z.object({
  displayName: z.string().trim().max(80).optional().or(z.literal("")),
  profileImageUrl: z.string().trim().url().refine((value) => value.startsWith("https://"), "Use an HTTPS image URL.").optional().or(z.literal("")),
  age: z.number().int().min(1).max(120).nullable().optional(),
  email: z.string().trim().email().max(320).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  bio: z.string().trim().max(280).optional().or(z.literal("")),
});
export type AccountProfileUpdateRequest = z.infer<typeof accountProfileUpdateRequestSchema>;

export const loginRequestSchema = z.object({
  identifier: z.string().trim().min(3).max(80),
  password: passwordSchema,
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const passwordResetRequestSchema = z.object({
  phone: phoneInputSchema,
});
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;

export const passwordResetVerifySchema = z.object({
  requestId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit verification code."),
});
export type PasswordResetVerifyRequest = z.infer<typeof passwordResetVerifySchema>;

export const passwordResetCompleteSchema = z.object({
  requestId: z.string().uuid(),
  resetToken: z.string().min(32),
  username: usernameSchema,
  password: newPasswordSchema,
  confirmPassword: newPasswordSchema,
}).superRefine((value, ctx) => {
  if (value.password !== value.confirmPassword) {
    ctx.addIssue({
      code: "custom",
      path: ["confirmPassword"],
      message: "Passwords do not match.",
    });
  }
});
export type PasswordResetCompleteRequest = z.infer<typeof passwordResetCompleteSchema>;

export type PasswordResetRequestResponse = {
  requestId: string;
  expiresAt: string;
  debugCode?: string;
};

export type PasswordResetVerifyResponse = {
  requestId: string;
  resetToken: string;
  resetTokenExpiresAt: string;
  username: string;
  phone: string;
};

export const refreshRequestSchema = z.object({ refreshToken: z.string().min(32) });
export const logoutRequestSchema = refreshRequestSchema;

export const userDtoSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  username: z.string().nullable(),
  phone: z.string(),
  profileImageUrl: z.string().nullable(),
  age: z.number().int().min(1).max(120).nullable(),
  email: z.string().nullable(),
  city: z.string().nullable(),
  bio: z.string().nullable(),
  preferredLanguage: languageCodeSchema,
  roles: z.array(userRoleSchema),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});
export type UserDto = z.infer<typeof userDtoSchema>;

export const authResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  accessTokenExpiresAt: z.string(),
  refreshTokenExpiresAt: z.string(),
  user: userDtoSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

const hhmmSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm time.");

export const venueAreaInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  defaultSessionDurationMinutes: z.number().int().min(30).max(240),
  basePriceAfn: z.number().int().min(0).max(1_000_000),
});
export type VenueAreaInput = z.infer<typeof venueAreaInputSchema>;

export const venueOpeningHourInputSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isClosed: z.boolean(),
  opensAt: hhmmSchema.nullable(),
  closesAt: hhmmSchema.nullable(),
}).superRefine((value, ctx) => {
  if (!value.isClosed && (!value.opensAt || !value.closesAt)) {
    ctx.addIssue({ code: "custom", message: "Open days require opening and closing times." });
  }
  if (!value.isClosed && value.opensAt && value.closesAt && value.opensAt >= value.closesAt) {
    ctx.addIssue({ code: "custom", message: "Closing time must be after opening time." });
  }
});
export type VenueOpeningHourInput = z.infer<typeof venueOpeningHourInputSchema>;

const openingHoursSchema = z.array(venueOpeningHourInputSchema).length(7).superRefine((hours, ctx) => {
  const days = new Set(hours.map((item) => item.dayOfWeek));
  if (days.size !== 7) ctx.addIssue({ code: "custom", message: "Opening hours must contain each weekday exactly once." });
});

export const ownerVenueSetupRequestSchema = z.object({
  venue: z.object({
    name: z.string().trim().min(2).max(120),
    publicPhone: phoneInputSchema,
    whatsappPhone: phoneInputSchema.optional().or(z.literal("")),
    province: z.string().trim().min(2).max(80),
    city: z.string().trim().min(2).max(80),
    address: z.string().trim().min(5).max(240),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
  }),
  areas: z.array(venueAreaInputSchema).length(1, "A venue owner account can manage exactly one court."),
  openingHours: openingHoursSchema,
});
export type OwnerVenueSetupRequest = z.infer<typeof ownerVenueSetupRequestSchema>;

export const venueAreaDtoSchema = venueAreaInputSchema.extend({
  id: z.string().uuid(),
});
export type VenueAreaDto = z.infer<typeof venueAreaDtoSchema>;

export const venueOpeningHourDtoSchema = venueOpeningHourInputSchema;

export const ownerVenueDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  publicPhone: z.string(),
  whatsappPhone: z.string().nullable(),
  province: z.string(),
  city: z.string(),
  address: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  timezone: z.string(),
  bookingMode: z.enum(["INSTANT","APPROVAL"]),
  onlineBookingEnabled: z.boolean(),
  minimumBookingNoticeMinutes: z.number().int().min(0).max(10_080),
  maximumAdvanceBookingDays: z.number().int().min(1).max(180),
  cancellationPolicy: z.string(),
  verificationStatus: z.enum(["PENDING","VERIFIED","REJECTED"]),
  status: z.enum(["DRAFT", "READY", "ACTIVE", "SUSPENDED"]),
  setupCompletedAt: z.string().nullable(),
  areas: z.array(venueAreaDtoSchema).max(1),
  openingHours: z.array(venueOpeningHourDtoSchema),
});
export type OwnerVenueDto = z.infer<typeof ownerVenueDtoSchema>;

export const venueSubscriptionStateSchema = z.enum(["NOT_STARTED", "TRIAL", "ACTIVE", "EXPIRED", "CANCELLED"]);
export type VenueSubscriptionState = z.infer<typeof venueSubscriptionStateSchema>;

export const venueSubscriptionAccessModeSchema = z.enum(["NONE", "FULL", "CONTINUITY"]);
export type VenueSubscriptionAccessMode = z.infer<typeof venueSubscriptionAccessModeSchema>;

export const venueSubscriptionDtoSchema = z.object({
  state: venueSubscriptionStateSchema,
  accessMode: venueSubscriptionAccessModeSchema,
  canCreateBookableInventory: z.boolean(),
  canServiceExistingBookings: z.boolean(),
  trialStartedAt: z.string().nullable(),
  trialEndsAt: z.string().nullable(),
  activeUntil: z.string().nullable(),
  remainingSeconds: z.number().int().min(0).nullable(),
});
export type VenueSubscriptionDto = z.infer<typeof venueSubscriptionDtoSchema>;

export const ownerOnboardingStatusSchema = z.object({
  setupComplete: z.boolean(),
  venue: ownerVenueDtoSchema.nullable(),
  subscription: venueSubscriptionDtoSchema,
});
export type OwnerOnboardingStatus = z.infer<typeof ownerOnboardingStatusSchema>;

export const ownerVenueSettingsUpdateRequestSchema = z.object({
  publicPhone: phoneInputSchema,
  whatsappPhone: phoneInputSchema.optional().or(z.literal("")),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  courtName: z.string().trim().min(1).max(80),
  defaultSessionDurationMinutes: z.number().int().min(30).max(240),
  basePriceAfn: z.number().int().min(0).max(1_000_000),
  bookingMode: z.enum(["INSTANT","APPROVAL"]),
  onlineBookingEnabled: z.boolean(),
  minimumBookingNoticeMinutes: z.number().int().min(0).max(10_080),
  maximumAdvanceBookingDays: z.number().int().min(1).max(180),
  cancellationPolicy: z.string().trim().min(8).max(1_000),
}).superRefine((value,ctx)=>{
  if((value.latitude===null)!==(value.longitude===null)){
    ctx.addIssue({code:"custom",path:["latitude"],message:"Latitude and longitude must be provided together."});
  }
});
export type OwnerVenueSettingsUpdateRequest = z.infer<typeof ownerVenueSettingsUpdateRequestSchema>;

export const ownerVenueSettingsDtoSchema = z.object({
  venueId: z.string().uuid(),
  identityLocked: z.boolean(),
  name: z.string(),
  province: z.string(),
  city: z.string(),
  address: z.string(),
  publicPhone: z.string(),
  whatsappPhone: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  timezone: z.string(),
  bookingMode: z.enum(["INSTANT","APPROVAL"]),
  onlineBookingEnabled: z.boolean(),
  minimumBookingNoticeMinutes: z.number().int().min(0),
  maximumAdvanceBookingDays: z.number().int().min(1),
  cancellationPolicy: z.string(),
  verificationStatus: z.enum(["PENDING","VERIFIED","REJECTED"]),
  venueStatus: z.enum(["DRAFT","READY","ACTIVE","SUSPENDED"]),
  court: z.object({
    id: z.string().uuid(),
    name: z.string(),
    defaultSessionDurationMinutes: z.number().int(),
    basePriceAfn: z.number().int(),
  }),
  subscription: venueSubscriptionDtoSchema,
});
export type OwnerVenueSettingsDto = z.infer<typeof ownerVenueSettingsDtoSchema>;

export const venueRefereeGrantRequestSchema = z.object({
  identifier: z.string().trim().min(3).max(80),
});
export type VenueRefereeGrantRequest = z.infer<typeof venueRefereeGrantRequestSchema>;



export const dateOnlySchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Use a real calendar date.");
export const isoDateTimeSchema = z.string()
  .refine((value) => /(Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)), "Use an ISO datetime with timezone.");

export const venueRefereeDtoSchema = z.object({
  venueId: z.string().uuid(),
  userId: z.string().uuid(),
  displayName: z.string(),
  username: z.string().nullable(),
  phone: z.string(),
  assignedAt: isoDateTimeSchema,
});
export type VenueRefereeDto = z.infer<typeof venueRefereeDtoSchema>;

export const roleSubscriptionOfferDtoSchema = z.object({
  role: paidRoleSchema,
  monthlyPriceAfn: z.number().int().positive(),
  status: roleSubscriptionStatusSchema,
  requestedAt: isoDateTimeSchema.nullable(),
  activeUntil: isoDateTimeSchema.nullable(),
});
export type RoleSubscriptionOfferDto = z.infer<typeof roleSubscriptionOfferDtoSchema>;

export const adminRoleSubscriptionDtoSchema = z.object({
  userId: z.string().uuid(),
  username: z.string().nullable(),
  displayName: z.string(),
  role: paidRoleSchema,
  monthlyPriceAfn: z.number().int().positive(),
  status: roleSubscriptionStatusSchema,
  requestedAt: isoDateTimeSchema.nullable(),
  activeUntil: isoDateTimeSchema.nullable(),
  paymentReference: z.string().nullable(),
});
export type AdminRoleSubscriptionDto = z.infer<typeof adminRoleSubscriptionDtoSchema>;

export const adminRoleSubscriptionActivationRequestSchema = z.object({
  months: z.number().int().min(1).max(24).default(1),
  paymentReference: z.string().trim().max(120).optional().or(z.literal("")),
});
export type AdminRoleSubscriptionActivationRequest = z.infer<typeof adminRoleSubscriptionActivationRequestSchema>;

export const venueVerificationStatusSchema = z.enum(["PENDING", "VERIFIED", "REJECTED"]);
export type VenueVerificationStatus = z.infer<typeof venueVerificationStatusSchema>;

export const subscriptionPaymentStatusSchema = z.enum(["RECORDED", "VOIDED"]);
export type SubscriptionPaymentStatus = z.infer<typeof subscriptionPaymentStatusSchema>;

export const subscriptionPaymentDtoSchema = z.object({
  id: z.string().uuid(),
  venueId: z.string().uuid(),
  amountAfn: z.number().int().min(0),
  periodStartsAt: isoDateTimeSchema,
  periodEndsAt: isoDateTimeSchema,
  provider: z.string(),
  providerReference: z.string().nullable(),
  status: subscriptionPaymentStatusSchema,
  note: z.string().nullable(),
  createdAt: isoDateTimeSchema,
});
export type SubscriptionPaymentDto = z.infer<typeof subscriptionPaymentDtoSchema>;

export const platformSettingsDtoSchema = z.object({
  monthlyPriceAfn: z.number().int().min(0),
  annualPriceAfn: z.number().int().min(0),
  trialDurationHours: z.number().int().min(1).max(720),
  featureFlags: z.record(z.string(), z.boolean()),
  notificationTemplates: z.record(z.string(), z.string()),
  updatedAt: isoDateTimeSchema,
});
export type PlatformSettingsDto = z.infer<typeof platformSettingsDtoSchema>;

export const ownerBillingSummarySchema = z.object({
  venueId: z.string().uuid(),
  verificationStatus: z.enum(["PENDING","VERIFIED","REJECTED"]),
  subscription: venueSubscriptionDtoSchema,
  settings: platformSettingsDtoSchema,
  payments: z.array(subscriptionPaymentDtoSchema),
  canReactivate: z.boolean(),
});
export type OwnerBillingSummary = z.infer<typeof ownerBillingSummarySchema>;

export const ownerAnalyticsDailyPointSchema = z.object({
  date: dateOnlySchema,
  bookingCount: z.number().int().min(0),
  confirmedBookingCount: z.number().int().min(0),
  cancelledBookingCount: z.number().int().min(0),
  revenueAfn: z.number().int().min(0),
  bookedMinutes: z.number().int().min(0),
  scheduledMinutes: z.number().int().min(0),
  occupancyRate: z.number().min(0).max(1),
});
export type OwnerAnalyticsDailyPoint = z.infer<typeof ownerAnalyticsDailyPointSchema>;

export const ownerAnalyticsWeekdayPointSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  bookingCount: z.number().int().min(0),
  revenueAfn: z.number().int().min(0),
  bookedMinutes: z.number().int().min(0),
  scheduledMinutes: z.number().int().min(0),
  occupancyRate: z.number().min(0).max(1),
});
export type OwnerAnalyticsWeekdayPoint = z.infer<typeof ownerAnalyticsWeekdayPointSchema>;

export const ownerAnalyticsHourPointSchema = z.object({
  hour: z.number().int().min(0).max(23),
  bookingCount: z.number().int().min(0),
  revenueAfn: z.number().int().min(0),
});
export type OwnerAnalyticsHourPoint = z.infer<typeof ownerAnalyticsHourPointSchema>;

export const ownerAnalyticsCancellationReasonSchema = z.object({
  reason: z.string(),
  count: z.number().int().min(0),
});
export type OwnerAnalyticsCancellationReason = z.infer<typeof ownerAnalyticsCancellationReasonSchema>;

export const ownerAnalyticsComparisonSchema = z.object({
  previousFrom: dateOnlySchema,
  previousTo: dateOnlySchema,
  revenueChangeRate: z.number().nullable(),
  bookingChangeRate: z.number().nullable(),
  occupancyChangeRate: z.number().nullable(),
  cancellationRateDelta: z.number(),
});
export type OwnerAnalyticsComparison = z.infer<typeof ownerAnalyticsComparisonSchema>;

export const ownerAnalyticsResponseSchema = z.object({
  from: dateOnlySchema,
  to: dateOnlySchema,
  generatedAt: isoDateTimeSchema,

  bookingCount: z.number().int().min(0),
  confirmedBookingCount: z.number().int().min(0),
  cancelledBookingCount: z.number().int().min(0),
  onlineBookingCount: z.number().int().min(0),
  manualBookingCount: z.number().int().min(0),
  onlineBookingShare: z.number().min(0).max(1),
  confirmedRate: z.number().min(0).max(1),
  cancellationRate: z.number().min(0).max(1),

  grossBookingValueAfn: z.number().int().min(0),
  cancelledBookingValueAfn: z.number().int().min(0),
  averageBookingValueAfn: z.number().int().min(0),
  revenuePerBookedHourAfn: z.number().int().min(0),

  bookedMinutes: z.number().int().min(0),
  availableMinutes: z.number().int().min(0),
  scheduledMinutes: z.number().int().min(0),
  competitionMinutes: z.number().int().min(0),
  blockedMinutes: z.number().int().min(0),
  remainingOpenMinutes: z.number().int().min(0),
  occupancyRate: z.number().min(0).max(1),
  productiveUtilizationRate: z.number().min(0).max(1),
  blockedRate: z.number().min(0).max(1),

  uniqueCustomerCount: z.number().int().min(0),
  repeatCustomerCount: z.number().int().min(0),
  repeatCustomerRate: z.number().min(0).max(1),
  averageBookingsPerCustomer: z.number().min(0),

  promotionCount: z.number().int().min(0),
  promotionBookingCount: z.number().int().min(0),
  promotionRevenueAfn: z.number().int().min(0),
  discountGrantedAfn: z.number().int().min(0),
  averageDiscountPercent: z.number().min(0).max(100),

  followerCount: z.number().int().min(0),
  newFollowerCount: z.number().int().min(0),
  postCount: z.number().int().min(0),
  postLikeCount: z.number().int().min(0),
  postCommentCount: z.number().int().min(0),
  engagementPerPost: z.number().min(0),

  competitionCount: z.number().int().min(0),
  activeCompetitionCount: z.number().int().min(0),
  completedCompetitionCount: z.number().int().min(0),
  competitionTeamCount: z.number().int().min(0),
  competitionMatchCount: z.number().int().min(0),
  competitionFeesCollectedAfn: z.number().int().min(0),

  peakDayOfWeek: z.number().int().min(0).max(6).nullable(),
  peakHour: z.number().int().min(0).max(23).nullable(),
  bestRevenueDate: dateOnlySchema.nullable(),

  comparison: ownerAnalyticsComparisonSchema,
  daily: z.array(ownerAnalyticsDailyPointSchema),
  weekdays: z.array(ownerAnalyticsWeekdayPointSchema),
  hours: z.array(ownerAnalyticsHourPointSchema),
  cancellationReasons: z.array(ownerAnalyticsCancellationReasonSchema),
});
export type OwnerAnalyticsResponse = z.infer<typeof ownerAnalyticsResponseSchema>;

export const adminSubscriptionActivationRequestSchema = z.object({
  months: z.number().int().min(1).max(24),
  amountAfn: z.number().int().min(0).max(100_000_000),
  provider: z.string().trim().min(1).max(40).default("MANUAL"),
  providerReference: z.string().trim().max(120).optional().or(z.literal("")),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});
export type AdminSubscriptionActivationRequest = z.infer<typeof adminSubscriptionActivationRequestSchema>;

export const adminTrialExtensionRequestSchema = z.object({
  hours: z.number().int().min(1).max(720),
  reason: z.string().trim().min(3).max(500),
});
export type AdminTrialExtensionRequest = z.infer<typeof adminTrialExtensionRequestSchema>;

export const adminVenueActionRequestSchema = z.object({
  action: z.enum(["VERIFY", "REJECT", "SUSPEND", "RESTORE"]),
  reason: z.string().trim().min(3).max(500),
});
export type AdminVenueActionRequest = z.infer<typeof adminVenueActionRequestSchema>;

export const adminUserStatusRequestSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  reason: z.string().trim().min(3).max(500),
});
export type AdminUserStatusRequest = z.infer<typeof adminUserStatusRequestSchema>;

export const platformSettingsUpdateRequestSchema = z.object({
  monthlyPriceAfn: z.number().int().min(0).max(100_000_000),
  annualPriceAfn: z.number().int().min(0).max(1_000_000_000),
  trialDurationHours: z.number().int().min(1).max(720),
  featureFlags: z.record(z.string(), z.boolean()).default({}),
  notificationTemplates: z.record(z.string(), z.string()).default({}),
});
export type PlatformSettingsUpdateRequest = z.infer<typeof platformSettingsUpdateRequestSchema>;

export const adminSupportNoteRequestSchema = z.object({
  targetType: z.enum(["USER", "VENUE"]),
  targetId: z.string().uuid(),
  note: z.string().trim().min(3).max(1000),
});
export type AdminSupportNoteRequest = z.infer<typeof adminSupportNoteRequestSchema>;

export const adminUserDtoSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  username: z.string().nullable(),
  phone: z.string(),
  status: z.enum(["ACTIVE", "SUSPENDED", "DELETED"]),
  roles: z.array(userRoleSchema),
  createdAt: isoDateTimeSchema,
});
export type AdminUserDto = z.infer<typeof adminUserDtoSchema>;

export const adminVenueDtoSchema = z.object({
  id: z.string().uuid(),
  ownerUserId: z.string().uuid(),
  name: z.string(),
  province: z.string(),
  city: z.string(),
  address: z.string(),
  status: z.enum(["DRAFT", "READY", "ACTIVE", "SUSPENDED"]),
  verificationStatus: z.enum(["PENDING","VERIFIED","REJECTED"]),
  subscriptionState: venueSubscriptionStateSchema,
  trialEndsAt: isoDateTimeSchema.nullable(),
  activeUntil: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});
export type AdminVenueDto = z.infer<typeof adminVenueDtoSchema>;

export const adminAuditLogDtoSchema = z.object({
  id: z.string().uuid(),
  actorUserId: z.string().uuid().nullable(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: isoDateTimeSchema,
});
export type AdminAuditLogDto = z.infer<typeof adminAuditLogDtoSchema>;

export const adminDashboardResponseSchema = z.object({
  generatedAt: isoDateTimeSchema,
  activeUsers: z.number().int().min(0),
  activeVenues: z.number().int().min(0),
  pendingVenueVerifications: z.number().int().min(0),
  trialVenues: z.number().int().min(0),
  paidVenues: z.number().int().min(0),
  expiredVenues: z.number().int().min(0),
  recordedPaymentsAfn: z.number().int().min(0),
  bookingGmvAfn: z.number().int().min(0),
});
export type AdminDashboardResponse = z.infer<typeof adminDashboardResponseSchema>;

export const bookingModeSchema = z.enum(["INSTANT", "APPROVAL"]);
export type BookingMode = z.infer<typeof bookingModeSchema>;

export const bookingStatusSchema = z.enum(["PENDING", "CONFIRMED", "CANCELLED"]);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;

export const bookingSourceSchema = z.enum(["ONLINE", "MANUAL"]);
export type BookingSource = z.infer<typeof bookingSourceSchema>;

export const publicVenueDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  province: z.string(),
  city: z.string(),
  address: z.string(),
  publicPhone: z.string(),
  pageProfileImageUrl: z.string().nullable(),
  pageCoverImageUrl: z.string().nullable(),
  pageBio: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  timezone: z.string(),
  bookingMode: z.enum(["INSTANT","APPROVAL"]),
  onlineBookingEnabled: z.boolean(),
  minimumBookingNoticeMinutes: z.number().int().min(0),
  maximumAdvanceBookingDays: z.number().int().min(1),
  cancellationPolicy: z.string(),
  areas: z.array(venueAreaDtoSchema),
});
export type PublicVenueDto = z.infer<typeof publicVenueDtoSchema>;

export const venueSearchSuggestionSchema=z.object({
  kind:z.enum(["VENUE","LOCATION"]),
  label:z.string(),
  detail:z.string(),
  query:z.string(),
});
export type VenueSearchSuggestion=z.infer<typeof venueSearchSuggestionSchema>;

export const venueDiscoveryResponseSchema=z.object({
  provinces:z.array(z.string()),
  suggestions:z.array(venueSearchSuggestionSchema),
  generatedAt:isoDateTimeSchema,
});
export type VenueDiscoveryResponse=z.infer<typeof venueDiscoveryResponseSchema>;

export const publicVenueListResponseSchema = z.object({
  generatedAt: isoDateTimeSchema,
  venues: z.array(publicVenueDtoSchema),
});
export type PublicVenueListResponse = z.infer<typeof publicVenueListResponseSchema>;

export const availabilitySlotDtoSchema = z.object({
  venueId: z.string().uuid(),
  areaId: z.string().uuid(),
  areaName: z.string(),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema,
  priceAfn: z.number().int().min(0),
  originalPriceAfn: z.number().int().min(0).nullable(),
  promotionId: z.string().uuid().nullable(),
  currency: z.literal("AFN"),
  status: z.literal("AVAILABLE"),
});
export type AvailabilitySlotDto = z.infer<typeof availabilitySlotDtoSchema>;

export const venueAvailabilityResponseSchema = z.object({
  venue: publicVenueDtoSchema,
  date: dateOnlySchema,
  generatedAt: isoDateTimeSchema,
  live: z.literal(true),
  slots: z.array(availabilitySlotDtoSchema),
});
export type VenueAvailabilityResponse = z.infer<typeof venueAvailabilityResponseSchema>;

export const onlineBookingRequestSchema = z.object({
  areaId: z.string().uuid(),
  startsAt: isoDateTimeSchema,
  idempotencyKey: z.string().trim().min(8).max(80),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});
export type OnlineBookingRequest = z.infer<typeof onlineBookingRequestSchema>;

export const manualBookingRequestSchema = z.object({
  areaId: z.string().uuid(),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema,
  customerName: z.string().trim().min(2).max(120),
  customerPhone: phoneInputSchema.optional().or(z.literal("")),
  priceAfn: z.number().int().min(0).max(1_000_000).optional(),
  note: z.string().trim().max(500).optional().or(z.literal("")),
}).superRefine((value, ctx) => {
  if (Date.parse(value.endsAt) <= Date.parse(value.startsAt)) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End time must be after start time." });
  }
});
export type ManualBookingRequest = z.infer<typeof manualBookingRequestSchema>;

export const venueBlockRequestSchema = z.object({
  areaId: z.string().uuid(),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema,
  reason: z.string().trim().max(240).optional().or(z.literal("")),
}).superRefine((value, ctx) => {
  if (Date.parse(value.endsAt) <= Date.parse(value.startsAt)) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End time must be after start time." });
  }
});
export type VenueBlockRequest = z.infer<typeof venueBlockRequestSchema>;

export const bookingCancelRequestSchema = z.object({
  reason: z.string().trim().max(240).optional().or(z.literal("")),
});
export type BookingCancelRequest = z.infer<typeof bookingCancelRequestSchema>;

export const bookingDtoSchema = z.object({
  id: z.string().uuid(),
  venueId: z.string().uuid(),
  venueName: z.string(),
  areaId: z.string().uuid(),
  areaName: z.string(),
  playerUserId: z.string().uuid().nullable(),
  source: bookingSourceSchema,
  status: bookingStatusSchema,
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema,
  priceAfn: z.number().int().min(0),
  currency: z.literal("AFN"),
  customerName: z.string().nullable(),
  customerPhone: z.string().nullable(),
  note: z.string().nullable(),
  cancellationPolicySnapshot: z.string(),
  cancelledAt: isoDateTimeSchema.nullable(),
  cancellationReason: z.string().nullable(),
});
export type BookingDto = z.infer<typeof bookingDtoSchema>;

export const venueBlockDtoSchema = z.object({
  id: z.string().uuid(),
  venueId: z.string().uuid(),
  areaId: z.string().uuid(),
  areaName: z.string(),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema,
  reason: z.string().nullable(),
});
export type VenueBlockDto = z.infer<typeof venueBlockDtoSchema>;

export const ownerScheduleResponseSchema = z.object({
  date: dateOnlySchema,
  generatedAt: isoDateTimeSchema,
  bookings: z.array(bookingDtoSchema),
  blocks: z.array(venueBlockDtoSchema),
});
export type OwnerScheduleResponse = z.infer<typeof ownerScheduleResponseSchema>;


export const venueTimetableStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
export type VenueTimetableStatus = z.infer<typeof venueTimetableStatusSchema>;

export const venueTimetablePeriodInputSchema = z.object({
  areaId: z.string().uuid().nullable(),
  dayOfWeek: z.number().int().min(0).max(6),
  startsAt: hhmmSchema,
  endsAt: hhmmSchema,
  priceAfn: z.number().int().min(0).max(1_000_000),
}).superRefine((value, ctx) => {
  if (value.startsAt >= value.endsAt) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End time must be after start time." });
  }
});
export type VenueTimetablePeriodInput = z.infer<typeof venueTimetablePeriodInputSchema>;

const timetablePeriodsSchema = z.array(venueTimetablePeriodInputSchema).min(1).max(300).superRefine((periods, ctx) => {
  const groups = new Map<string, Array<{ startsAt: string; endsAt: string }>>();
  for (const period of periods) {
    const key = `${period.areaId ?? "ALL"}:${period.dayOfWeek}`;
    const group = groups.get(key) ?? [];
    group.push({ startsAt: period.startsAt, endsAt: period.endsAt });
    groups.set(key, group);
  }
  for (const [key, group] of groups) {
    const sorted = [...group].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    for (let index = 1; index < sorted.length; index += 1) {
      if (sorted[index]!.startsAt < sorted[index - 1]!.endsAt) {
        ctx.addIssue({ code: "custom", message: `Timetable periods overlap for ${key}.` });
      }
    }
  }
});

export const venueTimetableDraftRequestSchema = z.object({
  name: z.string().trim().min(2).max(120).default("Weekly timetable"),
  effectiveFrom: dateOnlySchema,
  effectiveUntil: dateOnlySchema.nullable().default(null),
  defaultSlotDurationMinutes: z.number().int().min(30).max(240).default(90),
  bufferMinutes: z.number().int().min(0).max(60).default(0),
  periods: timetablePeriodsSchema,
}).superRefine((value, ctx) => {
  if (value.effectiveUntil && value.effectiveUntil < value.effectiveFrom) {
    ctx.addIssue({ code: "custom", path: ["effectiveUntil"], message: "End date must be on or after the start date." });
  }
});
export type VenueTimetableDraftRequest = z.infer<typeof venueTimetableDraftRequestSchema>;

export const venueTimetableDtoSchema = venueTimetableDraftRequestSchema.safeExtend({
  id: z.string().uuid(),
  venueId: z.string().uuid(),
  status: venueTimetableStatusSchema,
  publishedAt: isoDateTimeSchema.nullable(),
  archivedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type VenueTimetableDto = z.infer<typeof venueTimetableDtoSchema>;

export const venueTimetableExceptionPeriodSchema = z.object({
  startsAt: hhmmSchema,
  endsAt: hhmmSchema,
  priceAfn: z.number().int().min(0).max(1_000_000).nullable().default(null),
}).superRefine((value, ctx) => {
  if (value.startsAt >= value.endsAt) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "End time must be after start time." });
  }
});
export type VenueTimetableExceptionPeriod = z.infer<typeof venueTimetableExceptionPeriodSchema>;

export const venueTimetableExceptionRequestSchema = z.object({
  areaId: z.string().uuid().nullable(),
  date: dateOnlySchema,
  isClosed: z.boolean(),
  periods: z.array(venueTimetableExceptionPeriodSchema).max(12).default([]),
  note: z.string().trim().max(240).optional().or(z.literal("")),
}).superRefine((value, ctx) => {
  if (!value.isClosed && value.periods.length === 0) {
    ctx.addIssue({ code: "custom", path: ["periods"], message: "Special hours require at least one time period." });
  }
  const sorted = [...value.periods].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index]!.startsAt < sorted[index - 1]!.endsAt) {
      ctx.addIssue({ code: "custom", path: ["periods"], message: "Special-hour periods cannot overlap." });
    }
  }
});
export type VenueTimetableExceptionRequest = z.infer<typeof venueTimetableExceptionRequestSchema>;

export const venueTimetableExceptionDtoSchema = z.object({
  id: z.string().uuid(),
  venueId: z.string().uuid(),
  areaId: z.string().uuid().nullable(),
  date: dateOnlySchema,
  isClosed: z.boolean(),
  periods: z.array(venueTimetableExceptionPeriodSchema).max(12),
  note: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type VenueTimetableExceptionDto = z.infer<typeof venueTimetableExceptionDtoSchema>;

export const timetableConflictTypeSchema = z.enum(["BOOKING", "BLOCK", "COMPETITION_MATCH"]);
export const venueTimetableConflictSchema = z.object({
  type: timetableConflictTypeSchema,
  areaId: z.string().uuid(),
  areaName: z.string(),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema,
  title: z.string(),
});
export type VenueTimetableConflict = z.infer<typeof venueTimetableConflictSchema>;

export const venueTimetableListResponseSchema = z.object({
  current: venueTimetableDtoSchema.nullable(),
  drafts: z.array(venueTimetableDtoSchema),
  future: z.array(venueTimetableDtoSchema),
  archived: z.array(venueTimetableDtoSchema),
  exceptions: z.array(venueTimetableExceptionDtoSchema),
});
export type VenueTimetableListResponse = z.infer<typeof venueTimetableListResponseSchema>;

export const venueTimetablePublishResponseSchema = z.object({
  timetable: venueTimetableDtoSchema,
  conflicts: z.array(venueTimetableConflictSchema),
});
export type VenueTimetablePublishResponse = z.infer<typeof venueTimetablePublishResponseSchema>;

export const venueCalendarEventTypeSchema = z.enum([
  "AVAILABLE",
  "ONLINE_BOOKING",
  "MANUAL_BOOKING",
  "COMPETITION",
  "BLOCKED",
  "PROMOTION",
  "CLOSED",
]);
export type VenueCalendarEventType = z.infer<typeof venueCalendarEventTypeSchema>;

export const venueCalendarEventSchema = z.object({
  id: z.string(),
  type: venueCalendarEventTypeSchema,
  areaId: z.string().uuid().nullable(),
  areaName: z.string(),
  startsAt: isoDateTimeSchema.nullable(),
  endsAt: isoDateTimeSchema.nullable(),
  title: z.string(),
  priceAfn: z.number().int().min(0).nullable(),
  bookingStatus: bookingStatusSchema.nullable().optional(),
});
export type VenueCalendarEvent = z.infer<typeof venueCalendarEventSchema>;

export const venueCalendarDaySchema = z.object({
  date: dateOnlySchema,
  availableCount: z.number().int().min(0),
  bookedCount: z.number().int().min(0),
  manualCount: z.number().int().min(0),
  competitionCount: z.number().int().min(0),
  blockedCount: z.number().int().min(0),
  promotionCount: z.number().int().min(0),
  revenueAfn: z.number().int().min(0),
  closed: z.boolean(),
  events: z.array(venueCalendarEventSchema),
});
export type VenueCalendarDay = z.infer<typeof venueCalendarDaySchema>;

export const venueTimetableCalendarResponseSchema = z.object({
  from: dateOnlySchema,
  to: dateOnlySchema,
  generatedAt: isoDateTimeSchema,
  areaId: z.string().uuid().nullable(),
  days: z.array(venueCalendarDaySchema),
});
export type VenueTimetableCalendarResponse = z.infer<typeof venueTimetableCalendarResponseSchema>;


export const promotionStatusSchema = z.enum(["ACTIVE", "CLOSED", "EXPIRED"]);
export type PromotionStatus = z.infer<typeof promotionStatusSchema>;

export const promotionCreateRequestSchema = z.object({
  areaId: z.string().uuid(),
  startsAt: isoDateTimeSchema,
  discountedPriceAfn: z.number().int().min(0).max(1_000_000),
  title: z.string().trim().min(2).max(120),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  notifyFollowers: z.boolean().default(true),
});
export type PromotionCreateRequest = z.infer<typeof promotionCreateRequestSchema>;

export const promotionDtoSchema = z.object({
  id: z.string().uuid(),
  venueId: z.string().uuid(),
  venueName: z.string(),
  areaId: z.string().uuid(),
  areaName: z.string(),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema,
  originalPriceAfn: z.number().int().min(0),
  discountedPriceAfn: z.number().int().min(0),
  discountPercent: z.number().int().min(0).max(100),
  currency: z.literal("AFN"),
  status: promotionStatusSchema,
  title: z.string(),
  note: z.string().nullable(),
  notifyFollowers: z.boolean(),
  createdAt: isoDateTimeSchema,
  closedAt: isoDateTimeSchema.nullable(),
  closeReason: z.string().nullable(),
});
export type PromotionDto = z.infer<typeof promotionDtoSchema>;

export const postStatusSchema = z.enum(["PUBLISHED", "UNPUBLISHED"]);
export type PostStatus = z.infer<typeof postStatusSchema>;

export const postCtaTypeSchema = z.enum(["NONE", "VENUE", "PROMOTION", "COMPETITION"]);
export type PostCtaType = z.infer<typeof postCtaTypeSchema>;

const httpsImageUrlSchema = z.string().url().refine((value) => value.startsWith("https://"), "Image URL must use HTTPS.");
export const mediaImageRefSchema = z.union([
  httpsImageUrlSchema,
  z.string().regex(/^\/api\/v1\/media-assets\/[0-9a-f-]{36}\/[A-Za-z0-9_-]{32,64}$/),
]);
export const venueMediaAssetPurposeSchema = z.enum(["POST","PROFILE","COVER"]);
export type VenueMediaAssetPurpose = z.infer<typeof venueMediaAssetPurposeSchema>;

export const venueMediaAssetDtoSchema = z.object({
  id: z.string().uuid(),
  purpose: venueMediaAssetPurposeSchema,
  imageUrl: mediaImageRefSchema,
  mimeType: z.string(),
  byteSize: z.number().int().positive(),
  createdAt: isoDateTimeSchema,
});
export type VenueMediaAssetDto = z.infer<typeof venueMediaAssetDtoSchema>;

export const venueMediaPageUpdateRequestSchema = z.object({
  pageProfileImageUrl: mediaImageRefSchema.nullable().optional(),
  pageCoverImageUrl: mediaImageRefSchema.nullable().optional(),
  pageBio: z.string().trim().max(500).nullable().optional(),
});
export type VenueMediaPageUpdateRequest = z.infer<typeof venueMediaPageUpdateRequestSchema>;

export const venueMediaPageDtoSchema = z.object({
  venueId: z.string().uuid(),
  name: z.string(),
  city: z.string(),
  province: z.string(),
  pageProfileImageUrl: z.string().nullable(),
  pageCoverImageUrl: z.string().nullable(),
  pageBio: z.string().nullable(),
  followerCount: z.number().int().min(0),
  postCount: z.number().int().min(0),
});
export type VenueMediaPageDto = z.infer<typeof venueMediaPageDtoSchema>;

export const venuePostTypeSchema = z.enum(["GENERAL","ANNOUNCEMENT","PROMOTION","COMPETITION","RESULT"]);
export type VenuePostType = z.infer<typeof venuePostTypeSchema>;

export const venuePostVisibilitySchema = z.enum(["PUBLIC","FOLLOWERS","PRIVATE"]);
export type VenuePostVisibility = z.infer<typeof venuePostVisibilitySchema>;

export const venuePostScheduledActionSchema = z.enum(["PUBLISH","UNPUBLISH","MAKE_PUBLIC","MAKE_FOLLOWERS","MAKE_PRIVATE","DELETE"]);
export type VenuePostScheduledAction = z.infer<typeof venuePostScheduledActionSchema>;

export const venuePostScheduleRequestSchema = z.object({
  action: venuePostScheduledActionSchema,
  executeAt: isoDateTimeSchema,
});
export type VenuePostScheduleRequest = z.infer<typeof venuePostScheduleRequestSchema>;

export const venuePostScheduleDtoSchema = venuePostScheduleRequestSchema.extend({
  id: z.string().uuid(),
  postId: z.string().uuid(),
  executedAt: isoDateTimeSchema.nullable(),
  cancelledAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});
export type VenuePostScheduleDto = z.infer<typeof venuePostScheduleDtoSchema>;

export const venuePostCreateRequestSchema = z.object({
  body: z.string().trim().min(1).max(2_000),
  imageUrl: mediaImageRefSchema.optional().or(z.literal("")),
  ctaType: postCtaTypeSchema.default("NONE"),
  ctaTargetId: z.string().uuid().nullable().optional(),
  postType: venuePostTypeSchema.default("GENERAL"),
  visibility: venuePostVisibilitySchema.default("PUBLIC"),
  publishMode: z.enum(["NOW","DRAFT","SCHEDULED"]).default("NOW"),
  publishAt: isoDateTimeSchema.nullable().optional(),
  notifyFollowers: z.boolean().default(false),
  schedules: z.array(venuePostScheduleRequestSchema).max(8).default([]),
}).superRefine((value, ctx) => {
  if (value.ctaType === "NONE" && value.ctaTargetId) {
    ctx.addIssue({ code: "custom", path: ["ctaTargetId"], message: "A NONE CTA cannot have a target." });
  }
  if (value.ctaType !== "NONE" && value.ctaType !== "VENUE" && !value.ctaTargetId) {
    ctx.addIssue({ code: "custom", path: ["ctaTargetId"], message: "This CTA requires a target." });
  }
  if (value.publishMode === "SCHEDULED" && !value.publishAt) {
    ctx.addIssue({ code: "custom", path: ["publishAt"], message: "Scheduled posts require a publish time." });
  }
  if (value.publishMode !== "SCHEDULED" && value.publishAt) {
    ctx.addIssue({ code: "custom", path: ["publishAt"], message: "Publish time is only used for scheduled posts." });
  }
});
export type VenuePostCreateRequest = z.infer<typeof venuePostCreateRequestSchema>;

export const venuePostUpdateRequestSchema = z.object({
  body: z.string().trim().min(1).max(2_000).optional(),
  imageUrl: mediaImageRefSchema.optional().or(z.literal("")),
  ctaType: postCtaTypeSchema.optional(),
  ctaTargetId: z.string().uuid().nullable().optional(),
  postType: venuePostTypeSchema.optional(),
  visibility: venuePostVisibilitySchema.optional(),
  notifyFollowers: z.boolean().optional(),
}).superRefine((value, ctx) => {
  if (value.ctaType === "NONE" && value.ctaTargetId) {
    ctx.addIssue({ code: "custom", path: ["ctaTargetId"], message: "A NONE CTA cannot have a target." });
  }
});
export type VenuePostUpdateRequest = z.infer<typeof venuePostUpdateRequestSchema>;

export const venuePostDtoSchema = z.object({
  id: z.string().uuid(),
  venueId: z.string().uuid(),
  venueName: z.string(),
  socialPostId: z.string().uuid().nullable(),
  body: z.string(),
  imageUrl: z.string().nullable(),
  ctaType: postCtaTypeSchema,
  ctaTargetId: z.string().uuid().nullable(),
  postType: venuePostTypeSchema,
  visibility: venuePostVisibilitySchema,
  notifyFollowers: z.boolean(),
  status: postStatusSchema,
  publishedAt: isoDateTimeSchema,
  unpublishedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  schedules: z.array(venuePostScheduleDtoSchema),
});
export type VenuePostDto = z.infer<typeof venuePostDtoSchema>;

export const followStateDtoSchema = z.object({
  venueId: z.string().uuid(),
  following: z.boolean(),
  followerCount: z.number().int().min(0),
});
export type FollowStateDto = z.infer<typeof followStateDtoSchema>;

export const followedVenueDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  imageUrl: z.string().nullable(),
  city: z.string(),
  province: z.string(),
});
export type FollowedVenueDto = z.infer<typeof followedVenueDtoSchema>;

export const followedVenuesResponseSchema = z.object({
  venues: z.array(followedVenueDtoSchema),
  generatedAt: isoDateTimeSchema,
});
export type FollowedVenuesResponse = z.infer<typeof followedVenuesResponseSchema>;

export const mostFollowedVenueDtoSchema=followedVenueDtoSchema.extend({
  followerCount:z.number().int().nonnegative(),
  onlineBookingEnabled:z.boolean(),
});
export type MostFollowedVenueDto=z.infer<typeof mostFollowedVenueDtoSchema>;
export const mostFollowedVenuesResponseSchema=z.object({
  venues:z.array(mostFollowedVenueDtoSchema).max(15),generatedAt:isoDateTimeSchema,
});
export type MostFollowedVenuesResponse=z.infer<typeof mostFollowedVenuesResponseSchema>;

export const nearbyVenueDtoSchema=followedVenueDtoSchema.extend({
  latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),
  distanceKm:z.number().nonnegative(),onlineBookingEnabled:z.boolean(),
});
export type NearbyVenueDto=z.infer<typeof nearbyVenueDtoSchema>;
export const nearbyVenuesResponseSchema=z.object({
  venues:z.array(nearbyVenueDtoSchema).max(10),generatedAt:isoDateTimeSchema,
});
export type NearbyVenuesResponse=z.infer<typeof nearbyVenuesResponseSchema>;

export const socialEntityTypeSchema = z.enum(["VENUE", "TEAM", "COMPETITION", "USER"]);
export type SocialEntityType = z.infer<typeof socialEntityTypeSchema>;

export const socialFollowStateDtoSchema = z.object({
  entityType: socialEntityTypeSchema,
  entityId: z.string().uuid(),
  following: z.boolean(),
  followerCount: z.number().int().min(0),
});
export type SocialFollowStateDto = z.infer<typeof socialFollowStateDtoSchema>;

export const socialDirectoryDiscoveryResponseSchema=z.object({
  entityType:z.enum(["TEAM","COMPETITION"]),
  followedIds:z.array(z.string().uuid()),
  counts:z.array(z.object({id:z.string().uuid(),count:z.number().int().nonnegative()})),
});
export type SocialDirectoryDiscoveryResponse=z.infer<typeof socialDirectoryDiscoveryResponseSchema>;

export const socialUserPostCreateRequestSchema = z.object({
  body: z.string().trim().max(3000).default(""),
  imageUrl: z.string().trim().max(250).nullable().optional(),
}).refine(input => Boolean(input.body || input.imageUrl), {
  message: "Post text or an image is required.",
});
export type SocialUserPostCreateRequest = z.infer<typeof socialUserPostCreateRequestSchema>;

export const socialPostCommentCreateRequestSchema = z.object({
  body: z.string().trim().min(1).max(1_000),
});
export type SocialPostCommentCreateRequest = z.infer<typeof socialPostCommentCreateRequestSchema>;

export const socialPostCommentUpdateRequestSchema = z.object({
  body: z.string().trim().min(1).max(1_000),
});
export type SocialPostCommentUpdateRequest = z.infer<typeof socialPostCommentUpdateRequestSchema>;

export const socialPostCommentDtoSchema = z.object({
  id: z.string().uuid(),
  postId: z.string().uuid(),
  userId: z.string().uuid(),
  displayName: z.string(),
  profileImageUrl: z.string().nullable(),
  body: z.string(),
  createdAt: isoDateTimeSchema,
  editedAt: isoDateTimeSchema.nullable(),
  likedByMe: z.boolean(),
  likeCount: z.number().int().min(0),
  canManage: z.boolean(),
});
export type SocialPostCommentDto = z.infer<typeof socialPostCommentDtoSchema>;

export const socialFeedPostDtoSchema = z.object({
  id: z.string().uuid(),
  authorType: socialEntityTypeSchema,
  authorId: z.string().uuid(),
  authorName: z.string(),
  authorImageUrl: z.string().nullable(),
  body: z.string(),
  imageUrl: z.string().nullable(),
  postType: venuePostTypeSchema.default("GENERAL"),
  publishedAt: isoDateTimeSchema,
  deepLink: z.string(),
  likedByMe: z.boolean(),
  likeCount: z.number().int().min(0),
  commentCount: z.number().int().min(0),
});
export type SocialFeedPostDto = z.infer<typeof socialFeedPostDtoSchema>;

export const socialFeedResponseSchema = z.object({
  generatedAt: isoDateTimeSchema,
  items: z.array(socialFeedPostDtoSchema),
});
export type SocialFeedResponse = z.infer<typeof socialFeedResponseSchema>;

export const feedItemDtoSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("PROMOTION"),
    id: z.string().uuid(),
    venueId: z.string().uuid(),
    venueName: z.string(),
    createdAt: isoDateTimeSchema,
    deepLink: z.string(),
    promotion: promotionDtoSchema,
  }),
  z.object({
    type: z.literal("POST"),
    id: z.string().uuid(),
    venueId: z.string().uuid(),
    venueName: z.string(),
    createdAt: isoDateTimeSchema,
    deepLink: z.string(),
    post: venuePostDtoSchema,
  }),
]);
export type FeedItemDto = z.infer<typeof feedItemDtoSchema>;

export const feedResponseSchema = z.object({
  generatedAt: isoDateTimeSchema,
  items: z.array(feedItemDtoSchema),
});
export type FeedResponse = z.infer<typeof feedResponseSchema>;

export const playerPositionSchema = z.enum(["UNSPECIFIED", "GOALKEEPER", "FIXO", "ALA", "PIVO", "UNIVERSAL"]);
export type PlayerPosition = z.infer<typeof playerPositionSchema>;

export const profileVisibilitySchema = z.enum(["PUBLIC", "PRIVATE"]);
export type ProfileVisibility = z.infer<typeof profileVisibilitySchema>;

export const teamPrivacySchema = z.enum(["PUBLIC", "PRIVATE"]);
export type TeamPrivacy = z.infer<typeof teamPrivacySchema>;

export const teamStatusSchema = z.enum(["ACTIVE", "ARCHIVED"]);
export type TeamStatus = z.infer<typeof teamStatusSchema>;

export const teamMemberRoleSchema = z.enum(["MANAGER", "CAPTAIN", "PLAYER"]);
export type TeamMemberRole = z.infer<typeof teamMemberRoleSchema>;

export const teamMembershipStatusSchema = z.enum(["ACTIVE", "REMOVED"]);
export type TeamMembershipStatus = z.infer<typeof teamMembershipStatusSchema>;

export const teamInvitationStatusSchema = z.enum(["PENDING", "ACCEPTED", "DECLINED", "REVOKED", "EXPIRED"]);
export type TeamInvitationStatus = z.infer<typeof teamInvitationStatusSchema>;

export const teamJoinRequestStatusSchema = z.enum(["PENDING", "ACCEPTED", "REJECTED", "CANCELLED"]);
export type TeamJoinRequestStatus = z.infer<typeof teamJoinRequestStatusSchema>;

export const playerProfileUpdateRequestSchema = z.object({
  publicDisplayName: z.string().trim().min(2).max(80).optional(),
  imageUrl: mediaImageRefSchema.optional().or(z.literal("")),
  position: playerPositionSchema.optional(),
  visibility: profileVisibilitySchema.optional(),
});
export type PlayerProfileUpdateRequest = z.infer<typeof playerProfileUpdateRequestSchema>;

export const playerTeamSummaryDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  logoUrl: z.string().nullable(),
  city: z.string(),
  role: teamMemberRoleSchema,
});
export type PlayerTeamSummaryDto = z.infer<typeof playerTeamSummaryDtoSchema>;

export const publicPlayerProfileDtoSchema = z.object({
  userId: z.string().uuid(),
  publicDisplayName: z.string(),
  imageUrl: z.string().nullable(),
  position: playerPositionSchema,
  teams: z.array(playerTeamSummaryDtoSchema),
});
export type PublicPlayerProfileDto = z.infer<typeof publicPlayerProfileDtoSchema>;

export const ownPlayerProfileDtoSchema = publicPlayerProfileDtoSchema.extend({
  visibility: profileVisibilitySchema,
});
export type OwnPlayerProfileDto = z.infer<typeof ownPlayerProfileDtoSchema>;

export const teamCreateRequestSchema = z.object({
  name: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(80),
  logoUrl: httpsImageUrlSchema.optional().or(z.literal("")),
  privacy: teamPrivacySchema.default("PUBLIC"),
});
export type TeamCreateRequest = z.infer<typeof teamCreateRequestSchema>;

export const teamUpdateRequestSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  city: z.string().trim().min(2).max(80).optional(),
  logoUrl: httpsImageUrlSchema.optional().or(z.literal("")),
  privacy: teamPrivacySchema.optional(),
});
export type TeamUpdateRequest = z.infer<typeof teamUpdateRequestSchema>;

export const teamMemberDtoSchema = z.object({
  userId: z.string().uuid(),
  publicDisplayName: z.string(),
  imageUrl: z.string().nullable(),
  position: playerPositionSchema,
  role: teamMemberRoleSchema,
  shirtNumber: z.number().int().min(1).max(99).nullable(),
  joinedAt: isoDateTimeSchema,
});
export type TeamMemberDto = z.infer<typeof teamMemberDtoSchema>;

export const teamDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  logoUrl: z.string().nullable(),
  city: z.string(),
  status: teamStatusSchema,
  privacy: teamPrivacySchema,
  managerUserId: z.string().uuid(),
  captainUserId: z.string().uuid().nullable(),
  rosterCount: z.number().int().min(0),
  members: z.array(teamMemberDtoSchema),
  createdAt: isoDateTimeSchema,
});
export type TeamDto = z.infer<typeof teamDtoSchema>;

export const teamListItemDtoSchema = teamDtoSchema.omit({ members: true });
export type TeamListItemDto = z.infer<typeof teamListItemDtoSchema>;

export const teamDirectoryItemDtoSchema = teamListItemDtoSchema.extend({
  myMembershipRole: teamMemberRoleSchema.nullable(),
  joinRequestStatus: teamJoinRequestStatusSchema.nullable(),
});
export type TeamDirectoryItemDto = z.infer<typeof teamDirectoryItemDtoSchema>;

export const teamJoinRequestDtoSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  teamName: z.string(),
  requesterUserId: z.string().uuid(),
  requesterDisplayName: z.string(),
  status: teamJoinRequestStatusSchema,
  createdAt: isoDateTimeSchema,
  respondedAt: isoDateTimeSchema.nullable(),
});
export type TeamJoinRequestDto = z.infer<typeof teamJoinRequestDtoSchema>;

export const teamInviteRequestSchema = z.object({
  identifier: z.string().trim().min(3).max(80),
  role: z.enum(["CAPTAIN", "PLAYER"]).default("PLAYER"),
  shirtNumber: z.number().int().min(1).max(99).nullable().optional(),
});
export type TeamInviteRequest = z.infer<typeof teamInviteRequestSchema>;

export const teamInvitationDtoSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  teamName: z.string(),
  invitedUserId: z.string().uuid(),
  invitedPublicDisplayName: z.string(),
  role: z.enum(["CAPTAIN", "PLAYER"]),
  shirtNumber: z.number().int().min(1).max(99).nullable(),
  status: teamInvitationStatusSchema,
  expiresAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
});
export type TeamInvitationDto = z.infer<typeof teamInvitationDtoSchema>;

export const teamMemberUpdateRequestSchema = z.object({
  shirtNumber: z.number().int().min(1).max(99).nullable().optional(),
});
export type TeamMemberUpdateRequest = z.infer<typeof teamMemberUpdateRequestSchema>;

export const teamCaptainRequestSchema = z.object({
  userId: z.string().uuid().nullable(),
});
export type TeamCaptainRequest = z.infer<typeof teamCaptainRequestSchema>;

export const teamManagerTransferRequestSchema = z.object({
  userId: z.string().uuid(),
});
export type TeamManagerTransferRequest = z.infer<typeof teamManagerTransferRequestSchema>;

export const competitionFormatSchema = z.enum(["LEAGUE", "KNOCKOUT", "GROUP_KNOCKOUT"]);
export type CompetitionFormat = z.infer<typeof competitionFormatSchema>;

export const competitionStatusSchema = z.enum(["DRAFT", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "ARCHIVED", "CANCELLED"]);
export type CompetitionStatus = z.infer<typeof competitionStatusSchema>;

export const competitionRegistrationStatusSchema = z.enum(["INVITED", "APPLIED", "PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN"]);
export type CompetitionRegistrationStatus = z.infer<typeof competitionRegistrationStatusSchema>;

export const competitionFeeStatusSchema = z.enum(["UNPAID", "PENDING", "PAID", "WAIVED"]);
export type CompetitionFeeStatus = z.infer<typeof competitionFeeStatusSchema>;

export const competitionMatchStageSchema = z.enum(["LEAGUE", "GROUP", "KNOCKOUT"]);
export type CompetitionMatchStage = z.infer<typeof competitionMatchStageSchema>;

export const competitionMatchStatusSchema = z.enum(["UNSCHEDULED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "POSTPONED", "CANCELLED", "CORRECTED"]);
export type CompetitionMatchStatus = z.infer<typeof competitionMatchStatusSchema>;

export const competitionTieBreakSchema = z.enum(["POINTS", "GOAL_DIFFERENCE", "GOALS_FOR", "HEAD_TO_HEAD", "ADMIN"]);
export type CompetitionTieBreak = z.infer<typeof competitionTieBreakSchema>;

const competitionConfigSchema = z.object({
  name: z.string().trim().min(2).max(140),
  description: z.string().trim().max(2_000).optional().or(z.literal("")),
  format: competitionFormatSchema,
  maxTeams: z.number().int().min(2).max(64),
  registrationFeeAfn: z.number().int().min(0).max(10_000_000).default(0),
  winPoints: z.number().int().min(0).max(20).default(3),
  drawPoints: z.number().int().min(0).max(20).default(1),
  lossPoints: z.number().int().min(0).max(20).default(0),
  tieBreakOrder: z.array(competitionTieBreakSchema).min(1).max(5).default(["POINTS", "GOAL_DIFFERENCE", "GOALS_FOR"]),
  groupCount: z.number().int().min(2).max(16).nullable().optional(),
  qualifiersPerGroup: z.number().int().min(1).max(8).nullable().optional(),
  registrationClosesAt: isoDateTimeSchema.nullable().optional(),
  matchDurationMinutes: z.number().int().min(20).max(180).default(60),
  startsAt: isoDateTimeSchema.nullable().optional(),
  endsAt: isoDateTimeSchema.nullable().optional(),
});

type CompetitionConfigRefinementInput = {
  startsAt?: string | null | undefined;
  endsAt?: string | null | undefined;
  format?: CompetitionFormat | undefined;
  groupCount?: number | null | undefined;
  qualifiersPerGroup?: number | null | undefined;
  registrationClosesAt?: string | null | undefined;
};

function validateCompetitionConfig(
  value: CompetitionConfigRefinementInput,
  ctx: z.RefinementCtx,
) {
  if (value.startsAt && value.endsAt && Date.parse(value.endsAt) <= Date.parse(value.startsAt)) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "Competition end must be after start." });
  }
  if (value.registrationClosesAt && value.startsAt && Date.parse(value.registrationClosesAt) >= Date.parse(value.startsAt)) {
    ctx.addIssue({ code: "custom", path: ["registrationClosesAt"], message: "Registration must close before the competition starts." });
  }
  if (value.format === "GROUP_KNOCKOUT") {
    if (!value.groupCount) ctx.addIssue({ code: "custom", path: ["groupCount"], message: "Group count is required." });
    if (!value.qualifiersPerGroup) ctx.addIssue({ code: "custom", path: ["qualifiersPerGroup"], message: "Qualifiers per group is required." });
  }
}

export const competitionCreateRequestSchema = competitionConfigSchema.superRefine(validateCompetitionConfig);
export type CompetitionCreateRequest = z.infer<typeof competitionCreateRequestSchema>;

export const competitionUpdateRequestSchema = competitionConfigSchema.partial().superRefine(validateCompetitionConfig);
export type CompetitionUpdateRequest = z.infer<typeof competitionUpdateRequestSchema>;

export const competitionStateRequestSchema = z.object({
  action: z.enum(["OPEN_REGISTRATION", "CLOSE_REGISTRATION", "PUBLISH", "UNPUBLISH", "GENERATE_FIXTURES", "GENERATE_KNOCKOUT", "COMPLETE", "ARCHIVE", "CANCEL"]),
});
export type CompetitionStateRequest = z.infer<typeof competitionStateRequestSchema>;

export const competitionTeamRegisterRequestSchema = z.object({
  teamId: z.string().uuid(),
});
export type CompetitionTeamRegisterRequest = z.infer<typeof competitionTeamRegisterRequestSchema>;

export const competitionRegistrationDecisionRequestSchema = z.object({
  status: z.enum(["ACCEPTED", "REJECTED"]),
  seed: z.number().int().min(1).max(128).nullable().optional(),
});
export type CompetitionRegistrationDecisionRequest = z.infer<typeof competitionRegistrationDecisionRequestSchema>;

export const competitionInviteTeamRequestSchema = z.object({
  teamId: z.string().uuid(),
  seed: z.number().int().min(1).max(128).nullable().optional(),
});
export type CompetitionInviteTeamRequest = z.infer<typeof competitionInviteTeamRequestSchema>;

export const competitionRegistrationResponseRequestSchema = z.object({
  status: z.enum(["ACCEPTED", "REJECTED"]),
});
export type CompetitionRegistrationResponseRequest = z.infer<typeof competitionRegistrationResponseRequestSchema>;

export const competitionFeeUpdateRequestSchema = z.object({
  status: competitionFeeStatusSchema,
  paymentReference: z.string().trim().max(120).optional().or(z.literal("")),
});
export type CompetitionFeeUpdateRequest = z.infer<typeof competitionFeeUpdateRequestSchema>;

export const competitionSeedUpdateRequestSchema = z.object({
  seed: z.number().int().min(1).max(128).nullable(),
});
export type CompetitionSeedUpdateRequest = z.infer<typeof competitionSeedUpdateRequestSchema>;

export const competitionMediaPostCreateRequestSchema = z.object({
  body: z.string().trim().min(1).max(2_000),
  imageUrl: z.string().url().max(2_000).nullable().optional(),
});
export type CompetitionMediaPostCreateRequest = z.infer<typeof competitionMediaPostCreateRequestSchema>;

export const competitionMediaPostStatusRequestSchema = z.object({
  published: z.boolean(),
});
export type CompetitionMediaPostStatusRequest = z.infer<typeof competitionMediaPostStatusRequestSchema>;

export const competitionMediaPostDtoSchema = z.object({
  id: z.string().uuid(),
  competitionId: z.string().uuid(),
  body: z.string(),
  imageUrl: z.string().nullable(),
  status: z.enum(["PUBLISHED", "UNPUBLISHED"]),
  publishedAt: isoDateTimeSchema,
  unpublishedAt: isoDateTimeSchema.nullable(),
});
export type CompetitionMediaPostDto = z.infer<typeof competitionMediaPostDtoSchema>;

export const competitionMatchScheduleRequestSchema = z.object({
  areaId: z.string().uuid(),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema,
  refereeUserId: z.string().uuid().nullable().optional(),
}).superRefine((value, ctx) => {
  if (Date.parse(value.endsAt) <= Date.parse(value.startsAt)) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "Match end must be after start." });
  }
});
export type CompetitionMatchScheduleRequest = z.infer<typeof competitionMatchScheduleRequestSchema>;

export const playerMatchStatInputSchema = z.object({
  playerUserId: z.string().uuid(),
  teamId: z.string().uuid(),
  appeared: z.boolean().default(true),
  goals: z.number().int().min(0).max(50).default(0),
  assists: z.number().int().min(0).max(50).default(0),
  yellowCards: z.number().int().min(0).max(10).default(0),
  redCards: z.number().int().min(0).max(3).default(0),
  cleanSheet: z.boolean().default(false),
  playerOfMatch: z.boolean().default(false),
});
export type PlayerMatchStatInput = z.infer<typeof playerMatchStatInputSchema>;

export const competitionMatchResultRequestSchema = z.object({
  homeScore: z.number().int().min(0).max(99),
  awayScore: z.number().int().min(0).max(99),
  correctionReason: z.string().trim().min(3).max(500).optional(),
  confirmImpact: z.boolean().default(false),
  playerStats: z.array(playerMatchStatInputSchema).max(80).default([]),
});
export type CompetitionMatchResultRequest = z.infer<typeof competitionMatchResultRequestSchema>;

export const competitionTeamDtoSchema = z.object({
  teamId: z.string().uuid(),
  teamName: z.string(),
  logoUrl: z.string().nullable(),
  status: competitionRegistrationStatusSchema,
  seed: z.number().int().nullable(),
  groupId: z.string().uuid().nullable(),
  groupName: z.string().nullable(),
  feeStatus: competitionFeeStatusSchema,
  feePaymentReference: z.string().nullable(),
  feeConfirmedAt: isoDateTimeSchema.nullable(),
});
export type CompetitionTeamDto = z.infer<typeof competitionTeamDtoSchema>;

export const competitionMatchDtoSchema = z.object({
  id: z.string().uuid(),
  competitionId: z.string().uuid(),
  groupId: z.string().uuid().nullable(),
  groupName: z.string().nullable(),
  stage: competitionMatchStageSchema,
  roundNumber: z.number().int().min(1),
  slotNumber: z.number().int().min(1),
  homeTeamId: z.string().uuid().nullable(),
  homeTeamName: z.string().nullable(),
  awayTeamId: z.string().uuid().nullable(),
  awayTeamName: z.string().nullable(),
  areaId: z.string().uuid().nullable(),
  areaName: z.string().nullable(),
  startsAt: isoDateTimeSchema.nullable(),
  endsAt: isoDateTimeSchema.nullable(),
  status: competitionMatchStatusSchema,
  homeScore: z.number().int().nullable(),
  awayScore: z.number().int().nullable(),
  winnerTeamId: z.string().uuid().nullable(),
  nextMatchId: z.string().uuid().nullable(),
  nextMatchSide: z.enum(["HOME", "AWAY"]).nullable(),
  refereeUserId: z.string().uuid().nullable(),
});
export type CompetitionMatchDto = z.infer<typeof competitionMatchDtoSchema>;

export const competitionStandingRowDtoSchema = z.object({
  position: z.number().int().min(1),
  groupId: z.string().uuid().nullable().optional(),
  groupName: z.string().nullable().optional(),
  teamId: z.string().uuid(),
  teamName: z.string(),
  played: z.number().int().min(0),
  wins: z.number().int().min(0),
  draws: z.number().int().min(0),
  losses: z.number().int().min(0),
  goalsFor: z.number().int().min(0),
  goalsAgainst: z.number().int().min(0),
  goalDifference: z.number().int(),
  points: z.number().int(),
});
export type CompetitionStandingRowDto = z.infer<typeof competitionStandingRowDtoSchema>;

export const playerCompetitionStatDtoSchema = z.object({
  playerUserId: z.string().uuid(),
  publicDisplayName: z.string(),
  teamId: z.string().uuid(),
  teamName: z.string(),
  appearances: z.number().int().min(0),
  goals: z.number().int().min(0),
  assists: z.number().int().min(0),
  yellowCards: z.number().int().min(0),
  redCards: z.number().int().min(0),
  cleanSheets: z.number().int().min(0),
  playerOfMatchAwards: z.number().int().min(0),
});
export type PlayerCompetitionStatDto = z.infer<typeof playerCompetitionStatDtoSchema>;

export const competitionDtoSchema = z.object({
  id: z.string().uuid(),
  venueId: z.string().uuid(),
  venueName: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  format: competitionFormatSchema,
  status: competitionStatusSchema,
  published: z.boolean(),
  maxTeams: z.number().int(),
  registrationFeeAfn: z.number().int(),
  winPoints: z.number().int(),
  drawPoints: z.number().int(),
  lossPoints: z.number().int(),
  tieBreakOrder: z.array(competitionTieBreakSchema),
  groupCount: z.number().int().nullable(),
  qualifiersPerGroup: z.number().int().nullable(),
  registrationClosesAt: isoDateTimeSchema.nullable(),
  matchDurationMinutes: z.number().int().min(20).max(180),
  startsAt: isoDateTimeSchema.nullable(),
  endsAt: isoDateTimeSchema.nullable(),
  teams: z.array(competitionTeamDtoSchema),
  matches: z.array(competitionMatchDtoSchema),
  standings: z.array(competitionStandingRowDtoSchema),
  playerStats: z.array(playerCompetitionStatDtoSchema),
  championTeamId: z.string().uuid().nullable(),
});
export type CompetitionDto = z.infer<typeof competitionDtoSchema>;

export const competitionListItemDtoSchema = competitionDtoSchema.omit({
  teams: true,
  matches: true,
  standings: true,
  playerStats: true,
  championTeamId: true,
}).extend({
  acceptedTeams: z.number().int().min(0),
});
export type CompetitionListItemDto = z.infer<typeof competitionListItemDtoSchema>;

export const notificationTypeSchema = z.enum(["BOOKING_CONFIRMED", "BOOKING_CANCELLED", "SLOT_PROMOTION", "VENUE_POST", "TEAM_INVITATION", "COMPETITION_UPDATE"]);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationDtoSchema = z.object({
  id: z.string().uuid(),
  type: notificationTypeSchema,
  title: z.string(),
  body: z.string(),
  deepLink: z.string(),
  data: z.record(z.string(), z.unknown()),
  readAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});
export type NotificationDto = z.infer<typeof notificationDtoSchema>;

export const notificationListFilterSchema=z.enum(["ALL","UNREAD","BOOKINGS","VENUES","TEAMS","COMPETITIONS"]);
export type NotificationListFilter=z.infer<typeof notificationListFilterSchema>;
export const notificationListResponseSchema=z.object({
  notifications:z.array(notificationDtoSchema),
  total:z.number().int().nonnegative(),
  unreadCount:z.number().int().nonnegative(),
  hasMore:z.boolean(),
  generatedAt:isoDateTimeSchema,
});
export type NotificationListResponse=z.infer<typeof notificationListResponseSchema>;

export const notificationPreferencesSchema = z.object({
  inAppEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  promotionsEnabled: z.boolean(),
  venuePostsEnabled: z.boolean(),
  teamInvitesEnabled: z.boolean(),
});
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

export const notificationPreferencesUpdateSchema = notificationPreferencesSchema.partial();
export type NotificationPreferencesUpdate = z.infer<typeof notificationPreferencesUpdateSchema>;

export const pushDeviceRegisterRequestSchema = z.object({
  expoPushToken: z.string().trim().min(20).max(220),
  platform: z.enum(["ANDROID", "IOS"]),
});
export type PushDeviceRegisterRequest = z.infer<typeof pushDeviceRegisterRequestSchema>;

export type ApiErrorBody = {
  error: { code: string; message: string; requestId?: string; details?: unknown };
};

export function normalizeAfghanistanPhone(value: string): string {
  const compact = value.replace(/[\s()-]/g, "");
  if (/^07\d{8}$/.test(compact)) return `+93${compact.slice(1)}`;
  if (/^93\d{9}$/.test(compact)) return `+${compact}`;
  if (/^\+93\d{9}$/.test(compact)) return compact;
  throw new Error("INVALID_AFGHANISTAN_PHONE");
}

export function normalizeUsername(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

export type LeagueFormResult="W"|"D"|"L";

/** Results for the most recent five scored, finalized league fixtures, oldest first. */
export function lastFiveLeagueResults(matches:CompetitionMatchDto[],teamId:string):LeagueFormResult[]{
  return matches.filter(match=>
    match.stage==="LEAGUE" &&
    (match.status==="COMPLETED"||match.status==="CORRECTED") &&
    match.homeScore!==null && match.awayScore!==null &&
    (match.homeTeamId===teamId||match.awayTeamId===teamId)
  ).sort((a,b)=>{
    // Prefer actual played dates. Round + slot give deterministic order for backfilled games.
    const timeCompare=(b.endsAt??b.startsAt??"").localeCompare(a.endsAt??a.startsAt??"");
    return timeCompare||b.roundNumber-a.roundNumber||b.slotNumber-a.slotNumber||b.id.localeCompare(a.id);
  }).slice(0,5).reverse().map(match=>{
    const home=match.homeTeamId===teamId;
    const scored=home?match.homeScore!:match.awayScore!;
    const conceded=home?match.awayScore!:match.homeScore!;
    return scored>conceded?"W":scored<conceded?"L":"D";
  });
}
