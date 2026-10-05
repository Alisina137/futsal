import type { LanguageCode, UserDto, UserRole } from "@leaguekick/contracts";

export type AuthUserRecord = {
  id: string;
  displayName: string;
  username: string | null;
  usernameNormalized: string | null;
  phoneE164: string;
  profileImageUrl: string | null;
  age: number | null;
  emailNormalized: string | null;
  city: string | null;
  bio: string | null;
  lastCredentialResetAt: Date | null;
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

export type PasswordResetChallengeRecord = {
  id: string;
  userId: string | null;
  phoneE164: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  verifiedAt: Date | null;
  resetTokenHash: string | null;
  resetTokenExpiresAt: Date | null;
  consumedAt: Date | null;
  createdAt: Date;
};

export type CreateUserInput = {
  displayName: string;
  username: string;
  usernameNormalized: string;
  phoneE164: string;
  passwordHash: string;
  preferredLanguage: LanguageCode;
};

export type UpdateAccountProfileInput = {
  displayName: string;
  profileImageUrl: string | null;
  age: number | null;
  emailNormalized: string | null;
  city: string | null;
  bio: string | null;
};

export interface AuthRepository {
  findUserByIdentifier(identifier: string): Promise<AuthUserRecord | null>;
  getUserById(userId: string): Promise<AuthUserRecord | null>;
  createUser(input: CreateUserInput): Promise<AuthUserRecord>;
  addRoles(userId: string, roles: UserRole[]): Promise<AuthUserRecord>;
  updateAccountProfile(userId: string, input: UpdateAccountProfileInput): Promise<AuthUserRecord>;
  createPasswordResetChallenge(input: {
    userId: string | null;
    phoneE164: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<PasswordResetChallengeRecord>;
  getPasswordResetChallenge(id: string): Promise<PasswordResetChallengeRecord | null>;
  incrementPasswordResetAttempts(id: string): Promise<void>;
  verifyPasswordResetChallenge(input: {
    id: string;
    resetTokenHash: string;
    resetTokenExpiresAt: Date;
  }): Promise<void>;
  completePasswordReset(input: {
    challengeId: string;
    userId: string;
    username: string;
    usernameNormalized: string;
    passwordHash: string;
    credentialResetAt: Date;
    cooldownCutoff: Date;
  }): Promise<AuthUserRecord>;
  createSession(input: { userId: string; refreshTokenHash: string; expiresAt: Date; deviceLabel?: string }): Promise<SessionRecord>;
  findSessionByRefreshHash(refreshTokenHash: string): Promise<SessionRecord | null>;
  rotateSession(sessionId: string, refreshTokenHash: string, expiresAt: Date): Promise<void>;
  revokeSessionByRefreshHash(refreshTokenHash: string): Promise<void>;
  revokeAllSessionsForUser(userId: string): Promise<void>;
}

export function toUserDto(user: AuthUserRecord): UserDto {
  return {
    id: user.id,
    displayName: user.displayName,
    username: user.username,
    phone: user.phoneE164,
    profileImageUrl: user.profileImageUrl,
    age: user.age,
    email: user.emailNormalized,
    city: user.city,
    bio: user.bio,
    preferredLanguage: user.preferredLanguage,
    roles: user.roles,
    status: user.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE",
  };
}
