import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import {
  competitionCreateRequestSchema,
  competitionFeeUpdateRequestSchema,
  competitionInviteTeamRequestSchema,
  competitionMediaPostCreateRequestSchema,
  competitionMediaPostStatusRequestSchema,
  competitionMatchResultRequestSchema,
  competitionMatchScheduleRequestSchema,
  competitionRegistrationDecisionRequestSchema,
  competitionRegistrationResponseRequestSchema,
  competitionStateRequestSchema,
  competitionTeamRegisterRequestSchema,
  competitionUpdateRequestSchema,
} from "@leaguekick/contracts";
import { requireAuth } from "../../middleware/auth.js";
import type { TokenService } from "../auth/token.service.js";
import type { CompetitionService } from "./competition.service.js";

const idSchema = z.string().uuid();

export function createCompetitionRouter(service: CompetitionService, tokens: TokenService) {
  const router = Router();
  const auth = requireAuth(tokens);
  const writeLimiter = rateLimit({
    windowMs: 60_000,
    limit: 40,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });

  router.get("/competitions", async (_request, response, next) => {
    try { response.json(await service.listPublic()); }
    catch (error) { next(error); }
  });

  router.post("/competitions/:competitionId/register", auth, writeLimiter, async (request, response, next) => {
    try {
      const competitionId = idSchema.parse(request.params.competitionId);
      const input = competitionTeamRegisterRequestSchema.parse(request.body);
      response.status(201).json({ registration: await service.apply(request.auth!.userId, competitionId, input) });
    } catch (error) { next(error); }
  });

  router.post("/competitions/:competitionId/invitations/:teamId/respond", auth, writeLimiter, async (request, response, next) => {
    try {
      const competitionId = idSchema.parse(request.params.competitionId);
      const teamId = idSchema.parse(request.params.teamId);
      const input = competitionRegistrationResponseRequestSchema.parse(request.body);
      response.json({ registration: await service.respondInvitation(request.auth!.userId, competitionId, teamId, input) });
    } catch (error) { next(error); }
  });

  router.post("/competitions/:competitionId/teams/:teamId/withdraw", auth, writeLimiter, async (request, response, next) => {
    try {
      const competitionId = idSchema.parse(request.params.competitionId);
      const teamId = idSchema.parse(request.params.teamId);
      response.json({ registration: await service.withdraw(request.auth!.userId, competitionId, teamId) });
    } catch (error) { next(error); }
  });

  router.get("/competitions/:competitionId/media", async (request, response, next) => {
    try {
      const competitionId = idSchema.parse(request.params.competitionId);
      response.json(await service.listPublicMedia(competitionId));
    } catch (error) { next(error); }
  });

  router.get("/competitions/:competitionId", async (request, response, next) => {
    try {
      const competitionId = idSchema.parse(request.params.competitionId);
      response.json({ competition: await service.getPublic(competitionId) });
    } catch (error) { next(error); }
  });

  return router;
}

