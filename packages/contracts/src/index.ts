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
