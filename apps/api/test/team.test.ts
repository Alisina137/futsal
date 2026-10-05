import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { AuthService } from "../src/modules/auth/auth.service.js";
import { TokenService } from "../src/modules/auth/token.service.js";
import { TeamService } from "../src/modules/team/team.service.js";
import { FakeAuthRepository } from "./fake-auth-repository.js";
import { FakeTeamRepository } from "./fake-team-repository.js";

function setup() {
  const authRepository = new FakeAuthRepository();
  const teamRepository = new FakeTeamRepository();
  const tokens = new TokenService("test-secret-that-is-longer-than-thirty-two-characters", "test", "test-mobile");
  const auth = new AuthService(authRepository, tokens);
  const teams = new TeamService(teamRepository, () => new Date("2026-10-04T00:00:00.000Z"));
  const app = createApp({ authService: auth, tokenService: tokens, teamService: teams });
  return { app, teamRepository };
}

async function register(
  app: ReturnType<typeof createApp>,
  teamRepository: FakeTeamRepository,
  input: { phone: string; username: string; displayName: string; accountType?: "PLAYER" | "VENUE_OWNER" },
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

  const role = input.accountType === "VENUE_OWNER" ? "VENUE_OWNER" : "PLAYER";
  const activated = await request(app)
    .post("/api/v1/auth/roles/activate")
    .set("Authorization", `Bearer ${registration.body.accessToken}`)
    .send({ role });
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
    roles: role === "VENUE_OWNER" ? ["VENUE_OWNER"] : ["PLAYER"],
  });
  return refreshed.body as { accessToken: string; user: { id: string; phone: string } };
}

