import type { LanguageCode, UserDto, UserRole } from "@leaguekick/contracts";

export type AuthUserRecord = {
  id: string;
  displayName: string;
  username: string | null;
  usernameNormalized: string | null;
  phoneE164: string;
  passwordHash: string;
  preferredLanguage: LanguageCode;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  roles: UserRole[];
};

export type SessionRecord = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export type CreateUserInput = {
  displayName: string;
  username: string;
  usernameNormalized: string;
  phoneE164: string;
  passwordHash: string;
  preferredLanguage: LanguageCode;
};

export interface AuthRepository {
  findUserByIdentifier(identifier: string): Promise<AuthUserRecord | null>;
  getUserById(userId: string): Promise<AuthUserRecord | null>;
  createUser(input: CreateUserInput): Promise<AuthUserRecord>;
  addRoles(userId: string, roles: UserRole[]): Promise<AuthUserRecord>;
  createSession(input: { userId: string; refreshTokenHash: string; expiresAt: Date; deviceLabel?: string }): Promise<SessionRecord>;
  findSessionByRefreshHash(refreshTokenHash: string): Promise<SessionRecord | null>;
  rotateSession(sessionId: string, refreshTokenHash: string, expiresAt: Date): Promise<void>;
  revokeSessionByRefreshHash(refreshTokenHash: string): Promise<void>;
}

export function toUserDto(user: AuthUserRecord): UserDto {
  return {
    id: user.id,
    displayName: user.displayName,
    username: user.username,
    phone: user.phoneE164,
    preferredLanguage: user.preferredLanguage,
    roles: user.roles,
    status: user.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE",
  };
}
