import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import {
  dateOnlySchema,
  venueTimetableDraftRequestSchema,
  venueTimetableExceptionRequestSchema,
} from "@leaguekick/contracts";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import type { TokenService } from "../auth/token.service.js";
import type { TimetableService } from "./timetable.service.js";

const idSchema = z.string().uuid();

export function createOwnerTimetableRouter(timetable: TimetableService, tokens: TokenService) {
  const router = Router();
  router.use(requireAuth(tokens), requireRole("VENUE_OWNER"));
  const writeLimiter = rateLimit({ windowMs: 60_000, limit: 90, standardHeaders: "draft-8", legacyHeaders: false });

  router.get("/timetables", async (request, response, next) => {
    try {
      response.json(await timetable.list(request.auth!.userId));
    } catch (error) { next(error); }
  });

  router.post("/timetables", writeLimiter, async (request, response, next) => {
    try {
      const input = venueTimetableDraftRequestSchema.parse(request.body);
      response.status(201).json(await timetable.createDraft(request.auth!.userId, input));
    } catch (error) { next(error); }
  });

  router.put("/timetables/:timetableId", writeLimiter, async (request, response, next) => {
    try {
      const input = venueTimetableDraftRequestSchema.parse(request.body);
      response.json(await timetable.updateDraft(
        request.auth!.userId,
        idSchema.parse(request.params.timetableId),
        input,
      ));
    } catch (error) { next(error); }
  });

  router.post("/timetables/:timetableId/duplicate", writeLimiter, async (request, response, next) => {
    try {
      response.status(201).json(await timetable.duplicate(
        request.auth!.userId,
        idSchema.parse(request.params.timetableId),
      ));
    } catch (error) { next(error); }
  });

  router.delete("/timetables/:timetableId", writeLimiter, async (request, response, next) => {
    try {
      response.json(await timetable.deleteDraft(
        request.auth!.userId,
        idSchema.parse(request.params.timetableId),
      ));
    } catch (error) { next(error); }
  });

  router.post("/timetables/:timetableId/publish", writeLimiter, async (request, response, next) => {
    try {
      response.json(await timetable.publish(
        request.auth!.userId,
        idSchema.parse(request.params.timetableId),
      ));
    } catch (error) { next(error); }
  });

  router.post("/timetables/:timetableId/archive", writeLimiter, async (request, response, next) => {
    try {
      response.json(await timetable.archive(
        request.auth!.userId,
        idSchema.parse(request.params.timetableId),
      ));
    } catch (error) { next(error); }
  });

  router.post("/timetable-exceptions", writeLimiter, async (request, response, next) => {
    try {
      const input = venueTimetableExceptionRequestSchema.parse(request.body);
      response.status(201).json(await timetable.createException(request.auth!.userId, input));
    } catch (error) { next(error); }
  });

  router.delete("/timetable-exceptions/:exceptionId", writeLimiter, async (request, response, next) => {
    try {
      response.json(await timetable.deleteException(
        request.auth!.userId,
        idSchema.parse(request.params.exceptionId),
      ));
    } catch (error) { next(error); }
  });

  router.get("/timetable-calendar", async (request, response, next) => {
    try {
      const from = dateOnlySchema.parse(request.query.from);
      const to = dateOnlySchema.parse(request.query.to);
      const areaId = typeof request.query.areaId === "string" && request.query.areaId
        ? idSchema.parse(request.query.areaId)
        : null;
      response.json(await timetable.calendar(request.auth!.userId, from, to, areaId));
    } catch (error) { next(error); }
  });

  return router;
}
