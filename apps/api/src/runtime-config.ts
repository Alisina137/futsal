import { z } from "zod";

function booleanFromEnv(defaultValue: boolean) {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return defaultValue;
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      if (value.toLowerCase() === "true" || value === "1") return true;
      if (value.toLowerCase() === "false" || value === "0") return false;
    }
    return value;
  }, z.boolean());
}

export const runtimeEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default("*"),
  ACCESS_TOKEN_SECRET: z.string().min(32),
  ACCESS_TOKEN_ISSUER: z.string().default("leaguekick-api"),
  ACCESS_TOKEN_AUDIENCE: z.string().default("leaguekick-mobile"),
  APP_VERSION: z.string().trim().min(1).max(80).default("dev"),
  REQUEST_LOGGING: booleanFromEnv(true),
  PASSWORD_RESET_SECRET: z.string().min(32),
  PASSWORD_RESET_SMS_WEBHOOK_URL: z.string().url().optional().or(z.literal("")),
  PASSWORD_RESET_SMS_WEBHOOK_TOKEN: z.string().optional().or(z.literal("")),
  PASSWORD_RESET_DEV_MODE: booleanFromEnv(false),
}).superRefine((value, ctx) => {
  if (value.NODE_ENV !== "production") return;

  if (value.CORS_ORIGIN.trim() === "*") {
    ctx.addIssue({
      code: "custom",
      path: ["CORS_ORIGIN"],
      message: "Production requires an explicit HTTPS CORS origin allowlist.",
    });
  }

  const origins = value.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);
  if (origins.length === 0 || origins.some((origin) => {
    try { return new URL(origin).protocol !== "https:"; }
    catch { return true; }
  })) {
    ctx.addIssue({
      code: "custom",
      path: ["CORS_ORIGIN"],
      message: "Production CORS origins must be valid HTTPS URLs.",
    });
  }

  const secret = value.ACCESS_TOKEN_SECRET.toLowerCase();
  if (value.ACCESS_TOKEN_SECRET.length < 48 || secret.includes("replace-with") || secret.includes("example") || secret.includes("changeme")) {
    ctx.addIssue({
      code: "custom",
      path: ["ACCESS_TOKEN_SECRET"],
      message: "Production requires a non-placeholder access-token secret of at least 48 characters.",
    });
  }

  const resetSecret = value.PASSWORD_RESET_SECRET.toLowerCase();
  if (value.PASSWORD_RESET_SECRET.length < 48 || resetSecret.includes("replace-with") || resetSecret.includes("example") || resetSecret.includes("changeme")) {
    ctx.addIssue({
      code: "custom",
      path: ["PASSWORD_RESET_SECRET"],
      message: "Production requires a non-placeholder password-reset secret of at least 48 characters.",
    });
  }

  if (value.PASSWORD_RESET_DEV_MODE) {
    ctx.addIssue({
      code: "custom",
      path: ["PASSWORD_RESET_DEV_MODE"],
      message: "Password reset development mode must be disabled in production.",
    });
  }

  if (!value.PASSWORD_RESET_SMS_WEBHOOK_URL) {
    ctx.addIssue({
      code: "custom",
      path: ["PASSWORD_RESET_SMS_WEBHOOK_URL"],
      message: "Production password reset requires an HTTPS SMS delivery webhook.",
    });
  } else if (new URL(value.PASSWORD_RESET_SMS_WEBHOOK_URL).protocol !== "https:") {
    ctx.addIssue({
      code: "custom",
      path: ["PASSWORD_RESET_SMS_WEBHOOK_URL"],
      message: "Production password reset SMS webhook must use HTTPS.",
    });
  }
});

export type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;

export function parseRuntimeEnv(input: NodeJS.ProcessEnv): RuntimeEnv {
  return runtimeEnvSchema.parse(input);
}
