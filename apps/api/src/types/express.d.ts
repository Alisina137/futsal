import type { UserRole } from "@leaguekick/contracts";

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; roles: UserRole[] };
    }
  }
}

export {};
