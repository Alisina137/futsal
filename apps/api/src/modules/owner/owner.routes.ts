import { Router } from "express";
import { ownerVenueSetupRequestSchema } from "@leaguekick/contracts";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import type { TokenService } from "../auth/token.service.js";
import type { OwnerOnboardingService } from "./owner.service.js";

export function createOwnerRouter(owner: OwnerOnboardingService, tokens: TokenService) {
  const router = Router();
  router.use(requireAuth(tokens), requireRole("VENUE_OWNER"));

  router.get("/onboarding", async (request, response, next) => {
    try {
      response.json(await owner.getStatus(request.auth!.userId));
    } catch (error) {
      next(error);
    }
  });

  router.put("/onboarding", async (request, response, next) => {
    try {
      const input = ownerVenueSetupRequestSchema.parse(request.body);
      response.json(await owner.saveSetup(request.auth!.userId, input));
    } catch (error) {
      next(error);
    }
  });

  router.get("/venue/preview", async (request, response, next) => {
    try {
      response.json(await owner.getStatus(request.auth!.userId));
    } catch (error) {
      next(error);
    }
  });

  router.post("/trial/start", async (request, response, next) => {
    try {
      response.json(await owner.startTrial(request.auth!.userId));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
