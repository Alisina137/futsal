import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import {
  notificationPreferencesUpdateSchema,
  pushDeviceRegisterRequestSchema,
} from "@leaguekick/contracts";
import { requireAuth } from "../../middleware/auth.js";
import type { TokenService } from "../auth/token.service.js";
import type { NotificationService } from "./notification.service.js";

const routeIdSchema = z.string().uuid();
const unregisterSchema = z.object({ expoPushToken: z.string().trim().min(20).max(220) });

export function createNotificationRouter(notifications: NotificationService, tokens: TokenService) {
  const router = Router();
  router.use(requireAuth(tokens));

  const writeLimiter = rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });

  router.get("/", async (request, response, next) => {
    try { response.json(await notifications.list(request.auth!.userId)); }
    catch (error) { next(error); }
  });

  router.post("/:notificationId/read", writeLimiter, async (request, response, next) => {
    try {
      const notificationId = routeIdSchema.parse(request.params.notificationId);
      response.json({ notification: await notifications.markRead(request.auth!.userId, notificationId) });
    } catch (error) { next(error); }
  });

  router.get("/preferences", async (request, response, next) => {
    try { response.json({ preferences: await notifications.getPreferences(request.auth!.userId) }); }
    catch (error) { next(error); }
  });

  router.patch("/preferences", writeLimiter, async (request, response, next) => {
    try {
      const input = notificationPreferencesUpdateSchema.parse(request.body);
      response.json({ preferences: await notifications.updatePreferences(request.auth!.userId, input) });
    } catch (error) { next(error); }
  });

  router.post("/devices", writeLimiter, async (request, response, next) => {
    try {
      const input = pushDeviceRegisterRequestSchema.parse(request.body);
      await notifications.registerDevice(request.auth!.userId, input);
      response.status(204).send();
    } catch (error) { next(error); }
  });

  router.post("/devices/unregister", writeLimiter, async (request, response, next) => {
    try {
      const input = unregisterSchema.parse(request.body);
      await notifications.unregisterDevice(request.auth!.userId, input.expoPushToken);
      response.status(204).send();
    } catch (error) { next(error); }
  });

  return router;
}
