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

export type AppDependencies = {
  authService: AuthService;
  tokenService: TokenService;
  ownerService?: OwnerOnboardingService;
  bookingService?: BookingService;
  corsOrigin?: string;
};

export function createApp(deps: AppDependencies) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: deps.corsOrigin === "*" || !deps.corsOrigin ? true : deps.corsOrigin }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_request, response) => response.json({ status: "ok", service: "leaguekick-api" }));
  app.use("/api/v1/auth", createAuthRouter(deps.authService));
  if (deps.ownerService) app.use("/api/v1/owner", createOwnerRouter(deps.ownerService, deps.tokenService));
  if (deps.bookingService) {
    app.use("/api/v1/venues", createPublicVenueRouter(deps.bookingService));
    app.use("/api/v1/bookings", createPlayerBookingRouter(deps.bookingService, deps.tokenService));
    app.use("/api/v1/owner", createOwnerScheduleRouter(deps.bookingService, deps.tokenService));
  }

  app.get("/api/v1/users/me", requireAuth(deps.tokenService), async (request, response, next) => {
    try {
      response.json({ user: await deps.authService.me(request.auth!.userId) });
    } catch (error) { next(error); }
  });

  app.use((_request: Request, response: Response) => {
    response.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found." } });
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof ZodError) {
      response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "The request is invalid.", details: error.issues } });
      return;
    }
    if (error instanceof AppError) {
      response.status(error.statusCode).json({ error: { code: error.code, message: error.message, ...(error.details !== undefined ? { details: error.details } : {}) } });
      return;
    }
    console.error("Unhandled API error", error);
    response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "The server could not complete the request." } });
  });

  return app;
}
