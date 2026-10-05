import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  loginRequestSchema,
  logoutRequestSchema,
  passwordResetCompleteSchema,
  passwordResetRequestSchema,
  passwordResetVerifySchema,
  refreshRequestSchema,
  registerRequestSchema,
  selfRoleActivationRequestSchema,
} from "@leaguekick/contracts";
import { requireAuth } from "../../middleware/auth.js";
import type { TokenService } from "./token.service.js";
import type { AuthService } from "./auth.service.js";

export function createAuthRouter(auth: AuthService, tokens: TokenService) {
  const router = Router();
  const limiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false });
  const resetLimiter = rateLimit({ windowMs: 10 * 60_000, limit: 8, standardHeaders: "draft-8", legacyHeaders: false });
  router.use(limiter);

  router.post("/register", async (request, response, next) => {
    try {
      const input = registerRequestSchema.parse(request.body);
      response.status(201).json(await auth.register(input, request.get("user-agent") ?? undefined));
    } catch (error) { next(error); }
  });

  router.post("/roles/activate", requireAuth(tokens), async (request, response, next) => {
    try {
      const input = selfRoleActivationRequestSchema.parse(request.body);
      response.json({ user: await auth.activateSelfRole(request.auth!.userId, input.role) });
    } catch (error) { next(error); }
  });

  router.post("/login", async (request, response, next) => {
    try {
      const input = loginRequestSchema.parse(request.body);
      response.json(await auth.login(input, request.get("user-agent") ?? undefined));
    } catch (error) { next(error); }
  });

  router.post("/password-reset/request", resetLimiter, async (request, response, next) => {
    try {
      const input = passwordResetRequestSchema.parse(request.body);
      response.json(await auth.requestPasswordReset(input));
    } catch (error) { next(error); }
  });

  router.post("/password-reset/verify", resetLimiter, async (request, response, next) => {
    try {
      const input = passwordResetVerifySchema.parse(request.body);
      response.json(await auth.verifyPasswordReset(input));
    } catch (error) { next(error); }
  });

  router.post("/password-reset/complete", resetLimiter, async (request, response, next) => {
    try {
      const input = passwordResetCompleteSchema.parse(request.body);
      await auth.completePasswordReset(input);
      response.status(204).send();
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
