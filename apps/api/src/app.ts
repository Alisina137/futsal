import { randomUUID } from "node:crypto";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { ZodError } from "zod";
import { AppError } from "./lib/errors.js";
import { requireAuth } from "./middleware/auth.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
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
import { createCompetitionRouter, createOwnerCompetitionRouter } from "./modules/competition/competition.routes.js";
import type { CompetitionService } from "./modules/competition/competition.service.js";
import { createAdminRouter, createOwnerCommercialRouter } from "./modules/commercial/commercial.routes.js";
import type { CommercialService } from "./modules/commercial/commercial.service.js";

export type AppDependencies = {
  authService: AuthService;
  tokenService: TokenService;
  ownerService?: OwnerOnboardingService;
  bookingService?: BookingService;
  marketingService?: MarketingService;
  notificationService?: NotificationService;
  teamService?: TeamService;
  competitionService?: CompetitionService;
  commercialService?: CommercialService;
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
  app.use(helmet());
  app.use((request, response, next) => {
    const requestId = request.header("X-Request-Id")?.trim().slice(0, 120) || randomUUID();
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

  app.use("/api/v1/auth", createAuthRouter(deps.authService));
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
  if (deps.competitionService) {
    app.use("/api/v1", createCompetitionRouter(deps.competitionService, deps.tokenService));
    app.use("/api/v1/owner", createOwnerCompetitionRouter(deps.competitionService, deps.tokenService));
  }

  if (deps.commercialService) {
    app.use("/api/v1/owner", createOwnerCommercialRouter(deps.commercialService, deps.tokenService));
    app.use("/api/v1/admin", createAdminRouter(deps.commercialService, deps.tokenService));
  }

  app.get("/api/v1/users/me", requireAuth(deps.tokenService), async (request, response, next) => {
    try {
      response.json({ user: await deps.authService.me(request.auth!.userId) });
    } catch (error) { next(error); }
  });

  app.use((_request: Request, response: Response) => {
    sendError(response, 404, "NOT_FOUND", "Route not found.");
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
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
