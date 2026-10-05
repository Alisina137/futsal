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

const baseRegistration = {
  username: "ahmad7",
  phone: "0791234567",
  password: "strong-pass-1!",
  confirmPassword: "strong-pass-1!",
  preferredLanguage: "fa-AF",
};

describe("Authentication identity and role model", () => {
  it("registers a base user without assigning a product role", async () => {
    const { app } = setup();
    const registration = await request(app).post("/api/v1/auth/register").send(baseRegistration);

    expect(registration.status).toBe(201);
    expect(registration.body.user.username).toBe("ahmad7");
    expect(registration.body.user.displayName).toBe("ahmad7");
    expect(registration.body.user.phone).toBe("+93791234567");
    expect(registration.body.user.roles).toEqual([]);

    const denied = await request(app).get("/api/v1/users/me");
    expect(denied.status).toBe(401);

    const me = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${registration.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user.roles).toEqual([]);
  });

  it("allows the full name to be configured after signup without changing credentials", async () => {
    const { app } = setup();
    const registration = await request(app).post("/api/v1/auth/register").send(baseRegistration);

    const updated = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${registration.body.accessToken}`)
      .send({ displayName: "Ahmad Rahimi" });

    expect(updated.status).toBe(200);
    expect(updated.body.user.displayName).toBe("Ahmad Rahimi");
    expect(updated.body.user.username).toBe("ahmad7");
    expect(updated.body.user.phone).toBe("+93791234567");

    const login = await request(app).post("/api/v1/auth/login").send({
      identifier: "ahmad7",
      password: baseRegistration.password,
    });
    expect(login.status).toBe(200);
    expect(login.body.user.displayName).toBe("Ahmad Rahimi");
  });

  it("requires matching password confirmation at registration", async () => {
    const { app } = setup();
    const response = await request(app).post("/api/v1/auth/register").send({
      ...baseRegistration,
      confirmPassword: "different-pass!",
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("logs in with either username or Afghanistan phone number", async () => {
    const { app } = setup();
    await request(app).post("/api/v1/auth/register").send(baseRegistration);

    const byUsername = await request(app).post("/api/v1/auth/login").send({
      identifier: "AHMAD7",
      password: baseRegistration.password,
    });
    expect(byUsername.status).toBe(200);
    expect(byUsername.body.user.username).toBe("ahmad7");

    const byPhone = await request(app).post("/api/v1/auth/login").send({
      identifier: "0791234567",
      password: baseRegistration.password,
    });
    expect(byPhone.status).toBe(200);
    expect(byPhone.body.user.id).toBe(byUsername.body.user.id);
  });

  it("activates safe roles after signup and keeps team-manager authority additive", async () => {
    const { app } = setup();
    const registration = await request(app).post("/api/v1/auth/register").send(baseRegistration);
    const accessToken = registration.body.accessToken;

    const player = await request(app)
      .post("/api/v1/auth/roles/activate")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ role: "PLAYER" });
    expect(player.status).toBe(200);
    expect(player.body.user.roles).toEqual(["PLAYER"]);

    const manager = await request(app)
      .post("/api/v1/auth/roles/activate")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ role: "TEAM_MANAGER" });
    expect(manager.status).toBe(200);
    expect(new Set(manager.body.user.roles)).toEqual(new Set(["PLAYER", "TEAM_MANAGER"]));

    const repeat = await request(app)
      .post("/api/v1/auth/roles/activate")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ role: "TEAM_MANAGER" });
    expect(repeat.status).toBe(200);
    expect(repeat.body.user.roles.filter((role: string) => role === "TEAM_MANAGER")).toHaveLength(1);
  });

  it("does not allow privileged roles to be self-assigned", async () => {
    const { app } = setup();
    const registration = await request(app).post("/api/v1/auth/register").send(baseRegistration);

    const response = await request(app)
      .post("/api/v1/auth/roles/activate")
      .set("Authorization", `Bearer ${registration.body.accessToken}`)
      .send({ role: "PLATFORM_ADMIN" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rotates refresh tokens and rejects the previous token", async () => {
    const { app } = setup();
    const registration = await request(app).post("/api/v1/auth/register").send({
      username: "zahra",
      phone: "+93700111222",
      password: "strong-pass-2!",
      confirmPassword: "strong-pass-2!",
      preferredLanguage: "ps-AF",
    });

    const oldToken = registration.body.refreshToken;
    const refreshed = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: oldToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.refreshToken).not.toBe(oldToken);

    const replay = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: oldToken });
    expect(replay.status).toBe(401);
  });

  it("does not allow duplicate phone or username registration", async () => {
    const { app } = setup();
    expect((await request(app).post("/api/v1/auth/register").send(baseRegistration)).status).toBe(201);

    const duplicatePhone = await request(app).post("/api/v1/auth/register").send({
      ...baseRegistration,
      username: "another_user",
    });
    expect(duplicatePhone.status).toBe(409);
    expect(duplicatePhone.body.error.code).toBe("IDENTITY_ALREADY_EXISTS");

    const duplicateUsername = await request(app).post("/api/v1/auth/register").send({
      ...baseRegistration,
      phone: "0791234568",
    });
    expect(duplicateUsername.status).toBe(409);
    expect(duplicateUsername.body.error.code).toBe("IDENTITY_ALREADY_EXISTS");
  });
});
