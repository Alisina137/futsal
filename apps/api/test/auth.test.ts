import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { AuthService } from "../src/modules/auth/auth.service.js";
import { TokenService } from "../src/modules/auth/token.service.js";
import { FakeAuthRepository } from "./fake-auth-repository.js";

function setup() {
  const repository = new FakeAuthRepository();
  const tokens = new TokenService("test-secret-that-is-longer-than-thirty-two-characters", "test", "test-mobile");
  const auth = new AuthService(repository, tokens);
  return { app: createApp({ authService: auth, tokenService: tokens }), repository };
}

describe("Phase 1 authentication API", () => {
  it("registers a player and protects /users/me", async () => {
    const { app } = setup();
    const registration = await request(app).post("/api/v1/auth/register").send({
      displayName: "Ahmad Rahimi", phone: "0791234567", username: "ahmad7", password: "strong-pass-1",
      preferredLanguage: "fa-AF", accountType: "PLAYER",
    });
    expect(registration.status).toBe(201);
    expect(registration.body.user.roles).toEqual(["PLAYER"]);

    const denied = await request(app).get("/api/v1/users/me");
    expect(denied.status).toBe(401);

    const me = await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${registration.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user.phone).toBe("+93791234567");
  });

  it("rotates refresh tokens and rejects the previous token", async () => {
    const { app } = setup();
    const registration = await request(app).post("/api/v1/auth/register").send({
      displayName: "Zahra", phone: "+93700111222", password: "strong-pass-2",
      preferredLanguage: "ps-AF", accountType: "VENUE_OWNER",
    });
    const oldToken = registration.body.refreshToken;
    const refreshed = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: oldToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.refreshToken).not.toBe(oldToken);
    const replay = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: oldToken });
    expect(replay.status).toBe(401);
  });

  it("does not allow duplicate phone registration", async () => {
    const { app } = setup();
    const body = { displayName: "User One", phone: "0701112222", password: "strong-pass-3", preferredLanguage: "en", accountType: "PLAYER" };
    expect((await request(app).post("/api/v1/auth/register").send(body)).status).toBe(201);
    const duplicate = await request(app).post("/api/v1/auth/register").send({ ...body, displayName: "User Two" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("IDENTITY_ALREADY_EXISTS");
  });
});
