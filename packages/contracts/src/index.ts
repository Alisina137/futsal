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
