import type {
  AccountProfileUpdateRequest,
  AdminRoleSubscriptionActivationRequest,
  AdminRoleSubscriptionDto,
  ApiErrorBody,
  AuthResponse,
  LoginRequest,
  OwnerOnboardingStatus,
  OwnerVenueSetupRequest,
  PublicVenueDto,
  PublicVenueListResponse,
  PaidRole,
  RegisterRequest,
  RoleSubscriptionOfferDto,
  RoleSubscriptionRequest,
  PasswordResetRequest,
  PasswordResetRequestResponse,
  PasswordResetVerifyRequest,
  PasswordResetVerifyResponse,
  PasswordResetCompleteRequest,
  UserDto,
  VenueAvailabilityResponse,
  BookingDto,
  OnlineBookingRequest,
  ManualBookingRequest,
  OwnerScheduleResponse,
  VenueBlockRequest,
  FeedResponse,
  FollowStateDto,
  NotificationDto,
  NotificationPreferences,
  NotificationPreferencesUpdate,
  PromotionCreateRequest,
  PromotionDto,
  VenuePostCreateRequest,
  VenuePostDto,
  VenueRefereeDto,
  VenueRefereeGrantRequest,
  OwnPlayerProfileDto,
  PublicPlayerProfileDto,
  TeamCreateRequest,
  TeamDto,
  TeamInvitationDto,
  TeamInviteRequest,
  TeamListItemDto,
  TeamUpdateRequest,
  PlayerProfileUpdateRequest,
  TeamMemberUpdateRequest,
  CompetitionCreateRequest,
  CompetitionDto,
  CompetitionListItemDto,
  CompetitionMatchResultRequest,
  CompetitionMatchScheduleRequest,
  CompetitionRegistrationDecisionRequest,
  CompetitionRegistrationResponseRequest,
  CompetitionStateRequest,
  CompetitionTeamDto,
  CompetitionUpdateRequest,
  CompetitionInviteTeamRequest,
  OwnerBillingSummary,
  OwnerAnalyticsResponse,
  AdminDashboardResponse,
  AdminUserDto,
  AdminVenueDto,
  AdminAuditLogDto,
  PlatformSettingsDto,
  PlatformSettingsUpdateRequest,
  AdminVenueActionRequest,
  AdminUserStatusRequest,
  AdminSubscriptionActivationRequest,
  AdminTrialExtensionRequest,
  SubscriptionPaymentDto,
} from "@leaguekick/contracts";

const baseUrl = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
const REQUEST_TIMEOUT_MS = 12_000;
const READ_RETRY_DELAY_MS = 300;
const RETRYABLE_HTTP_STATUSES = new Set([502, 503, 504]);

export class ApiRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number | null,
    readonly requestId: string | null = null,
    readonly retryable: boolean = false,
    readonly details: unknown = undefined,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }

  get isNetworkError() { return this.code === "NETWORK_ERROR" || this.code === "TIMEOUT"; }
  get isTransient() { return this.isNetworkError || this.retryable; }
}

export type AccountAccessEvent = "ACCOUNT_SUSPENDED";

let accountAccessListener: ((event: AccountAccessEvent) => void) | null = null;

export function setAccountAccessListener(listener: ((event: AccountAccessEvent) => void) | null) {
  accountAccessListener = listener;
}

function isSafeRead(init: RequestInit) {
  const method = (init.method ?? "GET").toUpperCase();
  return method === "GET" || method === "HEAD";
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function request<T>(path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
  const safeRead = isSafeRead(init);
  const maxAttempts = safeRead ? 2 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(init.headers ?? {}),
        },
      });

      const requestId = response.headers.get("X-Request-Id");
      if (response.status === 204) return undefined as T;
      const body = await response.json().catch(() => null) as T | ApiErrorBody | null;
      if (!response.ok) {
        const errorBody = body as ApiErrorBody | null;
        const error = new ApiRequestError(
          errorBody?.error?.code ?? "HTTP_ERROR",
          errorBody?.error?.message ?? "Request failed.",
          response.status,
          errorBody?.error?.requestId ?? requestId,
          RETRYABLE_HTTP_STATUSES.has(response.status),
          errorBody?.error?.details,
        );
        if (error.code === "ACCOUNT_SUSPENDED") {
          accountAccessListener?.("ACCOUNT_SUSPENDED");
        }
        if (safeRead && error.retryable && attempt + 1 < maxAttempts) {
          await delay(READ_RETRY_DELAY_MS);
          continue;
        }
        throw error;
      }
      return body as T;
    } catch (error) {
      if (error instanceof ApiRequestError) throw error;
      const timedOut = error instanceof Error && error.name === "AbortError";
      const transient = new ApiRequestError(
        timedOut ? "TIMEOUT" : "NETWORK_ERROR",
        timedOut ? "The request timed out." : "Cannot reach the server.",
        null,
        null,
        true,
      );
      if (safeRead && attempt + 1 < maxAttempts) {
        await delay(READ_RETRY_DELAY_MS);
        continue;
      }
      throw transient;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new ApiRequestError("NETWORK_ERROR", "Cannot reach the server.", null, null, true);
}

