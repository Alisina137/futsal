import { randomUUID } from "node:crypto";
import { accountProfileUpdateRequestSchema } from "@leaguekick/contracts";
import cors from "cors";
import express, { raw, type NextFunction, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import helmet from "helmet";
import { ZodError } from "zod";
import { AppError } from "./lib/errors.js";
import { requireAuth } from "./middleware/auth.js";
import { createAuthRouter, createRoleSubscriptionAdminRouter } from "./modules/auth/auth.routes.js";
import type { AuthService } from "./modules/auth/auth.service.js";
import type { TokenService } from "./modules/auth/token.service.js";
import { createOwnerScheduleRouter, createPlayerBookingRouter, createPublicVenueRouter } from "./modules/booking/booking.routes.js";
import type { BookingService } from "./modules/booking/booking.service.js";
import { createOwnerRouter } from "./modules/owner/owner.routes.js";
import type { OwnerOnboardingService } from "./modules/owner/owner.service.js";
import { createOwnerMarketingRouter, createPublicMarketingRouter } from "./modules/marketing/marketing.routes.js";
import type { MarketingService } from "./modules/marketing/marketing.service.js";
import { createNotificationRouter } from "./modules/notifications/notification.routes.js";
import type { NotificationService } from "./modules/notifications/notification.service.js";
import { createAuthenticatedTeamRouter, createPublicTeamRouter } from "./modules/team/team.routes.js";
import type { TeamService } from "./modules/team/team.service.js";
import { createTeamManagerPhase1Router, type TeamManagerPhase1Service } from "./modules/team/team-manager-phase1.routes.js";
import { createTeamManagerPhase2Router, type TeamManagerPhase2Service } from "./modules/team/team-manager-phase2.routes.js";
import { createCompetitionRouter, createOwnerCompetitionRouter } from "./modules/competition/competition.routes.js";
import type { CompetitionService } from "./modules/competition/competition.service.js";
import { createAdminRouter, createOwnerCommercialRouter } from "./modules/commercial/commercial.routes.js";
import type { CommercialService } from "./modules/commercial/commercial.service.js";
import { createOwnerTimetableRouter } from "./modules/timetable/timetable.routes.js";
import type { TimetableService } from "./modules/timetable/timetable.service.js";
import { createOwnerManualTeamRouter, createAdminManualTeamRouter } from "./modules/manual-team/manual-team.routes.js";
import type { ManualTeamService } from "./modules/manual-team/manual-team.service.js";

export type AppDependencies = {
  authService: AuthService;
  tokenService: TokenService;
  ownerService?: OwnerOnboardingService;
  bookingService?: BookingService;
  marketingService?: MarketingService;
  notificationService?: NotificationService;
  teamService?: TeamService;
  teamManagerPhase1?: TeamManagerPhase1Service;
  teamManagerPhase2?: TeamManagerPhase2Service;
  competitionService?: CompetitionService;
  commercialService?: CommercialService;
  timetableService?: TimetableService;
  manualTeamService?: ManualTeamService;
  trustProxyHops?: number;
  corsOrigin?: string;
  appVersion?: string;
  requestLogging?: boolean;
  readinessCheck?: () => Promise<void>;
};

function normalizePath(path: string) {
  return path.replace(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
    ":id",
  );
}

function requestIdOf(response: Response) {
  return String(response.locals.requestId ?? "");
}

function sendError(
  response: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  response.status(status).json({
    error: {
      code,
      message,
      requestId: requestIdOf(response),
      ...(details !== undefined ? { details } : {}),
    },
  });
}

export function createApp(deps: AppDependencies) {
  const app = express();
  const appVersion = deps.appVersion ?? "dev";
  const allowedOrigins = (deps.corsOrigin ?? "*")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowAnyOrigin = allowedOrigins.includes("*");

  app.disable("x-powered-by");
  if ((deps.trustProxyHops ?? 0) > 0) {
    app.set("trust proxy", deps.trustProxyHops);
  }
  app.use(helmet());
  app.use((request, response, next) => {
    const requestId = randomUUID();
    response.locals.requestId = requestId;
    response.setHeader("X-Request-Id", requestId);

    if (deps.requestLogging) {
      const startedAt = Date.now();
      response.on("finish", () => {
        console.info(JSON.stringify({
          event: "http_request",
          requestId,
          method: request.method,
          path: normalizePath(request.path),
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt,
        }));
      });
    }
    next();
  });
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowAnyOrigin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new AppError(403, "CORS_ORIGIN_DENIED", "This origin is not allowed."));
    },
    exposedHeaders: ["X-Request-Id"],
  }));
  app.use(express.json({ limit: "100kb" }));
  app.use("/api/v1", (_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Pragma", "no-cache");
    next();
  });

  app.get("/health", (_request, response) => {
    response.json({ status: "ok", service: "futsal-api", version: appVersion });
  });
  app.get("/ready", async (_request, response) => {
    try {
      await deps.readinessCheck?.();
      response.json({ status: "ready", service: "futsal-api", version: appVersion });
    } catch {
      response.status(503).json({
        status: "not_ready",
        service: "futsal-api",
        version: appVersion,
        requestId: requestIdOf(response),
      });
    }
  });

  app.use("/api/v1/auth", createAuthRouter(deps.authService, deps.tokenService));
  app.use("/api/v1/admin", createRoleSubscriptionAdminRouter(deps.authService, deps.tokenService));
  if (deps.ownerService) app.use("/api/v1/owner", createOwnerRouter(deps.ownerService, deps.tokenService));
  if (deps.bookingService) {
    app.use("/api/v1/venues", createPublicVenueRouter(deps.bookingService));
    app.use("/api/v1/bookings", createPlayerBookingRouter(deps.bookingService, deps.tokenService));
    app.use("/api/v1/owner", createOwnerScheduleRouter(deps.bookingService, deps.tokenService));
  }
  if (deps.marketingService) {
    app.use("/api/v1", createPublicMarketingRouter(deps.marketingService, deps.tokenService));
    app.use("/api/v1/owner", createOwnerMarketingRouter(deps.marketingService, deps.tokenService));
  }
  if (deps.notificationService) {
    app.use("/api/v1/notifications", createNotificationRouter(deps.notificationService, deps.tokenService));
  }
  if (deps.teamService) {
    app.use("/api/v1", createAuthenticatedTeamRouter(deps.teamService, deps.tokenService));
    app.use("/api/v1", createPublicTeamRouter(deps.teamService));
  }
  if (deps.teamManagerPhase1) app.use("/api/v1",createTeamManagerPhase1Router(deps.teamManagerPhase1,deps.tokenService));
  if (deps.teamManagerPhase2) app.use("/api/v1",createTeamManagerPhase2Router(deps.teamManagerPhase2,deps.tokenService));
  if (deps.competitionService) {
    app.use("/api/v1", createCompetitionRouter(deps.competitionService, deps.tokenService));
    app.use("/api/v1/owner", createOwnerCompetitionRouter(deps.competitionService, deps.tokenService));
  }

  if (deps.commercialService) {
    app.use("/api/v1/owner", createOwnerCommercialRouter(deps.commercialService, deps.tokenService));
    app.use("/api/v1/admin", createAdminRouter(deps.commercialService, deps.tokenService));
  }

  if (deps.manualTeamService) {
    app.use("/api/v1/owner", createOwnerManualTeamRouter(deps.manualTeamService, deps.tokenService));
    app.use("/api/v1/admin", createAdminManualTeamRouter(deps.manualTeamService, deps.tokenService));
  }

  if (deps.timetableService) {
    app.use("/api/v1/owner", createOwnerTimetableRouter(deps.timetableService, deps.tokenService));
  }

  app.get("/api/v1/users/me", requireAuth(deps.tokenService), async (request, response, next) => {
    try {
      response.json({ user: await deps.authService.me(request.auth!.userId) });
    } catch (error) { next(error); }
  });

  app.get("/api/v1/users/avatars/:userId/:publicToken", async(request,response,next)=>{
    try{
      const userId=z.string().uuid().parse(request.params.userId);
      const publicToken=z.string().regex(/^[A-Za-z0-9_-]{32,64}$/).parse(request.params.publicToken);
      const image=await deps.authService.publicProfileImage(userId,publicToken);
      response.setHeader("Content-Type",image.mimeType);
      response.setHeader("Content-Length",String(image.byteSize));
      response.setHeader("Cache-Control","public,max-age=31536000,immutable");
      response.setHeader("Cross-Origin-Resource-Policy","cross-origin");
      response.send(Buffer.from(image.dataBase64,"base64"));
    }catch(error){next(error);}
  });

  app.post("/api/v1/users/me/avatar",
    requireAuth(deps.tokenService),
    rateLimit({windowMs:60_000,limit:8,standardHeaders:"draft-8",legacyHeaders:false}),
    raw({type:"image/*",limit:"6mb"}),
    async(request,response,next)=>{
      try{
        const mimeType=String(request.headers["content-type"]??"").split(";")[0]!.trim().toLowerCase();
        if(!Buffer.isBuffer(request.body))throw new AppError(400,"MEDIA_BODY_REQUIRED","Choose an image to upload.");
        const updated=await deps.authService.uploadProfileImage(request.auth!.userId,mimeType,request.body);
        response.status(201).json(updated);
      }catch(error){next(error);}
    },
  );

  app.patch("/api/v1/users/me", requireAuth(deps.tokenService), async (request, response, next) => {
    try {
      const input = accountProfileUpdateRequestSchema.parse(request.body);
      response.json({ user: await deps.authService.updateProfile(request.auth!.userId, input) });
    } catch (error) { next(error); }
  });

  app.use((_request: Request, response: Response) => {
    sendError(response, 404, "NOT_FOUND", "Route not found.");
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if ((error as { type?: string } | null)?.type === "entity.too.large") {
      sendError(response, 413, "MEDIA_TOO_LARGE", "Images must be 6 MB or smaller.");
      return;
    }
    if (error instanceof ZodError) {
      sendError(response, 400, "VALIDATION_ERROR", "The request is invalid.", error.issues);
      return;
    }
    if (error instanceof AppError) {
      sendError(response, error.statusCode, error.code, error.message, error.details);
      return;
    }

    console.error(JSON.stringify({
      event: "unhandled_api_error",
      requestId: requestIdOf(response),
      errorType: error instanceof Error ? error.name : typeof error,
    }));
    sendError(response, 500, "INTERNAL_ERROR", "The server could not complete the request.");
  });

  return app;
}
