import { randomUUID } from "node:crypto";
import { normalizeAfghanistanPhone } from "@leaguekick/contracts";
import type { AuthRepository, AuthUserRecord, CreateUserInput, PasswordResetChallengeRecord, SessionRecord } from "../src/modules/auth/auth.types.js";
import { errors } from "../src/lib/errors.js";

export class FakeAuthRepository implements AuthRepository {
  users = new Map<string, AuthUserRecord>();
  sessions = new Map<string, SessionRecord>();
  passwordResets = new Map<string, PasswordResetChallengeRecord>();

  async findUserByIdentifier(identifier: string) {
    const raw = identifier.trim();
    let phone: string | null = null;
    try {
      phone = normalizeAfghanistanPhone(raw);
    } catch {
      phone = null;
    }
    const username = raw.toLowerCase();
    return [...this.users.values()].find((user) => (phone ? user.phoneE164 === phone : user.usernameNormalized === username)) ?? null;
  }

  async getUserById(userId: string) { return this.users.get(userId) ?? null; }

  async createUser(input: CreateUserInput) {
    if ([...this.users.values()].some((user) => user.phoneE164 === input.phoneE164)) {
      throw errors.conflict("PHONE_ALREADY_EXISTS", "That phone number is already registered.");
    }
    if ([...this.users.values()].some((user) => user.usernameNormalized === input.usernameNormalized)) {
      throw errors.conflict("USERNAME_ALREADY_EXISTS", "That username is already registered.");
    }
    const user: AuthUserRecord = {
      id: randomUUID(), displayName: input.displayName, username: input.username, usernameNormalized: input.usernameNormalized,
      phoneE164: input.phoneE164, profileImageUrl: null, age: null, emailNormalized: null, city: null, bio: null,
      lastCredentialResetAt: null, passwordHash: input.passwordHash, preferredLanguage: input.preferredLanguage, status: "ACTIVE", roles: [],
    };
    this.users.set(user.id, user);
    return user;
  }

  async addRoles(userId: string, roles: import("@leaguekick/contracts").UserRole[]) {
    const user = this.users.get(userId);
    if (!user) throw errors.unauthorized("ACCOUNT_UNAVAILABLE", "This account is unavailable.");
    const next = { ...user, roles: [...new Set([...user.roles, ...roles])] };
    this.users.set(userId, next);
    return next;
  }

  async updateAccountProfile(userId: string, input: import("../src/modules/auth/auth.types.js").UpdateAccountProfileInput) {
    const user = this.users.get(userId);
    if (!user) throw errors.unauthorized("ACCOUNT_UNAVAILABLE", "This account is unavailable.");
    if (input.emailNormalized && [...this.users.values()].some((item) => item.id !== userId && item.emailNormalized === input.emailNormalized)) {
      throw errors.conflict("EMAIL_ALREADY_EXISTS", "That email address is already in use.");
    }
    const next = { ...user, ...input };
    this.users.set(userId, next);
    return next;
  }

  async createPasswordResetChallenge(input: {
    userId: string | null;
    phoneE164: string;
    codeHash: string;
    expiresAt: Date;
  }) {
    const row: PasswordResetChallengeRecord = {
      id: randomUUID(),
      userId: input.userId,
      phoneE164: input.phoneE164,
      codeHash: input.codeHash,
      expiresAt: input.expiresAt,
      attempts: 0,
      verifiedAt: null,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      consumedAt: null,
      createdAt: new Date(),
    };
    this.passwordResets.set(row.id, row);
    return row;
  }

  async getPasswordResetChallenge(id: string) {
    return this.passwordResets.get(id) ?? null;
  }

  async incrementPasswordResetAttempts(id: string) {
    const row = this.passwordResets.get(id);
    if (row) this.passwordResets.set(id, { ...row, attempts: row.attempts + 1 });
  }

  async verifyPasswordResetChallenge(input: {
    id: string;
    resetTokenHash: string;
    resetTokenExpiresAt: Date;
  }) {
    const row = this.passwordResets.get(input.id);
    if (!row) return;
    this.passwordResets.set(input.id, {
      ...row,
      verifiedAt: new Date(),
      resetTokenHash: input.resetTokenHash,
      resetTokenExpiresAt: input.resetTokenExpiresAt,
    });
  }

  async completePasswordReset(input: {
    challengeId: string;
    userId: string;
    username: string;
    usernameNormalized: string;
    passwordHash: string;
    credentialResetAt: Date;
    cooldownCutoff: Date;
  }) {
    if ([...this.users.values()].some((user) => user.id !== input.userId && user.usernameNormalized === input.usernameNormalized)) {
      throw errors.conflict("USERNAME_ALREADY_EXISTS", "That username is already registered.");
    }
    const user = this.users.get(input.userId);
    if (!user) throw errors.unauthorized("ACCOUNT_UNAVAILABLE", "This account is unavailable.");

    if (user.lastCredentialResetAt && user.lastCredentialResetAt.getTime() > input.cooldownCutoff.getTime()) {
      const cooldownMs = input.credentialResetAt.getTime() - input.cooldownCutoff.getTime();
      throw errors.conflict("PASSWORD_RESET_COOLDOWN", "Credential reset is temporarily locked.", {
        availableAt: new Date(user.lastCredentialResetAt.getTime() + cooldownMs).toISOString(),
      });
    }

    const next = {
      ...user,
      username: input.username,
      usernameNormalized: input.usernameNormalized,
      passwordHash: input.passwordHash,
      lastCredentialResetAt: input.credentialResetAt,
    };
    this.users.set(input.userId, next);
    const challenge = this.passwordResets.get(input.challengeId);
    if (challenge) this.passwordResets.set(input.challengeId, { ...challenge, consumedAt: input.credentialResetAt });
    for (const [id, session] of this.sessions) {
      if (session.userId === input.userId) this.sessions.set(id, { ...session, revokedAt: input.credentialResetAt });
    }
    return next;
  }

  async createSession(input: { userId: string; refreshTokenHash: string; expiresAt: Date; deviceLabel?: string }) {
    const row: SessionRecord = { id: randomUUID(), userId: input.userId, refreshTokenHash: input.refreshTokenHash, expiresAt: input.expiresAt, revokedAt: null };
    this.sessions.set(row.id, row); return row;
  }

  async findSessionByRefreshHash(hash: string) { return [...this.sessions.values()].find((s) => s.refreshTokenHash === hash) ?? null; }
  async rotateSession(id: string, hash: string, expiresAt: Date) { const s=this.sessions.get(id); if (s) this.sessions.set(id,{...s,refreshTokenHash:hash,expiresAt}); }
  async revokeSessionByRefreshHash(hash: string) { const s=[...this.sessions.values()].find((x)=>x.refreshTokenHash===hash); if (s) this.sessions.set(s.id,{...s,revokedAt:new Date()}); }
  async revokeAllSessionsForUser(userId: string) {
    for (const [id, session] of this.sessions) if (session.userId === userId) this.sessions.set(id, { ...session, revokedAt: new Date() });
  }
}
