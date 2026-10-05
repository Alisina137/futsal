import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { AuthService } from "../src/modules/auth/auth.service.js";
import { TokenService } from "../src/modules/auth/token.service.js";
import { NotificationService } from "../src/modules/notifications/notification.service.js";
import { TeamService } from "../src/modules/team/team.service.js";
import { FakeAuthRepository } from "./fake-auth-repository.js";
import { FakeNotificationRepository } from "./fake-notification-repository.js";
import { FakeTeamRepository } from "./fake-team-repository.js";

function setup() {
  const authRepository = new FakeAuthRepository();
  const teamRepository = new FakeTeamRepository();
  const notificationRepository = new FakeNotificationRepository();
  const tokens = new TokenService("test-secret-that-is-longer-than-thirty-two-characters", "test", "test-mobile");
  const auth = new AuthService(authRepository, tokens);
  const clock = { now: new Date("2026-10-04T00:00:00.000Z") };
  const notifications = new NotificationService(notificationRepository, () => clock.now);
  const teams = new TeamService(teamRepository, () => clock.now, notifications);
  const app = createApp({
    authService: auth,
    tokenService: tokens,
    notificationService: notifications,
    teamService: teams,
  });
  return { app, teamRepository, notificationRepository, clock };
}

async function register(
  app: ReturnType<typeof createApp>,
  teamRepository: FakeTeamRepository,
  input: { phone: string; username: string; displayName: string },
) {
  const password = "strong-pass-5!";
  const registration = await request(app).post("/api/v1/auth/register").send({
    phone: input.phone,
    username: input.username,
    password,
    confirmPassword: password,
    preferredLanguage: "fa-AF",
  });
  expect(registration.status).toBe(201);

  const activated = await request(app)
    .post("/api/v1/auth/roles/activate")
    .set("Authorization", `Bearer ${registration.body.accessToken}`)
    .send({ role: "PLAYER" });
  expect(activated.status).toBe(200);

  const refreshed = await request(app)
    .post("/api/v1/auth/refresh")
    .send({ refreshToken: registration.body.refreshToken });
  expect(refreshed.status).toBe(200);

  teamRepository.seedUser({
    id: refreshed.body.user.id,
    displayName: input.displayName,
    username: refreshed.body.user.username,
    phoneE164: refreshed.body.user.phone,
    roles: ["PLAYER"],
  });
  return refreshed.body as { accessToken: string; user: { id: string; phone: string } };
}

async function createTeam(app: ReturnType<typeof createApp>, token: string) {
  const response = await request(app).post("/api/v1/teams")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Kabul Five", city: "Kabul", privacy: "PUBLIC" });
  expect(response.status).toBe(201);
  return response.body.team as { id: string };
}

