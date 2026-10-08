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
  it("allows normal accounts to upload an avatar and only serves the current token",async()=>{
    const {app}=setup();
    const registered=await request(app).post("/api/v1/auth/register").send(baseRegistration);
    const auth=`Bearer ${registered.body.accessToken}`;
    const png=Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000","hex");

    expect((await request(app).post("/api/v1/users/me/avatar").set("Content-Type","image/png").send(png)).status).toBe(401);
    const first=await request(app).post("/api/v1/users/me/avatar").set("Authorization",auth).set("Content-Type","image/png").send(png);
    expect(first.status).toBe(201);
    const url=first.body.user.profileImageUrl as string;
    expect(url).toMatch(/^\/api\/v1\/users\/avatars\/[\da-f-]{36}\/[A-Za-z0-9_-]{32}$/);
    const served=await request(app).get(url);
    expect(served.status).toBe(200);
    expect(served.headers["content-type"]).toContain("image/png");
    expect(served.body).toEqual(png);

    const forged=await request(app).post("/api/v1/users/me/avatar").set("Authorization",auth).set("Content-Type","image/png").send(Buffer.from("fake"));
    expect(forged.status).toBe(400);
    expect(forged.body.error.code).toBe("MEDIA_INVALID_IMAGE");

    const second=await request(app).post("/api/v1/users/me/avatar").set("Authorization",auth).set("Content-Type","image/png").send(png);
    expect(second.status).toBe(201);
    expect(second.body.user.profileImageUrl).not.toBe(url);
    expect((await request(app).get(url)).status).toBe(400);
    expect((await request(app).get(second.body.user.profileImageUrl)).status).toBe(200);

    const profile=await request(app).patch("/api/v1/users/me").set("Authorization",auth).send({displayName:"A. User"});
    expect(profile.status).toBe(200);
    expect(profile.body.user.profileImageUrl).toBe(second.body.user.profileImageUrl);
  });

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

  it("keeps management roles payment-gated and admin-activated", async () => {
    const { app, repository } = setup();
    const registration = await request(app).post("/api/v1/auth/register").send(baseRegistration);
    const accessToken = registration.body.accessToken;

    const offers = await request(app)
      .get("/api/v1/auth/role-subscriptions")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(offers.status).toBe(200);
    expect(offers.body.offers).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: "VENUE_OWNER", monthlyPriceAfn: 1000, status: "NONE" }),
      expect.objectContaining({ role: "TEAM_MANAGER", monthlyPriceAfn: 300, status: "NONE" }),
    ]));

    const pending = await request(app)
      .post("/api/v1/auth/role-subscriptions/TEAM_MANAGER/request")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ paymentReference: "receipt-team-1" });
    expect(pending.status).toBe(202);
    expect(pending.body.offer.status).toBe("PENDING");

    const beforeApproval = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(beforeApproval.body.user.roles).toEqual([]);

    const adminRegistration = await request(app).post("/api/v1/auth/register").send({
      ...baseRegistration,
      username: "admin01",
      phone: "0791234599",
    });
    await repository.addRoles(adminRegistration.body.user.id, ["PLATFORM_ADMIN"]);
    const adminSession = await request(app).post("/api/v1/auth/refresh").send({
      refreshToken: adminRegistration.body.refreshToken,
    });
    expect(adminSession.status).toBe(200);
    expect(adminSession.body.user.roles).toContain("PLATFORM_ADMIN");

    const activated = await request(app)
      .post(`/api/v1/admin/role-subscriptions/${registration.body.user.id}/TEAM_MANAGER/activate`)
      .set("Authorization", `Bearer ${adminSession.body.accessToken}`)
      .send({ months: 1, paymentReference: "receipt-team-1" });
    expect(activated.status).toBe(200);
    expect(activated.body.user.roles).toContain("TEAM_MANAGER");

    const refreshed = await request(app).post("/api/v1/auth/refresh").send({
      refreshToken: registration.body.refreshToken,
    });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.user.roles).toContain("TEAM_MANAGER");
  });

  it("removes free role self-activation and protects paid activation with platform-admin authority", async () => {
    const { app } = setup();
    const registration = await request(app).post("/api/v1/auth/register").send(baseRegistration);

    const removedEndpoint = await request(app)
      .post("/api/v1/auth/roles/activate")
      .set("Authorization", `Bearer ${registration.body.accessToken}`)
      .send({ role: "TEAM_MANAGER" });
    expect(removedEndpoint.status).toBe(404);

    const denied = await request(app)
      .post(`/api/v1/admin/role-subscriptions/${registration.body.user.id}/TEAM_MANAGER/activate`)
      .set("Authorization", `Bearer ${registration.body.accessToken}`)
      .send({ months: 1 });
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("ROLE_REQUIRED");
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
