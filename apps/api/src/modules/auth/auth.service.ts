import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import type {
  AccountProfileUpdateRequest,
  AuthResponse,
  LoginRequest,
  PasswordResetCompleteRequest,
  PasswordResetRequest,
  PasswordResetRequestResponse,
  PasswordResetVerifyRequest,
  PasswordResetVerifyResponse,
  RegisterRequest,
  SelfAssignableRole,
} from "@leaguekick/contracts";
import { normalizeAfghanistanPhone, normalizeUsername } from "@leaguekick/contracts";
import { errors } from "../../lib/errors.js";
import type { AuthRepository, AuthUserRecord } from "./auth.types.js";
import { toUserDto } from "./auth.types.js";
import { TokenService } from "./token.service.js";

type AuthServiceOptions = {
  passwordResetSecret?: string;
  passwordResetCodeTtlMs?: number;
  passwordResetTokenTtlMs?: number;
  deliverPasswordResetCode?: (phoneE164: string, code: string) => Promise<void>;
  exposePasswordResetCode?: boolean;
};

export class AuthService {
  private readonly resetSecret: string | null;
  private readonly resetCodeTtlMs: number;
  private readonly resetTokenTtlMs: number;
  private readonly deliverPasswordResetCode: ((phoneE164: string, code: string) => Promise<void>) | undefined;
  private readonly exposePasswordResetCode: boolean;

  constructor(
    private readonly repository: AuthRepository,
    private readonly tokens: TokenService,
    options: AuthServiceOptions = {},
  ) {
    this.resetSecret = options.passwordResetSecret ?? null;
    this.resetCodeTtlMs = options.passwordResetCodeTtlMs ?? 10 * 60 * 1000;
    this.resetTokenTtlMs = options.passwordResetTokenTtlMs ?? 10 * 60 * 1000;
    this.deliverPasswordResetCode = options.deliverPasswordResetCode;
    this.exposePasswordResetCode = options.exposePasswordResetCode ?? false;
  }

  private hashResetValue(value: string) {
    if (!this.resetSecret) throw errors.forbidden("PASSWORD_RESET_DISABLED", "Password reset is not configured.");
    return createHmac("sha256", this.resetSecret).update(value).digest("hex");
  }