describe("Phase 5 team invitations", () => {
  it("creates one pending invite, notifies the invitee and accepts atomically into the roster", async () => {
    const { app, teamRepository, notificationRepository } = setup();
    const manager = await register(app, teamRepository, {
      phone: "0705560001",
      username: "inv_manager",
      displayName: "Invite Manager",
    });
    const player = await register(app, teamRepository, {
      phone: "0705560002",
      username: "inv_player",
      displayName: "Invite Player",
    });
    const team = await createTeam(app, manager.accessToken);

    const invited = await request(app).post(`/api/v1/teams/${team.id}/invitations`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .send({ identifier: "inv_player", role: "CAPTAIN", shirtNumber: 9 });

    expect(invited.status).toBe(201);
    expect(invited.body.invitation.status).toBe("PENDING");
    expect(notificationRepository.notifications).toHaveLength(1);
    expect(notificationRepository.notifications[0]?.type).toBe("TEAM_INVITATION");

    const duplicate = await request(app).post(`/api/v1/teams/${team.id}/invitations`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .send({ identifier: "inv_player", role: "PLAYER" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("TEAM_INVITATION_PENDING");

    const accepted = await request(app).post(`/api/v1/teams/invitations/${invited.body.invitation.id}/accept`)
      .set("Authorization", `Bearer ${player.accessToken}`);
    expect(accepted.status).toBe(200);
    expect(accepted.body.invitation.status).toBe("ACCEPTED");

    const roster = await request(app).get(`/api/v1/teams/${team.id}/roster`)
      .set("Authorization", `Bearer ${player.accessToken}`);
    expect(roster.status).toBe(200);
    const member = roster.body.team.members.find((item: { userId: string }) => item.userId === player.user.id);
    expect(member.role).toBe("CAPTAIN");
    expect(member.shirtNumber).toBe(9);
    expect(roster.body.team.captainUserId).toBe(player.user.id);
  });

  it("respects team-invite notification preference without blocking the invitation", async () => {
    const { app, teamRepository, notificationRepository } = setup();
    const manager = await register(app, teamRepository, {
      phone: "0705560011",
      username: "q_manager",
      displayName: "Quiet Manager",
    });
    const player = await register(app, teamRepository, {
      phone: "0705560012",
      username: "q_player",
      displayName: "Quiet Player",
    });
    const team = await createTeam(app, manager.accessToken);

    await request(app).patch("/api/v1/notifications/preferences")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .send({ teamInvitesEnabled: false });

    const invited = await request(app).post(`/api/v1/teams/${team.id}/invitations`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .send({ identifier: "q_player", role: "PLAYER" });

    expect(invited.status).toBe(201);
    expect(notificationRepository.notifications).toHaveLength(0);

    const inbox = await request(app).get("/api/v1/teams/invitations")
      .set("Authorization", `Bearer ${player.accessToken}`);
    expect(inbox.status).toBe(200);
    expect(inbox.body.invitations[0].status).toBe("PENDING");
  });

  it("expires old invitations and prevents acceptance after expiry", async () => {
    const { app, teamRepository, clock } = setup();
    const manager = await register(app, teamRepository, {
      phone: "0705560021",
      username: "exp_manager",
      displayName: "Expiry Manager",
    });
    const player = await register(app, teamRepository, {
      phone: "0705560022",
      username: "exp_player",
      displayName: "Expiry Player",
    });
    const team = await createTeam(app, manager.accessToken);

    const invited = await request(app).post(`/api/v1/teams/${team.id}/invitations`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .send({ identifier: "exp_player", role: "PLAYER" });
    expect(invited.status).toBe(201);

    clock.now = new Date("2026-10-12T00:00:01.000Z");

    const accepted = await request(app).post(`/api/v1/teams/invitations/${invited.body.invitation.id}/accept`)
      .set("Authorization", `Bearer ${player.accessToken}`);
    expect(accepted.status).toBe(409);
    expect(accepted.body.error.code).toBe("INVITATION_UNAVAILABLE");

    const inbox = await request(app).get("/api/v1/teams/invitations")
      .set("Authorization", `Bearer ${player.accessToken}`);
    expect(inbox.body.invitations[0].status).toBe("EXPIRED");
  });

  it("revokes old-manager authority immediately after a successful transfer", async () => {
    const { app, teamRepository } = setup();
    const manager = await register(app, teamRepository, {
      phone: "0705560041",
      username: "transfer_manager",
      displayName: "Transfer Manager",
    });
    const player = await register(app, teamRepository, {
      phone: "0705560042",
      username: "transfer_player",
      displayName: "Transfer Player",
    });
    const team = await createTeam(app, manager.accessToken);

    const invited = await request(app).post(`/api/v1/teams/${team.id}/invitations`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .send({ identifier: "transfer_player", role: "PLAYER" });
    await request(app).post(`/api/v1/teams/invitations/${invited.body.invitation.id}/accept`)
      .set("Authorization", `Bearer ${player.accessToken}`);

    const transferred = await request(app).post(`/api/v1/teams/${team.id}/manager`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .send({ userId: player.user.id });
    expect(transferred.status).toBe(200);
    expect(transferred.body.team.managerUserId).toBe(player.user.id);

    const oldManagerEdit = await request(app).patch(`/api/v1/teams/${team.id}`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .send({ name: "Old Manager Cannot Rename" });
    expect(oldManagerEdit.status).toBe(403);
    expect(oldManagerEdit.body.error.code).toBe("TEAM_MANAGER_REQUIRED");

    const newManagerEdit = await request(app).patch(`/api/v1/teams/${team.id}`)
      .set("Authorization", `Bearer ${player.accessToken}`)
      .send({ name: "New Manager Team" });
    expect(newManagerEdit.status).toBe(200);
    expect(newManagerEdit.body.team.name).toBe("New Manager Team");
  });

  it("allows only the current manager to revoke a pending invitation", async () => {
    const { app, teamRepository } = setup();
    const manager = await register(app, teamRepository, {
      phone: "0705560031",
      username: "revoke_manager",
      displayName: "Revoke Manager",
    });
    const outsider = await register(app, teamRepository, {
      phone: "0705560032",
      username: "revoke_outsider",
      displayName: "Revoke Outsider",
    });
    const player = await register(app, teamRepository, {
      phone: "0705560033",
      username: "revoke_player",
      displayName: "Revoke Player",
    });
    const team = await createTeam(app, manager.accessToken);

    const invited = await request(app).post(`/api/v1/teams/${team.id}/invitations`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .send({ identifier: "revoke_player", role: "PLAYER" });

    const forbidden = await request(app).delete(`/api/v1/teams/${team.id}/invitations/${invited.body.invitation.id}`)
      .set("Authorization", `Bearer ${outsider.accessToken}`);
    expect(forbidden.status).toBe(403);

    const revoked = await request(app).delete(`/api/v1/teams/${team.id}/invitations/${invited.body.invitation.id}`)
      .set("Authorization", `Bearer ${manager.accessToken}`);
    expect(revoked.status).toBe(200);
    expect(revoked.body.invitation.status).toBe("REVOKED");

    const accept = await request(app).post(`/api/v1/teams/invitations/${invited.body.invitation.id}/accept`)
      .set("Authorization", `Bearer ${player.accessToken}`);
    expect(accept.status).toBe(409);
  });
});
