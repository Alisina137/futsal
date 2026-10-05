import type { UserRole } from "@leaguekick/contracts";
import { normalizeAfghanistanPhone } from "@leaguekick/contracts";
import type { Database } from "@leaguekick/database";
import { sessions, userRoles, users } from "@leaguekick/database";
import { eq } from "drizzle-orm";
import { errors } from "../../lib/errors.js";
import type { AuthRepository, AuthUserRecord, CreateUserInput, SessionRecord } from "./auth.types.js";

function uniqueConstraint(error: unknown, depth = 0): string | null {
  if (depth > 4 || typeof error !== "object" || error === null) return null;
  const candidate = error as { code?: unknown; constraint?: unknown; cause?: unknown };
  if (candidate.code === "23505") {
    return typeof candidate.constraint === "string" ? candidate.constraint : "";
  }
  return uniqueConstraint(candidate.cause, depth + 1);
}

export class DrizzleAuthRepository implements AuthRepository {
  constructor(private readonly db: Database) {}

  private async rolesFor(userId: string): Promise<UserRole[]> {
    const rows = await this.db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId));
    return rows.map((row) => row.role as UserRole);
  }

  private async hydrate(row: typeof users.$inferSelect): Promise<AuthUserRecord> {
    return {
      id: row.id,
      displayName: row.displayName,
      username: row.username,
      usernameNormalized: row.usernameNormalized,
      phoneE164: row.phoneE164,
      passwordHash: row.passwordHash,
      preferredLanguage: row.preferredLanguage,
      status: row.status,
      roles: await this.rolesFor(row.id),
    };
  }

  async findUserByIdentifier(identifier: string): Promise<AuthUserRecord | null> {
    const raw = identifier.trim();
    let normalizedPhone: string | null = null;

    try {
      normalizedPhone = normalizeAfghanistanPhone(raw);
    } catch {
      normalizedPhone = null;
    }

    const [row] = normalizedPhone
      ? await this.db.select().from(users).where(eq(users.phoneE164, normalizedPhone)).limit(1)
      : await this.db.select().from(users).where(eq(users.usernameNormalized, raw.toLowerCase())).limit(1);

    return row ? this.hydrate(row) : null;
  }

  async getUserById(userId: string): Promise<AuthUserRecord | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    return row ? this.hydrate(row) : null;
  }

  async createUser(input: CreateUserInput): Promise<AuthUserRecord> {
    try {
      return await this.db.transaction(async (tx) => {
        const [row] = await tx.insert(users).values({
          displayName: input.displayName,
          username: input.username,
          usernameNormalized: input.usernameNormalized,
          phoneE164: input.phoneE164,
          passwordHash: input.passwordHash,
          preferredLanguage: input.preferredLanguage,
        }).returning();
        if (!row) throw new Error("Failed to create user.");
        return {
          id: row.id,
          displayName: row.displayName,
          username: row.username,
          usernameNormalized: row.usernameNormalized,
          phoneE164: row.phoneE164,
          passwordHash: row.passwordHash,
          preferredLanguage: row.preferredLanguage,
          status: row.status,
          roles: [],
        };
      });
    } catch (error) {
      const constraint = uniqueConstraint(error);
      if (constraint === "users_username_normalized_uq") {
        throw errors.conflict("USERNAME_ALREADY_EXISTS", "That username is already registered.");
      }
      if (constraint === "users_phone_e164_uq") {
        throw errors.conflict("PHONE_ALREADY_EXISTS", "That phone number is already registered.");
      }
      if (constraint !== null) {
        throw errors.conflict("IDENTITY_ALREADY_EXISTS", "That phone number or username is already registered.");
      }
      throw error;
    }
  }

  async addRoles(userId: string, roles: UserRole[]): Promise<AuthUserRecord> {
    if (roles.length > 0) {
      await this.db.insert(userRoles).values(roles.map((role) => ({ userId, role }))).onConflictDoNothing();
    }
    const user = await this.getUserById(userId);
    if (!user) throw errors.unauthorized("ACCOUNT_UNAVAILABLE", "This account is unavailable.");
    return user;
  }

  async updateDisplayName(userId: string, displayName: string): Promise<AuthUserRecord> {
    const [row] = await this.db.update(users)
      .set({ displayName, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    if (!row) throw errors.unauthorized("ACCOUNT_UNAVAILABLE", "This account is unavailable.");
    return this.hydrate(row);
  }

  async createSession(input: { userId: string; refreshTokenHash: string; expiresAt: Date; deviceLabel?: string }): Promise<SessionRecord> {
    const [row] = await this.db.insert(sessions).values({
      userId: input.userId,
      refreshTokenHash: input.refreshTokenHash,
      expiresAt: input.expiresAt,
      ...(input.deviceLabel ? { deviceLabel: input.deviceLabel } : {}),
    }).returning();
    if (!row) throw new Error("Failed to create session.");
    return { id: row.id, userId: row.userId, refreshTokenHash: row.refreshTokenHash, expiresAt: row.expiresAt, revokedAt: row.revokedAt };
  }

  async findSessionByRefreshHash(refreshTokenHash: string): Promise<SessionRecord | null> {
    const [row] = await this.db.select().from(sessions).where(eq(sessions.refreshTokenHash, refreshTokenHash)).limit(1);
    return row ? { id: row.id, userId: row.userId, refreshTokenHash: row.refreshTokenHash, expiresAt: row.expiresAt, revokedAt: row.revokedAt } : null;
  }

  async rotateSession(sessionId: string, refreshTokenHash: string, expiresAt: Date): Promise<void> {
    await this.db.update(sessions).set({ refreshTokenHash, expiresAt, lastSeenAt: new Date() }).where(eq(sessions.id, sessionId));
  }

  async revokeSessionByRefreshHash(refreshTokenHash: string): Promise<void> {
    await this.db.update(sessions).set({ revokedAt: new Date(), lastSeenAt: new Date() }).where(eq(sessions.refreshTokenHash, refreshTokenHash));
  }
}