export function createOwnerCompetitionRouter(service: CompetitionService, tokens: TokenService) {
  const router = Router();
  const auth = requireAuth(tokens);
  const writeLimiter = rateLimit({
    windowMs: 60_000,
    limit: 50,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });

  router.get("/competitions", auth, async (request, response, next) => {
    try { response.json(await service.listOwner(request.auth!.userId)); }
    catch (error) { next(error); }
  });

  router.post("/competitions", auth, writeLimiter, async (request, response, next) => {
    try {
      const input = competitionCreateRequestSchema.parse(request.body);
      response.status(201).json({ competition: await service.create(request.auth!.userId, input) });
    } catch (error) { next(error); }
  });

  router.post("/competitions/:competitionId/duplicate", auth, writeLimiter, async (request, response, next) => {
    try {
      const competitionId = idSchema.parse(request.params.competitionId);
      response.status(201).json({ competition: await service.duplicate(request.auth!.userId, competitionId) });
    } catch (error) { next(error); }
  });

  router.get("/competitions/:competitionId", auth, async (request, response, next) => {
    try {
      const competitionId = idSchema.parse(request.params.competitionId);
      response.json({ competition: await service.getOwner(request.auth!.userId, competitionId) });
    } catch (error) { next(error); }
  });

  router.patch("/competitions/:competitionId", auth, writeLimiter, async (request, response, next) => {
    try {
      const competitionId = idSchema.parse(request.params.competitionId);
      const input = competitionUpdateRequestSchema.parse(request.body);
      response.json({ competition: await service.update(request.auth!.userId, competitionId, input) });
    } catch (error) { next(error); }
  });

  router.delete("/competitions/:competitionId", auth, writeLimiter, async (request, response, next) => {
    try {
      const competitionId = idSchema.parse(request.params.competitionId);
      response.json(await service.remove(request.auth!.userId, competitionId));
    } catch (error) { next(error); }
  });

  router.get("/competitions/:competitionId/media", auth, async (request, response, next) => {
    try {
      const competitionId = idSchema.parse(request.params.competitionId);
      response.json(await service.listOwnerMedia(request.auth!.userId, competitionId));
    } catch (error) { next(error); }
  });

  router.post("/competitions/:competitionId/media", auth, writeLimiter, async (request, response, next) => {
    try {
      const competitionId = idSchema.parse(request.params.competitionId);
      const input = competitionMediaPostCreateRequestSchema.parse(request.body);
      response.status(201).json({ post: await service.createMediaPost(request.auth!.userId, competitionId, input) });
    } catch (error) { next(error); }
  });

  router.patch("/competitions/:competitionId/media/:postId", auth, writeLimiter, async (request, response, next) => {
    try {
      const competitionId = idSchema.parse(request.params.competitionId);
      const postId = idSchema.parse(request.params.postId);
      const input = competitionMediaPostStatusRequestSchema.parse(request.body);
      response.json({ post: await service.setMediaStatus(request.auth!.userId, competitionId, postId, input) });
    } catch (error) { next(error); }
  });

  router.post("/competitions/:competitionId/state", auth, writeLimiter, async (request, response, next) => {
    try {
      const competitionId = idSchema.parse(request.params.competitionId);
      const input = competitionStateRequestSchema.parse(request.body);
      response.json({ competition: await service.changeState(request.auth!.userId, competitionId, input) });
    } catch (error) { next(error); }
  });

  router.put("/competitions/:competitionId/matches/:matchId/schedule", auth, writeLimiter, async (request, response, next) => {
    try {
      const competitionId = idSchema.parse(request.params.competitionId);
      const matchId = idSchema.parse(request.params.matchId);
      const input = competitionMatchScheduleRequestSchema.parse(request.body);
      response.json({ competition: await service.scheduleMatch(request.auth!.userId, competitionId, matchId, input) });
    } catch (error) { next(error); }
  });

  router.put("/competitions/:competitionId/matches/:matchId/result", auth, writeLimiter, async (request, response, next) => {
    try {
      const competitionId = idSchema.parse(request.params.competitionId);
      const matchId = idSchema.parse(request.params.matchId);
      const input = competitionMatchResultRequestSchema.parse(request.body);
      response.json(await service.enterResult(request.auth!.userId, competitionId, matchId, input));
    } catch (error) { next(error); }
  });

  router.post("/competitions/:competitionId/invitations", auth, writeLimiter, async (request, response, next) => {
    try {
      const competitionId = idSchema.parse(request.params.competitionId);
      const input = competitionInviteTeamRequestSchema.parse(request.body);
      response.status(201).json({ registration: await service.inviteTeam(request.auth!.userId, competitionId, input) });
    } catch (error) { next(error); }
  });

  router.patch("/competitions/:competitionId/registrations/:teamId", auth, writeLimiter, async (request, response, next) => {
    try {
      const competitionId = idSchema.parse(request.params.competitionId);
      const teamId = idSchema.parse(request.params.teamId);
      const input = competitionRegistrationDecisionRequestSchema.parse(request.body);
      response.json({ registration: await service.decideRegistration(request.auth!.userId, competitionId, teamId, input) });
    } catch (error) { next(error); }
  });

  router.delete("/competitions/:competitionId/registrations/:teamId", auth, writeLimiter, async (request, response, next) => {
    try {
      const competitionId = idSchema.parse(request.params.competitionId);
      const teamId = idSchema.parse(request.params.teamId);
      response.json(await service.removeTeam(request.auth!.userId, competitionId, teamId));
    } catch (error) { next(error); }
  });

  router.patch("/competitions/:competitionId/registrations/:teamId/fee", auth, writeLimiter, async (request, response, next) => {
    try {
      const competitionId = idSchema.parse(request.params.competitionId);
      const teamId = idSchema.parse(request.params.teamId);
      const input = competitionFeeUpdateRequestSchema.parse(request.body);
      response.json({ registration: await service.updateFee(request.auth!.userId, competitionId, teamId, input) });
    } catch (error) { next(error); }
  });

  return router;
}
