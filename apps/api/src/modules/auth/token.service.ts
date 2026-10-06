import { createHash, randomBytes } from "node:crypto";
import type { UserRole } from "@leaguekick/contracts";
import { userRoleSchema } from "@leaguekick/contracts";
import { SignJWT, jwtVerify } from "jose";
import { errors } from "../../lib/errors.js";

export type AccessClaims = { userId: string; roles: UserRole[] };
export type AccessAccountStatus = "ACTIVE" | "SUSPENDED" | "DELETED" | null;

export class TokenService {
  private readonly key: Uint8Array;
  private accessValidator: ((userId: string) => Promise<AccessAccountStatus>) | null = null;

  constructor(
    secret: string,
    private readonly issuer: string,
    private readonly audience: string,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  async createAccessToken(userId: string, roles: UserRole[]) {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const token = await new SignJWT({ roles })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.key);
    return { token, expiresAt };
  }

  async verifyAccessToken(token: string): Promise<AccessClaims> {
    let userId: string;
    let roles: UserRole[];

    try {
      const { payload } = await jwtVerify(token, this.key, { issuer: this.issuer, audience: this.audience });
      if (!payload.sub) throw new Error("missing sub");
      const parsedRoles = userRoleSchema.array().safeParse(payload.roles);
      if (!parsedRoles.success) throw new Error("invalid roles");
      userId = payload.sub;
      roles = parsedRoles.data;
    } catch {
      throw errors.unauthorized("INVALID_ACCESS_TOKEN", "The access token is invalid or expired.");
    }

    if (this.accessValidator) {
      const status = await this.accessValidator(userId);
      if (status === "SUSPENDED") {
        throw errors.forbidden("ACCOUNT_SUSPENDED", "This account is suspended. Contact the platform administrator.");
      }
      if (status !== "ACTIVE") {
        throw errors.unauthorized("ACCOUNT_UNAVAILABLE", "This account is unavailable.");
      }
    }

    return { userId, roles };
  }

  setAccessValidator(validator: (userId: string) => Promise<AccessAccountStatus>) {
    this.accessValidator = validator;
  }

  createRefreshToken() {
    const token = randomBytes(48).toString("base64url");
    return { token, hash: this.hashRefreshToken(token), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) };
  }

  hashRefreshToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
}
