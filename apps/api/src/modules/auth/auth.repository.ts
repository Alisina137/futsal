import type { AdminRoleSubscriptionDto, PaidRole, RoleSubscriptionOfferDto, UserRole } from "@leaguekick/contracts";
import { normalizeAfghanistanPhone } from "@leaguekick/contracts";
import type { Database } from "@leaguekick/database";
import { auditLogs, passwordResetChallenges, roleSubscriptions, sessions, userRoles, users } from "@leaguekick/database";
import { and, desc, eq, isNull, lte, or } from "drizzle-orm";
import { errors } from "../../lib/errors.js";
import type { AuthRepository, AuthUserRecord, CreateUserInput, PasswordResetChallengeRecord, SessionRecord, UpdateAccountProfileInput } from "./auth.types.js";

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
    const [roleRows, paidRows] = await Promise.all([
      this.db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId)),
      this.db.select({
        role: roleSubscriptions.role,
        status: roleSubscriptions.status,
        activeUntil: roleSubscriptions.activeUntil,
      }).from(roleSubscriptions).where(eq(roleSubscriptions.userId, userId)),
    ]);
    const activePaid = new Set(
      paidRows
        .filter((row) => row.status === "ACTIVE" && row.activeUntil && row.activeUntil.getTime() > Date.now())
        .map((row) => row.role),
    );
    return roleRows
      .map((row) => row.role as UserRole)
      .filter((role) => role !== "VENUE_OWNER" && role !== "TEAM_MANAGER" || activePaid.has(role));
  }

  private async hydrate(row: typeof users.$inferSelect): Promise<AuthUserRecord> {
    return {
      id: row.id,
      displayName: row.displayName,
      username: row.username,
      usernameNormalized: row.usernameNormalized,
      phoneE164: row.phoneE164,
      profileImageUrl: row.profileImageUrl,
      age: row.age,
      emailNormalized: row.emailNormalized,
      city: row.city,
      bio: row.bio,
      lastCredentialResetAt: row.lastCredentialResetAt,
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
          profileImageUrl: row.profileImageUrl,
          age: row.age,
          emailNormalized: row.emailNormalized,
          city: row.city,
          bio: row.bio,
          lastCredentialResetAt: row.lastCredentialResetAt,
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

  private offerStatus(row: typeof roleSubscriptions.$inferSelect | undefined, now: Date) {
    if (!row) return "NONE" as const;
    if (row.status === "ACTIVE" && (!row.activeUntil || row.activeUntil.getTime() <= now.getTime())) return "EXPIRED" as const;
    return row.status;
  }

  async getRoleSubscriptionOffers(
    userId: string,
    prices: Record<PaidRole, number>,
    now: Date,
  ): Promise<RoleSubscriptionOfferDto[]> {
    const rows = await this.db.select().from(roleSubscriptions).where(eq(roleSubscriptions.userId, userId));
    return (["VENUE_OWNER", "TEAM_MANAGER"] as PaidRole[]).map((role) => {
      const row = rows.find((item) => item.role === role);
      return {
        role,
        monthlyPriceAfn: prices[role],
        status: this.offerStatus(row, now),
        requestedAt: row?.requestedAt.toISOString() ?? null,
        activeUntil: row?.activeUntil?.toISOString() ?? null,
      };
    });
  }

  async requestRoleSubscription(
    userId: string,
    role: PaidRole,
    monthlyPriceAfn: number,
    paymentReference: string | null,
    now: Date,
  ): Promise<RoleSubscriptionOfferDto> {
    const [current] = await this.db.select().from(roleSubscriptions).where(and(
      eq(roleSubscriptions.userId, userId),
      eq(roleSubscriptions.role, role),
    )).limit(1);

    if (current && this.offerStatus(current, now) === "ACTIVE") {
      return {
        role,
        monthlyPriceAfn,
        status: "ACTIVE",
        requestedAt: current.requestedAt.toISOString(),
        activeUntil: current.activeUntil?.toISOString() ?? null,
      };
    }

    const [row] = await this.db.insert(roleSubscriptions).values({
      userId,
      role,
      status: "PENDING",
      monthlyPriceAfn,
      requestedAt: now,
      activeUntil: null,
      activatedAt: null,
      activatedByUserId: null,
      paymentReference,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [roleSubscriptions.userId, roleSubscriptions.role],
      set: {
        status: "PENDING",
        monthlyPriceAfn,
        requestedAt: now,
        activeUntil: null,
        activatedAt: null,
        activatedByUserId: null,
        paymentReference,
        updatedAt: now,
      },
    }).returning();

    if (!row) throw new Error("Role subscription request could not be saved.");
    return {
      role,
      monthlyPriceAfn,
      status: "PENDING",
      requestedAt: row.requestedAt.toISOString(),
      activeUntil: null,
    };
  }

  async listAdminRoleSubscriptions(now: Date): Promise<AdminRoleSubscriptionDto[]> {
    const rows = await this.db.select({
      userId: roleSubscriptions.userId,
      role: roleSubscriptions.role,
      status: roleSubscriptions.status,
      monthlyPriceAfn: roleSubscriptions.monthlyPriceAfn,
      requestedAt: roleSubscriptions.requestedAt,
      activeUntil: roleSubscriptions.activeUntil,
      paymentReference: roleSubscriptions.paymentReference,
      username: users.username,
      displayName: users.displayName,
    }).from(roleSubscriptions)
      .innerJoin(users, eq(roleSubscriptions.userId, users.id))
      .orderBy(desc(roleSubscriptions.requestedAt));

    return rows.map((row) => ({
      userId: row.userId,
      username: row.username,
      displayName: row.displayName,
      role: row.role as PaidRole,
      monthlyPriceAfn: row.monthlyPriceAfn,
      status: row.status === "ACTIVE" && (!row.activeUntil || row.activeUntil.getTime() <= now.getTime())
        ? "EXPIRED"
        : row.status,
      requestedAt: row.requestedAt.toISOString(),
      activeUntil: row.activeUntil?.toISOString() ?? null,
      paymentReference: row.paymentReference,
    }));
  }

  async activateRoleSubscription(input: {
    actorUserId: string;
    userId: string;
    role: PaidRole;
    monthlyPriceAfn: number;
    months: number;
    paymentReference: string | null;
    now: Date;
  }): Promise<AuthUserRecord> {
    await this.db.transaction(async (tx) => {
      const [current] = await tx.select().from(roleSubscriptions).where(and(
        eq(roleSubscriptions.userId, input.userId),
        eq(roleSubscriptions.role, input.role),
      )).limit(1);

      const base = current?.status === "ACTIVE" && current.activeUntil && current.activeUntil.getTime() > input.now.getTime()
        ? current.activeUntil
        : input.now;
      const activeUntil = new Date(base);
      activeUntil.setUTCMonth(activeUntil.getUTCMonth() + input.months);

      await tx.insert(roleSubscriptions).values({
        userId: input.userId,
        role: input.role,
        status: "ACTIVE",
        monthlyPriceAfn: input.monthlyPriceAfn,
        requestedAt: current?.requestedAt ?? input.now,
        activeUntil,
        activatedAt: input.now,
        activatedByUserId: input.actorUserId,
        paymentReference: input.paymentReference,
        updatedAt: input.now,
      }).onConflictDoUpdate({
        target: [roleSubscriptions.userId, roleSubscriptions.role],
        set: {
          status: "ACTIVE",
          monthlyPriceAfn: input.monthlyPriceAfn,
          activeUntil,
          activatedAt: input.now,
          activatedByUserId: input.actorUserId,
          paymentReference: input.paymentReference,
          updatedAt: input.now,
        },
      });

      await tx.insert(userRoles).values({ userId: input.userId, role: input.role }).onConflictDoNothing();

      await tx.insert(auditLogs).values({
        actorUserId: input.actorUserId,
        action: "PAID_ROLE_SUBSCRIPTION_ACTIVATED",
        targetType: "USER",
        targetId: input.userId,
        metadata: {
          role: input.role,
          months: input.months,
          monthlyPriceAfn: input.monthlyPriceAfn,
          paymentReference: input.paymentReference,
          activeUntil: activeUntil.toISOString(),
        },
        createdAt: input.now,
      });
    });

    const user = await this.getUserById(input.userId);
    if (!user) throw errors.unauthorized("ACCOUNT_UNAVAILABLE", "This account is unavailable.");
    return user;
  }

  async updateAccountProfile(userId: string, input: UpdateAccountProfileInput): Promise<AuthUserRecord> {
    try {
      const [row] = await this.db.update(users)
        .set({
          displayName: input.displayName,
          profileImageUrl: input.profileImageUrl,
          age: input.age,
          emailNormalized: input.emailNormalized,
          city: input.city,
          bio: input.bio,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();
      if (!row) throw errors.unauthorized("ACCOUNT_UNAVAILABLE", "This account is unavailable.");
      return this.hydrate(row);
    } catch (error) {
      const constraint = uniqueConstraint(error);
      if (constraint === "users_email_normalized_uq") {
        throw errors.conflict("EMAIL_ALREADY_EXISTS", "That email address is already in use.");
      }
      throw error;
    }
  }

  async createPasswordResetChallenge(input: {
    userId: string | null;
    phoneE164: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<PasswordResetChallengeRecord> {
    const [row] = await this.db.insert(passwordResetChallenges).values(input).returning();
    if (!row) throw new Error("Failed to create password reset challenge.");
    return row;
  }

  async getPasswordResetChallenge(id: string): Promise<PasswordResetChallengeRecord | null> {
    const [row] = await this.db.select().from(passwordResetChallenges).where(eq(passwordResetChallenges.id, id)).limit(1);
    return row ?? null;
  }

  async incrementPasswordResetAttempts(id: string): Promise<void> {
    const challenge = await this.getPasswordResetChallenge(id);
    if (!challenge) return;
    await this.db.update(passwordResetChallenges)
      .set({ attempts: challenge.attempts + 1 })
      .where(eq(passwordResetChallenges.id, id));
  }

  async verifyPasswordResetChallenge(input: {
    id: string;
    resetTokenHash: string;
    resetTokenExpiresAt: Date;
  }): Promise<void> {
    await this.db.update(passwordResetChallenges)
      .set({
        verifiedAt: new Date(),
        resetTokenHash: input.resetTokenHash,
        resetTokenExpiresAt: input.resetTokenExpiresAt,
      })
      .where(eq(passwordResetChallenges.id, input.id));
  }

  async completePasswordReset(input: {
    challengeId: string;
    userId: string;
    username: string;
    usernameNormalized: string;
    passwordHash: string;
    credentialResetAt: Date;
    cooldownCutoff: Date;
  }): Promise<AuthUserRecord> {
    try {
      await this.db.transaction(async (tx) => {
        const [updated] = await tx.update(users)
          .set({
            username: input.username,
            usernameNormalized: input.usernameNormalized,
            passwordHash: input.passwordHash,
            lastCredentialResetAt: input.credentialResetAt,
            updatedAt: input.credentialResetAt,
          })
          .where(and(
            eq(users.id, input.userId),
            or(
              isNull(users.lastCredentialResetAt),
              lte(users.lastCredentialResetAt, input.cooldownCutoff),
            ),
          ))
          .returning({ id: users.id });

        if (!updated) {
          const [current] = await tx.select({ lastCredentialResetAt: users.lastCredentialResetAt })
            .from(users)
            .where(eq(users.id, input.userId))
            .limit(1);
          if (!current) throw errors.unauthorized("ACCOUNT_UNAVAILABLE", "This account is unavailable.");

          const cooldownMs = input.credentialResetAt.getTime() - input.cooldownCutoff.getTime();
          const availableAt = current.lastCredentialResetAt
            ? new Date(current.lastCredentialResetAt.getTime() + cooldownMs).toISOString()
            : input.credentialResetAt.toISOString();
          throw errors.conflict(
            "PASSWORD_RESET_COOLDOWN",
            "Credential reset is temporarily locked.",
            { availableAt },
          );
        }

        await tx.update(passwordResetChallenges)
          .set({ consumedAt: input.credentialResetAt })
          .where(eq(passwordResetChallenges.id, input.challengeId));
        await tx.update(sessions)
          .set({ revokedAt: input.credentialResetAt, lastSeenAt: input.credentialResetAt })
          .where(eq(sessions.userId, input.userId));
      });
    } catch (error) {
      const constraint = uniqueConstraint(error);
      if (constraint === "users_username_normalized_uq") {
        throw errors.conflict("USERNAME_ALREADY_EXISTS", "That username is already registered.");
      }
      throw error;
    }

    const user = await this.getUserById(input.userId);
    if (!user) throw errors.unauthorized("ACCOUNT_UNAVAILABLE", "This account is unavailable.");
    return user;
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

  async revokeAllSessionsForUser(userId: string): Promise<void> {
    await this.db.update(sessions)
      .set({ revokedAt: new Date(), lastSeenAt: new Date() })
      .where(eq(sessions.userId, userId));
  }
}
