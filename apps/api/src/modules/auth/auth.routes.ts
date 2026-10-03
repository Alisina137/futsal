import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { loginRequestSchema, logoutRequestSchema, refreshRequestSchema, registerRequestSchema } from "@leaguekick/contracts";
import type { AuthService } from "./auth.service.js";

export function createAuthRouter(auth: AuthService) {
  const router = Router();
  const limiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false });
  router.use(limiter);

  router.post("/register", async (request, response, next) => {
    try {
      const input = registerRequestSchema.parse(request.body);
      response.status(201).json(await auth.register(input, request.get("user-agent") ?? undefined));
    } catch (error) { next(error); }
  });

  router.post("/login", async (request, response, next) => {
    try {
      const input = loginRequestSchema.parse(request.body);
      response.json(await auth.login(input, request.get("user-agent") ?? undefined));
    } catch (error) { next(error); }
  });

  router.post("/refresh", async (request, response, next) => {
    try {
      const input = refreshRequestSchema.parse(request.body);
      response.json(await auth.refresh(input.refreshToken));
    } catch (error) { next(error); }
  });

  router.post("/logout", async (request, response, next) => {
    try {
      const input = logoutRequestSchema.parse(request.body);
      await auth.logout(input.refreshToken);
      response.status(204).send();
    } catch (error) { next(error); }
  });

  return router;
}
