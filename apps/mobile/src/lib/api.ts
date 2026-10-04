import type {
  ApiErrorBody,
  AuthResponse,
  LoginRequest,
  OwnerOnboardingStatus,
  OwnerVenueSetupRequest,
  PublicVenueDto,
  PublicVenueListResponse,
  RegisterRequest,
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
  PromotionDto,
  VenuePostDto,
} from "@leaguekick/contracts";

const baseUrl = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

export class ApiRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }

  get isNetworkError() { return this.code === "NETWORK_ERROR"; }
}

async function request<T>(path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
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
    if (response.status === 204) return undefined as T;
    const body = await response.json().catch(() => null) as T | ApiErrorBody | null;
    if (!response.ok) {
      const errorBody = body as ApiErrorBody | null;
      throw new ApiRequestError(errorBody?.error?.code ?? "HTTP_ERROR", errorBody?.error?.message ?? "Request failed.", response.status);
    }
    return body as T;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    throw new ApiRequestError("NETWORK_ERROR", error instanceof Error && error.name === "AbortError" ? "The request timed out." : "Cannot reach the server.", null);
  } finally {
    clearTimeout(timeout);
  }
}

export const authApi = {
  register: (input: RegisterRequest) => request<AuthResponse>("/api/v1/auth/register", { method: "POST", body: JSON.stringify(input) }),
  login: (input: LoginRequest) => request<AuthResponse>("/api/v1/auth/login", { method: "POST", body: JSON.stringify(input) }),
  refresh: (refreshToken: string) => request<AuthResponse>("/api/v1/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) }),
  logout: (refreshToken: string) => request<void>("/api/v1/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) }),
  me: (accessToken: string) => request<{ user: UserDto }>("/api/v1/users/me", {}, accessToken),
};

export const ownerApi = {
  getStatus: (accessToken: string) => request<OwnerOnboardingStatus>("/api/v1/owner/onboarding", {}, accessToken),
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
