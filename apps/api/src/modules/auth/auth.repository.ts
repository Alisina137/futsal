import type { UserRole } from "@leaguekick/contracts";
import { normalizeAfghanistanPhone } from "@leaguekick/contracts";
import type { Database } from "@leaguekick/database";
import { sessions, userRoles, users } from "@leaguekick/database";
import { eq } from "drizzle-orm";
import { errors } from "../../lib/errors.js";
import type { AuthRepository, AuthUserRecord, CreateUserInput, SessionRecord } from "./auth.types.js";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
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
        await tx.insert(userRoles).values({ userId: row.id, role: input.role });
        return {
          id: row.id,
          displayName: row.displayName,
          username: row.username,
          usernameNormalized: row.usernameNormalized,
          phoneE164: row.phoneE164,
          passwordHash: row.passwordHash,
          preferredLanguage: row.preferredLanguage,
          status: row.status,
          roles: [input.role],
        };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw errors.conflict("IDENTITY_ALREADY_EXISTS", "That phone number or username is already registered.");
      }
      throw error;
    }
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
