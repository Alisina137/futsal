import argon2 from "argon2";
import type { AccountProfileUpdateRequest, AuthResponse, LoginRequest, RegisterRequest, SelfAssignableRole } from "@leaguekick/contracts";
import { normalizeAfghanistanPhone, normalizeUsername } from "@leaguekick/contracts";
import { errors } from "../../lib/errors.js";
import type { AuthRepository, AuthUserRecord } from "./auth.types.js";
import { toUserDto } from "./auth.types.js";
import { TokenService } from "./token.service.js";

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly tokens: TokenService,
  ) {}

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