async function probeApi(timeoutMs = 2_500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export const systemApi = {
  health: () => request<{ status: "ok"; service: string; version: string }>("/health"),
  probe: () => probeApi(),
  get apiHost() {
    try { return new URL(baseUrl).host; }
    catch { return "unavailable"; }
  },
};


export const authApi = {
  register: (input: RegisterRequest) => request<AuthResponse>("/api/v1/auth/register", { method: "POST", body: JSON.stringify(input) }),
  login: (input: LoginRequest) => request<AuthResponse>("/api/v1/auth/login", { method: "POST", body: JSON.stringify(input) }),
  requestPasswordReset: (input: PasswordResetRequest) =>
    request<PasswordResetRequestResponse>("/api/v1/auth/password-reset/request", { method: "POST", body: JSON.stringify(input) }),
  verifyPasswordReset: (input: PasswordResetVerifyRequest) =>
    request<PasswordResetVerifyResponse>("/api/v1/auth/password-reset/verify", { method: "POST", body: JSON.stringify(input) }),
  completePasswordReset: (input: PasswordResetCompleteRequest) =>
    request<void>("/api/v1/auth/password-reset/complete", { method: "POST", body: JSON.stringify(input) }),
  refresh: (refreshToken: string) => request<AuthResponse>("/api/v1/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) }),
  logout: (refreshToken: string) => request<void>("/api/v1/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) }),
  roleSubscriptions: (accessToken: string) =>
    request<{ offers: RoleSubscriptionOfferDto[] }>("/api/v1/auth/role-subscriptions", {}, accessToken),
  requestRoleSubscription: (accessToken: string, role: PaidRole, input: RoleSubscriptionRequest) =>
    request<{ offer: RoleSubscriptionOfferDto }>(`/api/v1/auth/role-subscriptions/${role}/request`, { method: "POST", body: JSON.stringify(input) }, accessToken),
  updateProfile: (accessToken: string, input: AccountProfileUpdateRequest) =>
    request<{ user: UserDto }>("/api/v1/users/me", { method: "PATCH", body: JSON.stringify(input) }, accessToken),
  me: (accessToken: string) => request<{ user: UserDto }>("/api/v1/users/me", {}, accessToken),
};

export const ownerApi = {
  getStatus: (accessToken: string) => request<OwnerOnboardingStatus>("/api/v1/owner/onboarding", {}, accessToken),
  referees: (accessToken: string) =>
    request<{ referees: VenueRefereeDto[] }>("/api/v1/owner/referees", {}, accessToken),
  grantReferee: (accessToken: string, input: VenueRefereeGrantRequest) =>
    request<{ referees: VenueRefereeDto[] }>("/api/v1/owner/referees", { method: "POST", body: JSON.stringify(input) }, accessToken),
  removeReferee: (accessToken: string, userId: string) =>
    request<{ referees: VenueRefereeDto[] }>(`/api/v1/owner/referees/${userId}`, { method: "DELETE" }, accessToken),
  saveSetup: (accessToken: string, input: OwnerVenueSetupRequest) =>
    request<OwnerOnboardingStatus>("/api/v1/owner/onboarding", { method: "PUT", body: JSON.stringify(input) }, accessToken),
  preview: (accessToken: string) => request<OwnerOnboardingStatus>("/api/v1/owner/venue/preview", {}, accessToken),
  startTrial: (accessToken: string) =>
    request<OwnerOnboardingStatus>("/api/v1/owner/trial/start", { method: "POST" }, accessToken),
  schedule: (accessToken: string, date: string) =>
    request<OwnerScheduleResponse>(`/api/v1/owner/schedule?date=${encodeURIComponent(date)}`, {}, accessToken),
  createManualBooking: (accessToken: string, input: ManualBookingRequest) =>
    request<{ booking: BookingDto }>("/api/v1/owner/bookings/manual", { method: "POST", body: JSON.stringify(input) }, accessToken),
  createBlock: (accessToken: string, input: VenueBlockRequest) =>
    request<{ block: import("@leaguekick/contracts").VenueBlockDto }>("/api/v1/owner/blocks", { method: "POST", body: JSON.stringify(input) }, accessToken),
  deleteBlock: (accessToken: string, blockId: string) =>
    request<void>(`/api/v1/owner/blocks/${blockId}`, { method: "DELETE" }, accessToken),
  cancelBooking: (accessToken: string, bookingId: string, reason?: string) =>
    request<{ booking: BookingDto }>(`/api/v1/owner/bookings/${bookingId}/cancel`, { method: "POST", body: JSON.stringify({ reason: reason ?? "" }) }, accessToken),
  promotions: (accessToken: string) =>
    request<{ promotions: PromotionDto[]; generatedAt: string }>("/api/v1/owner/promotions", {}, accessToken),
  createPromotion: (accessToken: string, input: PromotionCreateRequest) =>
    request<{ promotion: PromotionDto }>("/api/v1/owner/promotions", { method: "POST", body: JSON.stringify(input) }, accessToken),
  closePromotion: (accessToken: string, promotionId: string) =>
    request<{ promotion: PromotionDto }>(`/api/v1/owner/promotions/${promotionId}/close`, { method: "POST" }, accessToken),
  posts: (accessToken: string) =>
    request<{ posts: VenuePostDto[]; generatedAt: string }>("/api/v1/owner/posts", {}, accessToken),
  createPost: (accessToken: string, input: VenuePostCreateRequest) =>
    request<{ post: VenuePostDto }>("/api/v1/owner/posts", { method: "POST", body: JSON.stringify(input) }, accessToken),
  publishPost: (accessToken: string, postId: string) =>
    request<{ post: VenuePostDto }>(`/api/v1/owner/posts/${postId}/publish`, { method: "POST" }, accessToken),
  unpublishPost: (accessToken: string, postId: string) =>
    request<{ post: VenuePostDto }>(`/api/v1/owner/posts/${postId}/unpublish`, { method: "POST" }, accessToken),
  subscription: (accessToken: string) =>
    request<OwnerBillingSummary>("/api/v1/owner/subscription", {}, accessToken),
  requestReactivation: (accessToken: string) =>
    request<{ requested: boolean }>("/api/v1/owner/subscription/reactivation-request", { method: "POST" }, accessToken),
  analytics: (accessToken: string, from: string, to: string) =>
    request<OwnerAnalyticsResponse>(`/api/v1/owner/analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {}, accessToken),
};


export const venueApi = {
  list: (filters?: { city?: string; province?: string }) => {
    const params = new URLSearchParams();
    if (filters?.city) params.set("city", filters.city);
    if (filters?.province) params.set("province", filters.province);
    const query = params.toString();
    return request<PublicVenueListResponse>(`/api/v1/venues${query ? `?${query}` : ""}`);
  },
  get: (venueId: string) => request<{ venue: PublicVenueDto }>(`/api/v1/venues/${venueId}`),
  availability: (venueId: string, date: string) =>
    request<VenueAvailabilityResponse>(`/api/v1/venues/${venueId}/availability?date=${encodeURIComponent(date)}`),
};

export const bookingApi = {
  create: (accessToken: string, input: OnlineBookingRequest) =>
    request<{ booking: BookingDto }>("/api/v1/bookings", { method: "POST", body: JSON.stringify(input) }, accessToken),
  mine: (accessToken: string) =>
    request<{ bookings: BookingDto[]; generatedAt: string }>("/api/v1/bookings/me", {}, accessToken),
  cancel: (accessToken: string, bookingId: string, reason?: string) =>
    request<{ booking: BookingDto }>(`/api/v1/bookings/${bookingId}/cancel`, { method: "POST", body: JSON.stringify({ reason: reason ?? "" }) }, accessToken),
};


export const marketingApi = {
  feed: (accessToken?: string, followingOnly = false) =>
    request<FeedResponse>(followingOnly ? "/api/v1/feed/following" : "/api/v1/feed", {}, followingOnly ? accessToken : undefined),
  followState: (accessToken: string, venueId: string) =>
    request<FollowStateDto>(`/api/v1/venues/${venueId}/follow`, {}, accessToken),
  follow: (accessToken: string, venueId: string) =>
    request<FollowStateDto>(`/api/v1/venues/${venueId}/follow`, { method: "POST" }, accessToken),
  unfollow: (accessToken: string, venueId: string) =>
    request<FollowStateDto>(`/api/v1/venues/${venueId}/follow`, { method: "DELETE" }, accessToken),
  post: (postId: string) => request<{ post: VenuePostDto }>(`/api/v1/posts/${postId}`),
  promotion: (promotionId: string) => request<{ promotion: PromotionDto }>(`/api/v1/promotions/${promotionId}`),
};

export const notificationApi = {
  list: (accessToken: string) =>
    request<{ notifications: NotificationDto[]; generatedAt: string }>("/api/v1/notifications", {}, accessToken),
  markRead: (accessToken: string, notificationId: string) =>
    request<{ notification: NotificationDto }>(`/api/v1/notifications/${notificationId}/read`, { method: "POST" }, accessToken),
  preferences: (accessToken: string) =>
    request<{ preferences: NotificationPreferences }>("/api/v1/notifications/preferences", {}, accessToken),
  updatePreferences: (accessToken: string, input: NotificationPreferencesUpdate) =>
    request<{ preferences: NotificationPreferences }>("/api/v1/notifications/preferences", { method: "PATCH", body: JSON.stringify(input) }, accessToken),
};


export const teamApi = {
  myProfile: (accessToken: string) =>
    request<{ player: OwnPlayerProfileDto }>("/api/v1/players/me", {}, accessToken),
  updateMyProfile: (accessToken: string, input: PlayerProfileUpdateRequest) =>
    request<{ player: OwnPlayerProfileDto }>("/api/v1/players/me", { method: "PATCH", body: JSON.stringify(input) }, accessToken),
  publicPlayer: (playerId: string) =>
    request<{ player: PublicPlayerProfileDto }>(`/api/v1/players/${playerId}`),
  mine: (accessToken: string) =>
    request<{ teams: TeamListItemDto[] }>("/api/v1/teams/mine", {}, accessToken),
  create: (accessToken: string, input: TeamCreateRequest) =>
    request<{ team: TeamDto }>("/api/v1/teams", { method: "POST", body: JSON.stringify(input) }, accessToken),
  publicTeam: (teamId: string) =>
    request<{ team: TeamDto }>(`/api/v1/teams/${teamId}`),
  roster: (accessToken: string, teamId: string) =>
    request<{ team: TeamDto }>(`/api/v1/teams/${teamId}/roster`, {}, accessToken),
  update: (accessToken: string, teamId: string, input: TeamUpdateRequest) =>
    request<{ team: TeamDto }>(`/api/v1/teams/${teamId}`, { method: "PATCH", body: JSON.stringify(input) }, accessToken),
  updateMember: (accessToken: string, teamId: string, userId: string, input: TeamMemberUpdateRequest) =>
    request<{ team: TeamDto }>(`/api/v1/teams/${teamId}/members/${userId}`, { method: "PATCH", body: JSON.stringify(input) }, accessToken),
  removeMember: (accessToken: string, teamId: string, userId: string) =>
    request<{ team: TeamDto }>(`/api/v1/teams/${teamId}/members/${userId}`, { method: "DELETE" }, accessToken),
  setCaptain: (accessToken: string, teamId: string, userId: string | null) =>
    request<{ team: TeamDto }>(`/api/v1/teams/${teamId}/captain`, { method: "POST", body: JSON.stringify({ userId }) }, accessToken),
  transferManager: (accessToken: string, teamId: string, userId: string) =>
    request<{ team: TeamDto }>(`/api/v1/teams/${teamId}/manager`, { method: "POST", body: JSON.stringify({ userId }) }, accessToken),
  invitations: (accessToken: string) =>
    request<{ invitations: TeamInvitationDto[] }>("/api/v1/teams/invitations", {}, accessToken),
  teamInvitations: (accessToken: string, teamId: string) =>
    request<{ invitations: TeamInvitationDto[] }>(`/api/v1/teams/${teamId}/invitations`, {}, accessToken),
  invite: (accessToken: string, teamId: string, input: TeamInviteRequest) =>
    request<{ invitation: TeamInvitationDto }>(`/api/v1/teams/${teamId}/invitations`, { method: "POST", body: JSON.stringify(input) }, accessToken),
  acceptInvitation: (accessToken: string, invitationId: string) =>
    request<{ invitation: TeamInvitationDto }>(`/api/v1/teams/invitations/${invitationId}/accept`, { method: "POST" }, accessToken),
  declineInvitation: (accessToken: string, invitationId: string) =>
    request<{ invitation: TeamInvitationDto }>(`/api/v1/teams/invitations/${invitationId}/decline`, { method: "POST" }, accessToken),
  revokeInvitation: (accessToken: string, teamId: string, invitationId: string) =>
    request<{ invitation: TeamInvitationDto }>(`/api/v1/teams/${teamId}/invitations/${invitationId}`, { method: "DELETE" }, accessToken),
};



export const adminApi = {
  dashboard: (accessToken: string) =>
    request<AdminDashboardResponse>("/api/v1/admin/dashboard", {}, accessToken),
  users: (accessToken: string, q = "") =>
    request<{ users: AdminUserDto[] }>(`/api/v1/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`, {}, accessToken),
  setUserStatus: (accessToken: string, userId: string, input: AdminUserStatusRequest) =>
    request<{ updated: boolean }>(`/api/v1/admin/users/${userId}/status`, { method: "PATCH", body: JSON.stringify(input) }, accessToken),
  roleSubscriptions: (accessToken: string) =>
    request<{ subscriptions: AdminRoleSubscriptionDto[] }>("/api/v1/admin/role-subscriptions", {}, accessToken),
  activateRoleSubscription: (accessToken: string, userId: string, role: PaidRole, input: AdminRoleSubscriptionActivationRequest) =>
    request<{ user: UserDto }>(`/api/v1/admin/role-subscriptions/${userId}/${role}/activate`, { method: "POST", body: JSON.stringify(input) }, accessToken),
  venues: (accessToken: string, q = "") =>
    request<{ venues: AdminVenueDto[] }>(`/api/v1/admin/venues${q ? `?q=${encodeURIComponent(q)}` : ""}`, {}, accessToken),
  duplicateVenues: (accessToken: string) =>
    request<{ groups: AdminVenueDto[][] }>("/api/v1/admin/venues/duplicates", {}, accessToken),
  venueAction: (accessToken: string, venueId: string, input: AdminVenueActionRequest) =>
    request<{ updated: boolean }>(`/api/v1/admin/venues/${venueId}/action`, { method: "POST", body: JSON.stringify(input) }, accessToken),
  activateSubscription: (accessToken: string, venueId: string, input: AdminSubscriptionActivationRequest) =>
    request<{ activated: boolean }>(`/api/v1/admin/venues/${venueId}/subscription/activate`, { method: "POST", body: JSON.stringify(input) }, accessToken),
  extendTrial: (accessToken: string, venueId: string, input: AdminTrialExtensionRequest) =>
    request<{ extended: boolean }>(`/api/v1/admin/venues/${venueId}/trial/extend`, { method: "POST", body: JSON.stringify(input) }, accessToken),
  payments: (accessToken: string, venueId: string) =>
    request<{ payments: SubscriptionPaymentDto[] }>(`/api/v1/admin/venues/${venueId}/payments`, {}, accessToken),
  settings: (accessToken: string) =>
    request<{ settings: PlatformSettingsDto }>("/api/v1/admin/settings", {}, accessToken),
  updateSettings: (accessToken: string, input: PlatformSettingsUpdateRequest) =>
    request<{ settings: PlatformSettingsDto }>("/api/v1/admin/settings", { method: "PUT", body: JSON.stringify(input) }, accessToken),
  audit: (accessToken: string) =>
    request<{ logs: AdminAuditLogDto[] }>("/api/v1/admin/audit", {}, accessToken),
  supportNote: (accessToken: string, targetType: "USER" | "VENUE", targetId: string, note: string) =>
    request<{ created: boolean }>("/api/v1/admin/support-notes", { method: "POST", body: JSON.stringify({ targetType, targetId, note }) }, accessToken),
  voidPayment: (accessToken: string, paymentId: string, reason: string) =>
    request<{ voided: boolean }>(`/api/v1/admin/payments/${paymentId}/void`, { method: "POST", body: JSON.stringify({ reason }) }, accessToken),
  unpublishPost: (accessToken: string, postId: string, reason: string) =>
    request<{ unpublished: boolean }>(`/api/v1/admin/content/posts/${postId}/unpublish`, { method: "POST", body: JSON.stringify({ reason }) }, accessToken),
  closePromotion: (accessToken: string, promotionId: string, reason: string) =>
    request<{ closed: boolean }>(`/api/v1/admin/content/promotions/${promotionId}/close`, { method: "POST", body: JSON.stringify({ reason }) }, accessToken),
};

export const competitionApi = {
  list: () =>
    request<{ generatedAt: string; competitions: CompetitionListItemDto[] }>("/api/v1/competitions"),
  get: (competitionId: string) =>
    request<{ competition: CompetitionDto }>(`/api/v1/competitions/${competitionId}`),
  register: (accessToken: string, competitionId: string, teamId: string) =>
    request<{ registration: CompetitionTeamDto | null }>(
      `/api/v1/competitions/${competitionId}/register`,
      { method: "POST", body: JSON.stringify({ teamId }) },
      accessToken,
    ),
  respondInvitation: (
    accessToken: string,
    competitionId: string,
    teamId: string,
    input: CompetitionRegistrationResponseRequest,
  ) =>
    request<{ registration: CompetitionTeamDto | null }>(
      `/api/v1/competitions/${competitionId}/invitations/${teamId}/respond`,
      { method: "POST", body: JSON.stringify(input) },
      accessToken,
    ),
  withdraw: (accessToken: string, competitionId: string, teamId: string) =>
    request<{ registration: CompetitionTeamDto | null }>(
      `/api/v1/competitions/${competitionId}/teams/${teamId}/withdraw`,
      { method: "POST" },
      accessToken,
    ),

  ownerList: (accessToken: string) =>
    request<{ competitions: CompetitionListItemDto[] }>("/api/v1/owner/competitions", {}, accessToken),
  ownerGet: (accessToken: string, competitionId: string) =>
    request<{ competition: CompetitionDto }>(`/api/v1/owner/competitions/${competitionId}`, {}, accessToken),
  create: (accessToken: string, input: CompetitionCreateRequest) =>
    request<{ competition: CompetitionDto }>(
      "/api/v1/owner/competitions",
      { method: "POST", body: JSON.stringify(input) },
      accessToken,
    ),
  update: (accessToken: string, competitionId: string, input: CompetitionUpdateRequest) =>
    request<{ competition: CompetitionDto }>(
      `/api/v1/owner/competitions/${competitionId}`,
      { method: "PATCH", body: JSON.stringify(input) },
      accessToken,
    ),
  changeState: (accessToken: string, competitionId: string, input: CompetitionStateRequest) =>
    request<{ competition: CompetitionDto }>(
      `/api/v1/owner/competitions/${competitionId}/state`,
      { method: "POST", body: JSON.stringify(input) },
      accessToken,
    ),
  scheduleMatch: (
    accessToken: string,
    competitionId: string,
    matchId: string,
    input: CompetitionMatchScheduleRequest,
  ) =>
    request<{ competition: CompetitionDto }>(
      `/api/v1/owner/competitions/${competitionId}/matches/${matchId}/schedule`,
      { method: "PUT", body: JSON.stringify(input) },
      accessToken,
    ),
  enterResult: (
    accessToken: string,
    competitionId: string,
    matchId: string,
    input: CompetitionMatchResultRequest,
  ) =>
    request<{ competition: CompetitionDto }>(
      `/api/v1/owner/competitions/${competitionId}/matches/${matchId}/result`,
      { method: "PUT", body: JSON.stringify(input) },
      accessToken,
    ),
  inviteTeam: (
    accessToken: string,
    competitionId: string,
    input: CompetitionInviteTeamRequest,
  ) =>
    request<{ registration: CompetitionTeamDto | null }>(
      `/api/v1/owner/competitions/${competitionId}/invitations`,
      { method: "POST", body: JSON.stringify(input) },
      accessToken,
    ),
  decideRegistration: (
    accessToken: string,
    competitionId: string,
    teamId: string,
    input: CompetitionRegistrationDecisionRequest,
  ) =>
    request<{ registration: CompetitionTeamDto | null }>(
      `/api/v1/owner/competitions/${competitionId}/registrations/${teamId}`,
      { method: "PATCH", body: JSON.stringify(input) },
      accessToken,
    ),
};
