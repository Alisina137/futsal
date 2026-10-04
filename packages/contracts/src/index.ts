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

export const accountTypeSchema = z.enum(["PLAYER", "VENUE_OWNER"]);
export type AccountType = z.infer<typeof accountTypeSchema>;

export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(/^[A-Za-z0-9_]+$/, "Username may contain only letters, numbers, and underscore.");

export const phoneInputSchema = z
  .string()
  .trim()
  .min(9)
  .max(20)
  .regex(/^\+?[0-9\s()-]+$/, "Invalid phone number.");

export const passwordSchema = z.string().min(10).max(128);

export const registerRequestSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  phone: phoneInputSchema,
  username: usernameSchema.optional().or(z.literal("")),
  password: passwordSchema,
  preferredLanguage: languageCodeSchema.default("fa-AF"),
  accountType: accountTypeSchema,
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  identifier: z.string().trim().min(3).max(80),
  password: passwordSchema,
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const refreshRequestSchema = z.object({ refreshToken: z.string().min(32) });
export const logoutRequestSchema = refreshRequestSchema;

export const userDtoSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  username: z.string().nullable(),
  phone: z.string(),
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
  areas: z.array(venueAreaInputSchema).min(1).max(20),
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
  status: z.enum(["DRAFT", "READY", "ACTIVE", "SUSPENDED"]),
  setupCompletedAt: z.string().nullable(),
  areas: z.array(venueAreaDtoSchema),
  openingHours: z.array(venueOpeningHourDtoSchema),
});
export type OwnerVenueDto = z.infer<typeof ownerVenueDtoSchema>;

export const venueSubscriptionStateSchema = z.enum(["NOT_STARTED", "TRIAL", "ACTIVE", "EXPIRED", "CANCELLED"]);
export type VenueSubscriptionState = z.infer<typeof venueSubscriptionStateSchema>;

export const venueSubscriptionDtoSchema = z.object({
  state: venueSubscriptionStateSchema,
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


export const dateOnlySchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Use a real calendar date.");
export const isoDateTimeSchema = z.string()
  .refine((value) => /(Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)), "Use an ISO datetime with timezone.");

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
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  timezone: z.string(),
  bookingMode: bookingModeSchema,
  areas: z.array(venueAreaDtoSchema),
});
export type PublicVenueDto = z.infer<typeof publicVenueDtoSchema>;

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

export const venuePostCreateRequestSchema = z.object({
  body: z.string().trim().min(1).max(2_000),
  imageUrl: httpsImageUrlSchema.optional().or(z.literal("")),
  ctaType: postCtaTypeSchema.default("NONE"),
  ctaTargetId: z.string().uuid().nullable().optional(),
  notifyFollowers: z.boolean().default(false),
}).superRefine((value, ctx) => {
  if (value.ctaType === "NONE" && value.ctaTargetId) {
    ctx.addIssue({ code: "custom", path: ["ctaTargetId"], message: "A NONE CTA cannot have a target." });
  }
  if (value.ctaType !== "NONE" && value.ctaType !== "VENUE" && !value.ctaTargetId) {
    ctx.addIssue({ code: "custom", path: ["ctaTargetId"], message: "This CTA requires a target." });
  }
});
export type VenuePostCreateRequest = z.infer<typeof venuePostCreateRequestSchema>;

export const venuePostDtoSchema = z.object({
  id: z.string().uuid(),
  venueId: z.string().uuid(),
  venueName: z.string(),
  body: z.string(),
  imageUrl: z.string().nullable(),
  ctaType: postCtaTypeSchema,
  ctaTargetId: z.string().uuid().nullable(),
  status: postStatusSchema,
  publishedAt: isoDateTimeSchema,
  unpublishedAt: isoDateTimeSchema.nullable(),
});
export type VenuePostDto = z.infer<typeof venuePostDtoSchema>;

export const followStateDtoSchema = z.object({
  venueId: z.string().uuid(),
  following: z.boolean(),
  followerCount: z.number().int().min(0),
});
export type FollowStateDto = z.infer<typeof followStateDtoSchema>;

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

export const notificationTypeSchema = z.enum(["BOOKING_CONFIRMED", "BOOKING_CANCELLED", "SLOT_PROMOTION", "VENUE_POST"]);
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

export const notificationPreferencesSchema = z.object({
  inAppEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  promotionsEnabled: z.boolean(),
  venuePostsEnabled: z.boolean(),
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
  error: { code: string; message: string; details?: unknown };
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
