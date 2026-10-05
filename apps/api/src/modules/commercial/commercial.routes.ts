import {
  adminSubscriptionActivationRequestSchema,
  adminSupportNoteRequestSchema,
  adminTrialExtensionRequestSchema,
  adminUserStatusRequestSchema,
  adminVenueActionRequestSchema,
  dateOnlySchema,
  platformSettingsUpdateRequestSchema,
} from "@leaguekick/contracts";
import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import type { TokenService } from "../auth/token.service.js";
import type { CommercialService } from "./commercial.service.js";

const reasonSchema = z.object({ reason: z.string().trim().min(3).max(500) });

export function createOwnerCommercialRouter(service: CommercialService, tokens: TokenService) {
  const router = Router();
  router.use(requireAuth(tokens), requireRole("VENUE_OWNER"));

  router.get("/subscription", async (request, response, next) => {
    try {
      response.json(await service.ownerBilling(request.auth!.userId));
    } catch (error) {
      next(error);
    }
  });

  router.post("/subscription/reactivation-request", async (request, response, next) => {
    try {
      await service.requestReactivation(request.auth!.userId);
      response.status(202).json({ requested: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/analytics", async (request, response, next) => {
    try {
      const from = dateOnlySchema.parse(request.query.from);
      const to = dateOnlySchema.parse(request.query.to);
      response.json(await service.ownerAnalytics(request.auth!.userId, from, to));
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export function createAdminRouter(service: CommercialService, tokens: TokenService) {
  const router = Router();
  router.use(requireAuth(tokens), requireRole("PLATFORM_ADMIN"));

  router.get("/dashboard", async (_request, response, next) => {
    try {
      response.json(await service.adminDashboard());
    } catch (error) {
      next(error);
    }
  });

  router.get("/users", async (request, response, next) => {
    try {
      const query = typeof request.query.q === "string" ? request.query.q : undefined;
      response.json({ users: await service.listUsers(query) });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/users/:userId/status", async (request, response, next) => {
    try {
      const input = adminUserStatusRequestSchema.parse(request.body);
      await service.setUserStatus(request.auth!.userId, request.params.userId!, input);
      response.json({ updated: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/venues", async (request, response, next) => {
    try {
      const query = typeof request.query.q === "string" ? request.query.q : undefined;
      response.json({ venues: await service.listVenues(query) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/venues/duplicates", async (_request, response, next) => {
    try {
      response.json({ groups: await service.duplicateVenues() });
    } catch (error) {
      next(error);
    }
  });

  router.post("/venues/:venueId/action", async (request, response, next) => {
    try {
      const input = adminVenueActionRequestSchema.parse(request.body);
      await service.applyVenueAction(request.auth!.userId, request.params.venueId!, input);
      response.json({ updated: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/venues/:venueId/payments", async (request, response, next) => {
    try {
      response.json({ payments: await service.venuePayments(request.params.venueId!) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/venues/:venueId/subscription/activate", async (request, response, next) => {
    try {
      const input = adminSubscriptionActivationRequestSchema.parse(request.body);
      await service.activateSubscription(request.auth!.userId, request.params.venueId!, input);
      response.status(201).json({ activated: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/venues/:venueId/trial/extend", async (request, response, next) => {
    try {
      const input = adminTrialExtensionRequestSchema.parse(request.body);
      await service.extendTrial(request.auth!.userId, request.params.venueId!, input);
      response.json({ extended: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/settings", async (_request, response, next) => {
    try {
      response.json({ settings: await service.settings() });
    } catch (error) {
      next(error);
    }
  });

  router.put("/settings", async (request, response, next) => {
    try {
      const input = platformSettingsUpdateRequestSchema.parse(request.body);
      response.json({ settings: await service.updateSettings(request.auth!.userId, input) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/audit", async (_request, response, next) => {
    try {
      response.json({ logs: await service.auditLogs() });
    } catch (error) {
      next(error);
    }
  });

  router.post("/support-notes", async (request, response, next) => {
    try {
      const input = adminSupportNoteRequestSchema.parse(request.body);
      await service.supportNote(request.auth!.userId, input);
      response.status(201).json({ created: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/payments/:paymentId/void", async (request, response, next) => {
    try {
      const { reason } = reasonSchema.parse(request.body);
      await service.voidPayment(request.auth!.userId, request.params.paymentId!, reason);
      response.json({ voided: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/content/posts/:postId/unpublish", async (request, response, next) => {
    try {
      const { reason } = reasonSchema.parse(request.body);
      await service.unpublishPost(request.auth!.userId, request.params.postId!, reason);
      response.json({ unpublished: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/content/promotions/:promotionId/close", async (request, response, next) => {
    try {
      const { reason } = reasonSchema.parse(request.body);
      await service.closePromotion(request.auth!.userId, request.params.promotionId!, reason);
      response.json({ closed: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