  private resetValueMatches(value: string, expectedHash: string) {
    const actual = Buffer.from(this.hashResetValue(value), "hex");
    const expected = Buffer.from(expectedHash, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  private ensureActive(user: AuthUserRecord) {
    if (user.status === "SUSPENDED") throw errors.forbidden("ACCOUNT_SUSPENDED", "This account is suspended.");
    if (user.status === "DELETED") throw errors.unauthorized("ACCOUNT_UNAVAILABLE", "This account is unavailable.");
  }

  private async createAuthResponse(user: AuthUserRecord, deviceLabel?: string): Promise<AuthResponse> {
    const access = await this.tokens.createAccessToken(user.id, user.roles);
    const refresh = this.tokens.createRefreshToken();
    await this.repository.createSession({
      userId: user.id,
      refreshTokenHash: refresh.hash,
      expiresAt: refresh.expiresAt,
      ...(deviceLabel ? { deviceLabel } : {}),
    });
    return {
      accessToken: access.token,
      refreshToken: refresh.token,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshTokenExpiresAt: refresh.expiresAt.toISOString(),
      user: toUserDto(user),
    };
  }

  async register(input: RegisterRequest, deviceLabel?: string): Promise<AuthResponse> {
    let phoneE164: string;
    try {
      phoneE164 = normalizeAfghanistanPhone(input.phone);
    } catch {
      throw errors.badRequest("INVALID_PHONE", "Enter a valid Afghanistan phone number.");
    }
    const username = input.username.trim();
    const usernameNormalized = normalizeUsername(username);
    if (!usernameNormalized) {
      throw errors.badRequest("INVALID_USERNAME", "Enter a valid username.");
    }
    const passwordHash = await argon2.hash(input.password);
    const user = await this.repository.createUser({
      displayName: username,
      username,
      usernameNormalized,
      phoneE164,
      passwordHash,
      preferredLanguage: input.preferredLanguage,
    });
    return this.createAuthResponse(user, deviceLabel);
  }

  async activateSelfRole(userId: string, role: SelfAssignableRole) {
    const user = await this.repository.getUserById(userId);
    if (!user) throw errors.unauthorized("ACCOUNT_UNAVAILABLE", "This account is unavailable.");
    this.ensureActive(user);

    const roles = role === "TEAM_MANAGER"
      ? (["PLAYER", "TEAM_MANAGER"] as const)
      : ([role] as const);
    return toUserDto(await this.repository.addRoles(userId, [...roles]));
  }

  async updateProfile(userId: string, input: AccountProfileUpdateRequest) {
    const user = await this.repository.getUserById(userId);
    if (!user) throw errors.unauthorized("ACCOUNT_UNAVAILABLE", "This account is unavailable.");
    this.ensureActive(user);
    return toUserDto(await this.repository.updateDisplayName(userId, input.displayName.trim()));
  }

  async requestPasswordReset(input: PasswordResetRequest): Promise<PasswordResetRequestResponse> {
    if (!this.resetSecret) throw errors.forbidden("PASSWORD_RESET_DISABLED", "Password reset is not configured.");

    let phoneE164: string;
    try {
      phoneE164 = normalizeAfghanistanPhone(input.phone);
    } catch {
      throw errors.badRequest("INVALID_PHONE", "Enter a valid Afghanistan phone number.");
    }

    const user = await this.repository.findUserByIdentifier(phoneE164);
    const eligibleUser = user && user.status !== "DELETED" ? user : null;
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const expiresAt = new Date(Date.now() + this.resetCodeTtlMs);
    const challenge = await this.repository.createPasswordResetChallenge({
      userId: eligibleUser?.id ?? null,
      phoneE164,
      codeHash: this.hashResetValue(code),
      expiresAt,
    });

    if (eligibleUser) {
      if (!this.deliverPasswordResetCode && !this.exposePasswordResetCode) {
        throw errors.forbidden("PASSWORD_RESET_DELIVERY_UNAVAILABLE", "Password reset delivery is not configured.");
      }
      if (this.deliverPasswordResetCode) {
        try {
          await this.deliverPasswordResetCode(phoneE164, code);
        } catch {
          throw errors.badRequest("PASSWORD_RESET_DELIVERY_FAILED", "The verification code could not be sent.");
        }
      }
    }

    return {
      requestId: challenge.id,
      expiresAt: expiresAt.toISOString(),
      ...(this.exposePasswordResetCode ? { debugCode: code } : {}),
    };
  }

  async verifyPasswordReset(input: PasswordResetVerifyRequest): Promise<PasswordResetVerifyResponse> {
    const challenge = await this.repository.getPasswordResetChallenge(input.requestId);
    const invalid = () => errors.badRequest("INVALID_RESET_CODE", "The verification code is invalid or expired.");

    if (
      !challenge ||
      challenge.consumedAt ||
      challenge.expiresAt.getTime() <= Date.now() ||
      challenge.attempts >= 5
    ) {
      throw invalid();
    }

    if (!this.resetValueMatches(input.code, challenge.codeHash) || !challenge.userId) {
      await this.repository.incrementPasswordResetAttempts(input.requestId);
      throw invalid();
    }

    const user = await this.repository.getUserById(challenge.userId);
    if (!user) throw invalid();
    this.ensureActive(user);

    const resetToken = randomBytes(32).toString("hex");
    const resetTokenExpiresAt = new Date(Date.now() + this.resetTokenTtlMs);
    await this.repository.verifyPasswordResetChallenge({
      id: challenge.id,
      resetTokenHash: this.hashResetValue(resetToken),
      resetTokenExpiresAt,
    });

    return {
      requestId: challenge.id,
      resetToken,
      resetTokenExpiresAt: resetTokenExpiresAt.toISOString(),
      username: user.username ?? "",
      phone: user.phoneE164,
    };
  }

  async completePasswordReset(input: PasswordResetCompleteRequest): Promise<void> {
    const challenge = await this.repository.getPasswordResetChallenge(input.requestId);
    if (
      !challenge ||
      !challenge.userId ||
      !challenge.verifiedAt ||
      !challenge.resetTokenHash ||
      !challenge.resetTokenExpiresAt ||
      challenge.resetTokenExpiresAt.getTime() <= Date.now() ||
      challenge.consumedAt ||
      !this.resetValueMatches(input.resetToken, challenge.resetTokenHash)
    ) {
      throw errors.badRequest("INVALID_RESET_TOKEN", "The password reset session is invalid or expired.");
    }

    const username = input.username.trim();
    const usernameNormalized = normalizeUsername(username);
    if (!usernameNormalized) throw errors.badRequest("INVALID_USERNAME", "Enter a valid username.");

    const passwordHash = await argon2.hash(input.password);
    await this.repository.completePasswordReset({
      challengeId: challenge.id,
      userId: challenge.userId,
      username,
      usernameNormalized,
      passwordHash,
    });
  }

  async login(input: LoginRequest, deviceLabel?: string): Promise<AuthResponse> {
    const user = await this.repository.findUserByIdentifier(input.identifier);
    if (!user || !(await argon2.verify(user.passwordHash, input.password))) {
      throw errors.unauthorized("INVALID_CREDENTIALS", "The identifier or password is incorrect.");
    }
    this.ensureActive(user);
    return this.createAuthResponse(user, deviceLabel);
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const currentHash = this.tokens.hashRefreshToken(refreshToken);
    const session = await this.repository.findSessionByRefreshHash(currentHash);
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw errors.unauthorized("INVALID_REFRESH_TOKEN", "The session is invalid or expired.");
    }
    const user = await this.repository.getUserById(session.userId);
    if (!user) throw errors.unauthorized("ACCOUNT_UNAVAILABLE", "This account is unavailable.");
    this.ensureActive(user);

    const access = await this.tokens.createAccessToken(user.id, user.roles);
    const nextRefresh = this.tokens.createRefreshToken();
    await this.repository.rotateSession(session.id, nextRefresh.hash, nextRefresh.expiresAt);
    return {
      accessToken: access.token,
      refreshToken: nextRefresh.token,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshTokenExpiresAt: nextRefresh.expiresAt.toISOString(),
      user: toUserDto(user),
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.repository.revokeSessionByRefreshHash(this.tokens.hashRefreshToken(refreshToken));
  }

  async me(userId: string) {
    const user = await this.repository.getUserById(userId);
    if (!user) throw errors.unauthorized("ACCOUNT_UNAVAILABLE", "This account is unavailable.");
    this.ensureActive(user);
    return toUserDto(user);
  }
}