describe("Phase 5 teams and player identity API", () => {
  it("creates a team with creator as manager and never exposes private contact data publicly", async () => {
    const { app, teamRepository } = setup();
    const manager = await register(app, teamRepository, {
      phone: "0705550001",
      username: "manager1",
      displayName: "Team Manager",
    });

    const created = await request(app).post("/api/v1/teams")
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .send({ name: "Kabul Stars", city: "Kabul", logoUrl: "", privacy: "PUBLIC" });

    expect(created.status).toBe(201);
    expect(created.body.team.managerUserId).toBe(manager.user.id);
    expect(created.body.team.members).toHaveLength(1);
    expect(created.body.team.members[0].role).toBe("MANAGER");

    const publicTeam = await request(app).get(`/api/v1/teams/${created.body.team.id}`);
    expect(publicTeam.status).toBe(200);
    expect(JSON.stringify(publicTeam.body)).not.toContain(manager.user.phone);
    expect(publicTeam.body.team.members[0]).not.toHaveProperty("phone");
    expect(publicTeam.body.team.members[0]).not.toHaveProperty("email");

    const publicPlayer = await request(app).get(`/api/v1/players/${manager.user.id}`);
    expect(publicPlayer.status).toBe(200);
    expect(publicPlayer.body.player).not.toHaveProperty("phone");
    expect(publicPlayer.body.player).not.toHaveProperty("email");
  });

  it("allows one player to belong to multiple teams without duplicating membership inside a team", async () => {
    const { app, teamRepository } = setup();
    const firstManager = await register(app, teamRepository, {
      phone: "0705550010",
      username: "manager10",
      displayName: "Manager Ten",
    });
    const secondManager = await register(app, teamRepository, {
      phone: "0705550011",
      username: "manager11",
      displayName: "Manager Eleven",
    });
    const player = await register(app, teamRepository, {
      phone: "0705550012",
      username: "multiplayer",
      displayName: "Multi Team Player",
    });

    const firstTeam = await request(app).post("/api/v1/teams")
      .set("Authorization", `Bearer ${firstManager.accessToken}`)
      .send({ name: "First Five", city: "Kabul", privacy: "PUBLIC" });
    const secondTeam = await request(app).post("/api/v1/teams")
      .set("Authorization", `Bearer ${secondManager.accessToken}`)
      .send({ name: "Second Five", city: "Kabul", privacy: "PUBLIC" });

    for (const [teamId, managerToken] of [
      [firstTeam.body.team.id, firstManager.accessToken],
      [secondTeam.body.team.id, secondManager.accessToken],
    ] as const) {
      const invited = await request(app).post(`/api/v1/teams/${teamId}/invitations`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ identifier: "multiplayer", role: "PLAYER" });
      expect(invited.status).toBe(201);

      const accepted = await request(app).post(`/api/v1/teams/invitations/${invited.body.invitation.id}/accept`)
        .set("Authorization", `Bearer ${player.accessToken}`);
      expect(accepted.status).toBe(200);
    }

    const mine = await request(app).get("/api/v1/teams/mine")
      .set("Authorization", `Bearer ${player.accessToken}`);
    expect(mine.status).toBe(200);
    expect(mine.body.teams).toHaveLength(2);
    expect(new Set(mine.body.teams.map((team: { id: string }) => team.id)).size).toBe(2);
  });

  it("rejects venue-owner-only accounts from player/team participation", async () => {
    const { app, teamRepository } = setup();
    const owner = await register(app, teamRepository, {
      phone: "0705550013",
      username: "venueowneronly",
      displayName: "Venue Owner Only",
      accountType: "VENUE_OWNER",
    });

    const profile = await request(app).get("/api/v1/players/me")
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(profile.status).toBe(403);
    expect(profile.body.error.code).toBe("PLAYER_ACCOUNT_REQUIRED");

    const create = await request(app).post("/api/v1/teams")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Owner Team", city: "Kabul", privacy: "PUBLIC" });
    expect(create.status).toBe(403);
    expect(create.body.error.code).toBe("PLAYER_ACCOUNT_REQUIRED");

    const publicProfile = await request(app).get(`/api/v1/players/${owner.user.id}`);
    expect(publicProfile.status).toBe(400);
    expect(publicProfile.body.error.code).toBe("PLAYER_PROFILE_NOT_PUBLIC");
  });

  it("does not allow a manager to invite a venue-owner-only account as a player", async () => {
    const { app, teamRepository } = setup();
    const manager = await register(app, teamRepository, {
      phone: "0705550014",
      username: "player_manager14",
      displayName: "Player Manager",
    });
    await register(app, teamRepository, {
      phone: "0705550015",
      username: "owner_target15",
      displayName: "Owner Target",
      accountType: "VENUE_OWNER",
    });

    const created = await request(app).post("/api/v1/teams")
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .send({ name: "Player Only Five", city: "Kabul", privacy: "PUBLIC" });
    expect(created.status).toBe(201);

    const invited = await request(app).post(`/api/v1/teams/${created.body.team.id}/invitations`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .send({ identifier: "owner_target15", role: "PLAYER" });

    expect(invited.status).toBe(400);
    expect(invited.body.error.code).toBe("INVITEE_NOT_FOUND");
  });

  it("blocks a non-manager from mutating another team's roster or identity", async () => {
    const { app, teamRepository } = setup();
    const manager = await register(app, teamRepository, {
      phone: "0705550002",
      username: "manager2",
      displayName: "Manager Two",
    });
    const outsider = await register(app, teamRepository, {
      phone: "0705550003",
      username: "outsider",
      displayName: "Outsider",
    });

    const created = await request(app).post("/api/v1/teams")
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .send({ name: "Blue Five", city: "Kabul", privacy: "PUBLIC" });
    const teamId = created.body.team.id;

    const edit = await request(app).patch(`/api/v1/teams/${teamId}`)
      .set("Authorization", `Bearer ${outsider.accessToken}`)
      .send({ name: "Hijacked Team" });

    expect(edit.status).toBe(403);
    expect(edit.body.error.code).toBe("TEAM_MANAGER_REQUIRED");

    const remove = await request(app).delete(`/api/v1/teams/${teamId}/members/${manager.user.id}`)
      .set("Authorization", `Bearer ${outsider.accessToken}`);

    expect(remove.status).toBe(403);
    expect(remove.body.error.code).toBe("TEAM_MANAGER_REQUIRED");
  });

  it("hides private team rosters publicly but keeps them available to active members", async () => {
    const { app, teamRepository } = setup();
    const manager = await register(app, teamRepository, {
      phone: "0705550004",
      username: "manager4",
      displayName: "Private Manager",
    });

    const created = await request(app).post("/api/v1/teams")
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .send({ name: "Private Five", city: "Herat", privacy: "PRIVATE" });
    const teamId = created.body.team.id;

    const publicTeam = await request(app).get(`/api/v1/teams/${teamId}`);
    expect(publicTeam.status).toBe(200);
    expect(publicTeam.body.team.rosterCount).toBe(1);
    expect(publicTeam.body.team.members).toEqual([]);

    const memberRoster = await request(app).get(`/api/v1/teams/${teamId}/roster`)
      .set("Authorization", `Bearer ${manager.accessToken}`);
    expect(memberRoster.status).toBe(200);
    expect(memberRoster.body.team.members).toHaveLength(1);
  });

  it("honors player-profile privacy independently of authentication contact fields", async () => {
    const { app, teamRepository } = setup();
    const player = await register(app, teamRepository, {
      phone: "0705550005",
      username: "privateplayer",
      displayName: "Private Player",
    });

    const update = await request(app).patch("/api/v1/players/me")
      .set("Authorization", `Bearer ${player.accessToken}`)
      .send({
        publicDisplayName: "P. Player",
        position: "GOALKEEPER",
        visibility: "PRIVATE",
      });
    expect(update.status).toBe(200);
    expect(update.body.player.visibility).toBe("PRIVATE");

    const publicProfile = await request(app).get(`/api/v1/players/${player.user.id}`);
    expect(publicProfile.status).toBe(400);
    expect(publicProfile.body.error.code).toBe("PLAYER_PROFILE_NOT_PUBLIC");

    const ownProfile = await request(app).get("/api/v1/players/me")
      .set("Authorization", `Bearer ${player.accessToken}`);
    expect(ownProfile.status).toBe(200);
    expect(ownProfile.body.player.publicDisplayName).toBe("P. Player");
    expect(JSON.stringify(ownProfile.body.player)).not.toContain(player.user.phone);
  });

  it("requires captain and transferred manager to be active roster members", async () => {
    const { app, teamRepository } = setup();
    const manager = await register(app, teamRepository, {
      phone: "0705550006",
      username: "manager6",
      displayName: "Manager Six",
    });
    const other = await register(app, teamRepository, {
      phone: "0705550007",
      username: "other6",
      displayName: "Other Six",
    });

    const created = await request(app).post("/api/v1/teams")
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .send({ name: "Roster Rules", city: "Kabul", privacy: "PUBLIC" });
    const teamId = created.body.team.id;

    const captain = await request(app).post(`/api/v1/teams/${teamId}/captain`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .send({ userId: other.user.id });
    expect(captain.status).toBe(400);
    expect(captain.body.error.code).toBe("CAPTAIN_MUST_BE_MEMBER");

    const transfer = await request(app).post(`/api/v1/teams/${teamId}/manager`)
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .send({ userId: other.user.id });
    expect(transfer.status).toBe(400);
    expect(transfer.body.error.code).toBe("MANAGER_MUST_BE_MEMBER");
  });
});
