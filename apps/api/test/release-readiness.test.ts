import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { parseRuntimeEnv } from "../src/runtime-config.js";
import { AuthService } from "../src/modules/auth/auth.service.js";
import { TokenService } from "../src/modules/auth/token.service.js";
import { FakeAuthRepository } from "./fake-auth-repository.js";

function app(options?: { readinessCheck?: () => Promise<void>; corsOrigin?: string }) {
  const repository = new FakeAuthRepository();
  const tokens = new TokenService(
    "test-secret-that-is-longer-than-thirty-two-characters",
    "test",
    "test-mobile",
  );
  const auth = new AuthService(repository, tokens);
  return createApp({
    authService: auth,
    tokenService: tokens,
    appVersion: "1.0.0-test",
    requestLogging: false,
    readinessCheck: options?.readinessCheck,
    corsOrigin: options?.corsOrigin,
  });
}

describe("Phase 8 release readiness", () => {
  it("exposes liveness with security headers, version, and a request correlation ID", async () => {
    const response = await request(app()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      service: "futsal-api",
      version: "1.0.0-test",
    });
    expect(response.headers["x-request-id"]).toBeTruthy();
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("reports readiness without exposing an underlying database error", async () => {
    const response = await request(app({
      readinessCheck: async () => {
        throw new Error("postgresql://private-user:private-password@host/database");
      },
    })).get("/ready");

    expect(response.status).toBe(503);
    expect(response.body.status).toBe("not_ready");
    expect(response.body.requestId).toBeTruthy();
    expect(JSON.stringify(response.body)).not.toContain("private-password");
  });

  it("includes request IDs in safe API errors and disables API caching", async () => {
    const response = await request(app()).get("/api/v1/missing-route");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
    expect(response.body.error.requestId).toBe(response.headers["x-request-id"]);
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("rejects origins outside an explicit CORS allowlist", async () => {
    const response = await request(app({ corsOrigin: "https://app.example.com" }))
      .get("/health")
      .set("Origin", "https://evil.example.com");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CORS_ORIGIN_DENIED");
  });

  it("rejects unsafe production environment settings", () => {
    const result = (() => {
      try {
        parseRuntimeEnv({
          NODE_ENV: "production",
          DATABASE_URL: "postgresql://example",
          CORS_ORIGIN: "*",
          ACCESS_TOKEN_SECRET: "replace-with-at-least-48-random-characters-in-production",
        });
        return null;
      } catch (error) {
        return error;
      }
    })();

    expect(result).toBeTruthy();
  });

  it("accepts explicit HTTPS origins and a strong production secret", () => {
    const parsed = parseRuntimeEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://example",
      CORS_ORIGIN: "https://app.example.com,https://admin.example.com",
      ACCESS_TOKEN_SECRET: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN",
      APP_VERSION: "1.0.0",
      REQUEST_LOGGING: "true",
    });

    expect(parsed.NODE_ENV).toBe("production");
    expect(parsed.REQUEST_LOGGING).toBe(true);
  });
});
