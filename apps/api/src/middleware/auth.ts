import type { UserRole } from "@leaguekick/contracts";
import type { NextFunction, Request, Response } from "express";
import { errors } from "../lib/errors.js";
import type { TokenService } from "../modules/auth/token.service.js";

export function requireAuth(tokens: TokenService) {
  return async (request: Request, _response: Response, next: NextFunction) => {
    try {
      const header = request.headers.authorization;
      if (!header?.startsWith("Bearer ")) throw errors.unauthorized();
      request.auth = await tokens.verifyAccessToken(header.slice(7));
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireRole(role: UserRole) {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (!request.auth?.roles.includes(role)) {
      next(errors.forbidden("ROLE_REQUIRED", `The ${role} role is required.`));
      return;
    }
    next();
  };
}
