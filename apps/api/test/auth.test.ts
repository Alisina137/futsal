import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { AuthService } from "../src/modules/auth/auth.service.js";
import { TokenService } from "../src/modules/auth/token.service.js";
import { FakeAuthRepository } from "./fake-auth-repository.js";

function setup() {
  const repository = new FakeAuthRepository();
  const tokens = new TokenService("test-secret-that-is-longer-than-thirty-two-characters", "test", "test-mobile");
  const deliveredCodes = new Map<string, string>();
  const auth = new AuthService(repository, tokens, {
    passwordResetSecret: "test-password-reset-secret-that-is-longer-than-thirty-two-characters",
    exposePasswordResetCode: true,
    deliverPasswordResetCode: async (phone, code) => {
      deliveredCodes.set(phone, code);
    },
  });
  return {
    app: createApp({ authService: auth, tokenService: tokens }),
    repository,
    deliveredCodes,
  };
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
      .send({
        displayName: "Ahmad Rahimi",
        profileImageUrl: "https://example.com/ahmad.jpg",
        age: 26,
        email: "Ahmad@example.com",
        city: "Kabul",
        bio: "Futsal fan and weekend player.",
      });

    expect(updated.status).toBe(200);
    expect(updated.body.user.displayName).toBe("Ahmad Rahimi");
    expect(updated.body.user.username).toBe("ahmad7");
    expect(updated.body.user.phone).toBe("+93791234567");
    expect(updated.body.user.profileImageUrl).toBe("https://example.com/ahmad.jpg");
    expect(updated.body.user.age).toBe(26);
    expect(updated.body.user.email).toBe("ahmad@example.com");
    expect(updated.body.user.city).toBe("Kabul");
    expect(updated.body.user.bio).toBe("Futsal fan and weekend player.");

    const login = await request(app).post("/api/v1/auth/login").send({
      identifier: "ahmad7",
      password: baseRegistration.password,
    });
    expect(login.status).toBe(200);
    expect(login.body.user.displayName).toBe("Ahmad Rahimi");
    expect(login.body.user.email).toBe("ahmad@example.com");
    expect(login.body.user.age).toBe(26);
  });

  it("keeps optional account profile email unique", async () => {
    const { app } = setup();
    const first = await request(app).post("/api/v1/auth/register").send(baseRegistration);
    const second = await request(app).post("/api/v1/auth/register").send({
      ...baseRegistration,
      username: "zahra2",
      phone: "0791234568",
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const firstProfile = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${first.body.accessToken}`)
      .send({ displayName: "", email: "shared@example.com" });
    expect(firstProfile.status).toBe(200);

    const duplicate = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${second.body.accessToken}`)
      .send({ displayName: "", email: "SHARED@example.com" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
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
      username: "another_usr",
    });
    expect(duplicatePhone.status).toBe(409);
    expect(duplicatePhone.body.error.code).toBe("PHONE_ALREADY_EXISTS");

    const duplicateUsername = await request(app).post("/api/v1/auth/register").send({
      ...baseRegistration,
      phone: "0791234568",
    });
    expect(duplicateUsername.status).toBe(409);
    expect(duplicateUsername.body.error.code).toBe("USERNAME_ALREADY_EXISTS");
  });

  it("resets credentials only after phone verification and revokes previous sessions", async () => {
    const { app } = setup();
    const registration = await request(app).post("/api/v1/auth/register").send(baseRegistration);
    expect(registration.status).toBe(201);

    const resetRequest = await request(app)
      .post("/api/v1/auth/password-reset/request")
      .send({ phone: baseRegistration.phone });
    expect(resetRequest.status).toBe(200);
    expect(resetRequest.body.requestId).toBeTypeOf("string");
    expect(resetRequest.body.debugCode).toMatch(/^\d{6}$/);

    const wrongCode = await request(app)
      .post("/api/v1/auth/password-reset/verify")
      .send({ requestId: resetRequest.body.requestId, code: "000000" });
    expect(wrongCode.status).toBe(400);
    expect(wrongCode.body.error.code).toBe("INVALID_RESET_CODE");

    const verified = await request(app)
      .post("/api/v1/auth/password-reset/verify")
      .send({ requestId: resetRequest.body.requestId, code: resetRequest.body.debugCode });
    expect(verified.status).toBe(200);
    expect(verified.body.username).toBe("ahmad7");
    expect(verified.body.phone).toBe("+93791234567");
    expect(verified.body.resetToken).toBeTypeOf("string");

    const parallelRequest = await request(app)
      .post("/api/v1/auth/password-reset/request")
      .send({ phone: baseRegistration.phone });
    expect(parallelRequest.status).toBe(200);

    const parallelVerified = await request(app)
      .post("/api/v1/auth/password-reset/verify")
      .send({ requestId: parallelRequest.body.requestId, code: parallelRequest.body.debugCode });
    expect(parallelVerified.status).toBe(200);

    const completed = await request(app)
      .post("/api/v1/auth/password-reset/complete")
      .send({
        requestId: verified.body.requestId,
        resetToken: verified.body.resetToken,
        username: "ahmadnew",
        password: "Newpass1!",
        confirmPassword: "Newpass1!",
      });
    expect(completed.status).toBe(204);

    const parallelComplete = await request(app)
      .post("/api/v1/auth/password-reset/complete")
      .send({
        requestId: parallelVerified.body.requestId,
        resetToken: parallelVerified.body.resetToken,
        username: "ahmadnew2",
        password: "Otherpass1!",
        confirmPassword: "Otherpass1!",
      });
    expect(parallelComplete.status).toBe(409);
    expect(parallelComplete.body.error.code).toBe("PASSWORD_RESET_COOLDOWN");
    expect(parallelComplete.body.error.details.availableAt).toBeTypeOf("string");

    const oldCredentials = await request(app).post("/api/v1/auth/login").send({
      identifier: "ahmad7",
      password: baseRegistration.password,
    });
    expect(oldCredentials.status).toBe(401);

    const newCredentials = await request(app).post("/api/v1/auth/login").send({
      identifier: "ahmadnew",
      password: "Newpass1!",
    });
    expect(newCredentials.status).toBe(200);
    expect(newCredentials.body.user.username).toBe("ahmadnew");
    expect(newCredentials.body.user.phone).toBe("+93791234567");

    const oldSession = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: registration.body.refreshToken });
    expect(oldSession.status).toBe(401);
  });

  it("blocks a new verified recovery for 72 hours after a successful credential reset", async () => {
    const { app } = setup();
    const registration = await request(app).post("/api/v1/auth/register").send(baseRegistration);
    expect(registration.status).toBe(201);

    const firstRequest = await request(app)
      .post("/api/v1/auth/password-reset/request")
      .send({ phone: baseRegistration.phone });
    const firstVerified = await request(app)
      .post("/api/v1/auth/password-reset/verify")
      .send({ requestId: firstRequest.body.requestId, code: firstRequest.body.debugCode });
    expect(firstVerified.status).toBe(200);

    const firstComplete = await request(app)
      .post("/api/v1/auth/password-reset/complete")
      .send({
        requestId: firstVerified.body.requestId,
        resetToken: firstVerified.body.resetToken,
        username: "ahmadnew",
        password: "Newpass1!",
        confirmPassword: "Newpass1!",
      });
    expect(firstComplete.status).toBe(204);

    const secondRequest = await request(app)
      .post("/api/v1/auth/password-reset/request")
      .send({ phone: baseRegistration.phone });
    expect(secondRequest.status).toBe(200);

    const secondVerify = await request(app)
      .post("/api/v1/auth/password-reset/verify")
      .send({ requestId: secondRequest.body.requestId, code: secondRequest.body.debugCode });
    expect(secondVerify.status).toBe(409);
    expect(secondVerify.body.error.code).toBe("PASSWORD_RESET_COOLDOWN");
    expect(secondVerify.body.error.details.availableAt).toBeTypeOf("string");

    const availableAtMs = Date.parse(secondVerify.body.error.details.availableAt);
    expect(availableAtMs).toBeGreaterThan(Date.now() + 71 * 60 * 60 * 1000);
    expect(availableAtMs).toBeLessThanOrEqual(Date.now() + 72 * 60 * 60 * 1000 + 5_000);
  });

  it("does not reveal account existence before phone verification", async () => {
    const { app } = setup();
    const response = await request(app)
      .post("/api/v1/auth/password-reset/request")
      .send({ phone: "0799999999" });

    expect(response.status).toBe(200);
    expect(response.body.requestId).toBeTypeOf("string");
    expect(response.body.debugCode).toMatch(/^\d{6}$/);

    const verify = await request(app)
      .post("/api/v1/auth/password-reset/verify")
      .send({ requestId: response.body.requestId, code: response.body.debugCode });
    expect(verify.status).toBe(400);
    expect(verify.body.error.code).toBe("INVALID_RESET_CODE");
  });
});
