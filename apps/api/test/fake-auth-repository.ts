import { randomUUID } from "node:crypto";
import { normalizeAfghanistanPhone } from "@leaguekick/contracts";
import type { AuthRepository, AuthUserRecord, CreateUserInput, SessionRecord } from "../src/modules/auth/auth.types.js";
import { errors } from "../src/lib/errors.js";

export class FakeAuthRepository implements AuthRepository {
  users = new Map<string, AuthUserRecord>();
  sessions = new Map<string, SessionRecord>();

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
    if ([...this.users.values()].some((user) => user.phoneE164 === input.phoneE164 || (input.usernameNormalized && user.usernameNormalized === input.usernameNormalized))) {
      throw errors.conflict("IDENTITY_ALREADY_EXISTS", "That phone number or username is already registered.");
    }
    const user: AuthUserRecord = {
      id: randomUUID(), displayName: input.displayName, username: input.username, usernameNormalized: input.usernameNormalized,
      phoneE164: input.phoneE164, passwordHash: input.passwordHash, preferredLanguage: input.preferredLanguage,
      status: "ACTIVE", roles: [],
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

  async createSession(input: { userId: string; refreshTokenHash: string; expiresAt: Date; deviceLabel?: string }) {
    const row: SessionRecord = { id: randomUUID(), userId: input.userId, refreshTokenHash: input.refreshTokenHash, expiresAt: input.expiresAt, revokedAt: null };
    this.sessions.set(row.id, row); return row;
  }

  async findSessionByRefreshHash(hash: string) { return [...this.sessions.values()].find((s) => s.refreshTokenHash === hash) ?? null; }
  async rotateSession(id: string, hash: string, expiresAt: Date) { const s=this.sessions.get(id); if (s) this.sessions.set(id,{...s,refreshTokenHash:hash,expiresAt}); }
  async revokeSessionByRefreshHash(hash: string) { const s=[...this.sessions.values()].find((x)=>x.refreshTokenHash===hash); if (s) this.sessions.set(s.id,{...s,revokedAt:new Date()}); }
}
