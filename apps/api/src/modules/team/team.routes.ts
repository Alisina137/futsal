import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import {
  playerProfileUpdateRequestSchema,
  teamCaptainRequestSchema,
  teamCreateRequestSchema,
  teamManagerTransferRequestSchema,
  teamMemberUpdateRequestSchema,
  teamUpdateRequestSchema,
} from "@leaguekick/contracts";
import { requireAuth } from "../../middleware/auth.js";
import type { TokenService } from "../auth/token.service.js";
import type { TeamService } from "./team.service.js";

const routeIdSchema = z.string().uuid();

export function createPublicTeamRouter(teams: TeamService) {
  const router = Router();
  router.use(rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: "draft-8", legacyHeaders: false }));

  router.get("/teams/:teamId", async (request, response, next) => {
    try {
      const teamId = routeIdSchema.parse(request.params.teamId);
      response.json({ team: await teams.getPublicTeam(teamId) });
    } catch (error) { next(error); }
  });

  router.get("/players/:playerId", async (request, response, next) => {
    try {
      const playerId = routeIdSchema.parse(request.params.playerId);
      response.json({ player: await teams.getPublicPlayer(playerId) });
    } catch (error) { next(error); }
  });

  return router;
}

export function createAuthenticatedTeamRouter(teams: TeamService, tokens: TokenService) {
  const router = Router();
  const auth = requireAuth(tokens);

  const writeLimiter = rateLimit({
    windowMs: 60_000,
    limit: 40,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });

  router.get("/players/me", auth, async (request, response, next) => {
    try { response.json({ player: await teams.getOwnProfile(request.auth!.userId) }); }
    catch (error) { next(error); }
  });

  router.patch("/players/me", auth, writeLimiter, async (request, response, next) => {
    try {
      const input = playerProfileUpdateRequestSchema.parse(request.body);
      response.json({ player: await teams.updateOwnProfile(request.auth!.userId, input) });
    } catch (error) { next(error); }
  });

  router.get("/teams/mine", auth, async (request, response, next) => {
    try { response.json(await teams.listMyTeams(request.auth!.userId)); }
    catch (error) { next(error); }
  });

  router.post("/teams", auth, writeLimiter, async (request, response, next) => {
    try {
      const input = teamCreateRequestSchema.parse(request.body);
      response.status(201).json({ team: await teams.createTeam(request.auth!.userId, input) });
    } catch (error) { next(error); }
  });

  router.get("/teams/:teamId/roster", auth, async (request, response, next) => {
    try {
      const teamId = routeIdSchema.parse(request.params.teamId);
      response.json({ team: await teams.getRoster(request.auth!.userId, teamId) });
    } catch (error) { next(error); }
  });

  router.patch("/teams/:teamId", auth, writeLimiter, async (request, response, next) => {
    try {
      const teamId = routeIdSchema.parse(request.params.teamId);
      const input = teamUpdateRequestSchema.parse(request.body);
      response.json({ team: await teams.updateTeam(request.auth!.userId, teamId, input) });
    } catch (error) { next(error); }
  });

  router.patch("/teams/:teamId/members/:userId", auth, writeLimiter, async (request, response, next) => {
    try {
      const teamId = routeIdSchema.parse(request.params.teamId);
      const memberUserId = routeIdSchema.parse(request.params.userId);
      const input = teamMemberUpdateRequestSchema.parse(request.body);
      response.json({ team: await teams.updateMember(request.auth!.userId, teamId, memberUserId, input) });
    } catch (error) { next(error); }
  });

  router.delete("/teams/:teamId/members/:userId", auth, writeLimiter, async (request, response, next) => {
    try {
      const teamId = routeIdSchema.parse(request.params.teamId);
      const memberUserId = routeIdSchema.parse(request.params.userId);
      response.json({ team: await teams.removeMember(request.auth!.userId, teamId, memberUserId) });
    } catch (error) { next(error); }
  });

  router.post("/teams/:teamId/captain", auth, writeLimiter, async (request, response, next) => {
    try {
      const teamId = routeIdSchema.parse(request.params.teamId);
      const input = teamCaptainRequestSchema.parse(request.body);
      response.json({ team: await teams.setCaptain(request.auth!.userId, teamId, input) });
    } catch (error) { next(error); }
  });

  router.post("/teams/:teamId/manager", auth, writeLimiter, async (request, response, next) => {
    try {
      const teamId = routeIdSchema.parse(request.params.teamId);
      const input = teamManagerTransferRequestSchema.parse(request.body);
      response.json({ team: await teams.transferManager(request.auth!.userId, teamId, input) });
    } catch (error) { next(error); }
  });

  return router;
}
