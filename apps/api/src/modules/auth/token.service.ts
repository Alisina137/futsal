import { createHash, randomBytes } from "node:crypto";
import type { UserRole } from "@leaguekick/contracts";
import { userRoleSchema } from "@leaguekick/contracts";
import { SignJWT, jwtVerify } from "jose";
import { errors } from "../../lib/errors.js";

export type AccessClaims = { userId: string; roles: UserRole[] };

export class TokenService {
  private readonly key: Uint8Array;

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
    try {
      const { payload } = await jwtVerify(token, this.key, { issuer: this.issuer, audience: this.audience });
      if (!payload.sub) throw new Error("missing sub");
      const roles = userRoleSchema.array().safeParse(payload.roles);
      if (!roles.success) throw new Error("invalid roles");
      return { userId: payload.sub, roles: roles.data };
    } catch {
      throw errors.unauthorized("INVALID_ACCESS_TOKEN", "The access token is invalid or expired.");
    }
  }

  createRefreshToken() {
    const token = randomBytes(48).toString("base64url");
    return { token, hash: this.hashRefreshToken(token), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) };
  }

  hashRefreshToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
}
