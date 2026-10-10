import type {
  AccountProfileUpdateRequest,
  AdminRoleSubscriptionActivationRequest,
  AdminRoleSubscriptionDto,
  ApiErrorBody,
  AuthResponse,
  LoginRequest,
  OwnerOnboardingStatus,
  OwnerVenueSettingsDto,
  OwnerVenueSettingsUpdateRequest,
  OwnerVenueSetupRequest,
  PublicVenueDto,
  PublicVenueListResponse,
  MostFollowedVenuesResponse,
  NearbyVenuesResponse,
  VenueDiscoveryResponse,
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
  VenueTimetableDraftRequest,
  VenueTimetableExceptionRequest,
  VenueTimetableListResponse,
  VenueTimetablePublishResponse,
  VenueTimetableCalendarResponse,
  VenueBlockRequest,
  FeedResponse,
  FollowStateDto,
  SocialEntityType,
  SocialFeedPostDto,
  SocialFeedResponse,
  FollowedVenuesResponse,
  SocialFollowStateDto,
  SocialDirectoryDiscoveryResponse,
  SocialPostCommentCreateRequest,
  SocialPostCommentUpdateRequest,
  SocialPostCommentDto,
  SocialUserPostCreateRequest,
  NotificationDto,
  NotificationListFilter,
  NotificationListResponse,
  NotificationPreferences,
  NotificationPreferencesUpdate,
  PromotionCreateRequest,
  PromotionDto,
  VenuePostCreateRequest,
  VenuePostDto,
  VenueMediaAssetDto,
  VenueMediaAssetPurpose,
  VenueMediaPageDto,
  VenueMediaPageUpdateRequest,
  VenueRefereeDto,
  VenueRefereeGrantRequest,
  OwnPlayerProfileDto,
  PublicPlayerProfileDto,
  TeamCreateRequest,
  TeamDirectoryItemDto,
  TeamDto,
  TeamInvitationDto,
  TeamInviteRequest,
  TeamJoinRequestDto,
  TeamListItemDto,
  ManualTeamDto,
  AdminManualTeamDto,
  ManualTeamCreateRequest,
  ManualTeamUpdateRequest,
  ManualTeamClaimRequest,
  TeamUpdateRequest,
  PlayerProfileUpdateRequest,
  TeamMemberUpdateRequest,
  CompetitionCreateRequest,
  CompetitionDto,
  CompetitionRewardsUpdateRequest,
  CompetitionPublicMatchDetail,
  CompetitionFeeUpdateRequest,
  CompetitionListItemDto,
  CompetitionMediaPostCreateRequest,
  CompetitionMediaPostDto,
  CompetitionMediaPostStatusRequest,
  CompetitionMatchResultRequest,
  CompetitionMatchScheduleRequest,
  CompetitionRegistrationDecisionRequest,
  CompetitionRegistrationResponseRequest,
  CompetitionSeedUpdateRequest,
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
import { fetch as expoFetch } from "expo/fetch";
import { File, Paths } from "expo-file-system";
import { cachedApiRead, invalidateApiCacheAfterMutation } from "./api-cache";

const baseUrl = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
const REQUEST_TIMEOUT_MS = 12_000;
const READ_RETRY_DELAY_MS = 300;
const RETRYABLE_HTTP_STATUSES = new Set([502, 503, 504]);

export function resolveMediaImageUrl(value:string|null|undefined){
  if(!value)return null;
  if(/^https?:\/\//i.test(value))return value;
  return value.startsWith("/")?`${baseUrl}${value}`:value;
}

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

async function networkRequest<T>(path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
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

async function request<T>(path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
  if (isSafeRead(init)) {
    return cachedApiRead(path, accessToken, () => networkRequest<T>(path, init, accessToken));
  }

  const value = await networkRequest<T>(path, init, accessToken);
  await invalidateApiCacheAfterMutation(path, accessToken);
  return value;
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

export type LocalMediaUpload = {
  uri:string;
  mimeType:string;
  size?:number|null;
};

async function uploadNativeImage<T extends {asset:VenueMediaAssetDto}|{user:UserDto}|{imageUrl:string}>(
  accessToken:string,
  source:LocalMediaUpload,
  destination:string,
):Promise<T>{
  let file:File;
  let stagedFile:File|null=null;
  try{
    file=new File(source.uri);
    if(!file.exists)throw new Error("The selected image is not accessible.");
    // Native fetch requires an app-readable file, not a short-lived Android content URI.
    if(source.uri.startsWith("content://")){
      const kind=source.mimeType.split(";")[0]?.toLowerCase();
      const extension=kind==="image/png"?"png":kind==="image/webp"?"webp":kind==="image/heic"?"heic":kind==="image/heif"?"heif":"jpg";
      stagedFile=new File(Paths.cache,`futsal-media-${Date.now()}-${Math.floor(Math.random()*1e9)}.${extension}`);
      file.copy(stagedFile);
      file=stagedFile;
    }
  }catch{
    if(stagedFile?.exists)stagedFile.delete();
    throw new ApiRequestError("MEDIA_READ_ERROR","The selected image could not be opened. Download it to your device and try again.",null,null,false);
  }

  const byteSize=file.size;
  if(!byteSize||byteSize<=0){
    if(stagedFile?.exists)stagedFile.delete();
    throw new ApiRequestError("MEDIA_EMPTY","Choose a non-empty image.",400,null,false);
  }
  if(byteSize>6*1024*1024){
    if(stagedFile?.exists)stagedFile.delete();
    throw new ApiRequestError("MEDIA_TOO_LARGE","Images must be 6 MB or smaller.",413,null,false);
  }
  const supportedTypes=new Set(["image/jpeg","image/png","image/webp","image/heic","image/heif"]);
  const reportedType=source.mimeType?.split(";")[0]?.trim().toLowerCase();
  const detectedType=file.type?.split(";")[0]?.trim().toLowerCase();
  const mimeType=(reportedType&&supportedTypes.has(reportedType)?reportedType:detectedType)??"";
  if(!supportedTypes.has(mimeType)){
    if(stagedFile?.exists)stagedFile.delete();
    throw new ApiRequestError("MEDIA_TYPE_NOT_ALLOWED","Choose a JPG, PNG, WEBP, HEIC or HEIF image.",400,null,false);
  }
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),30_000);
  try{
    const response=await expoFetch(`${baseUrl}${destination}`,{
      method:"POST",
      headers:{
        Authorization:`Bearer ${accessToken}`,
        "Content-Type":mimeType,
        Accept:"application/json",
      },
      body:file,
      signal:controller.signal,
    });
    const body=await response.json().catch(()=>null) as T|ApiErrorBody|null;
    if(!response.ok){
      const errorBody=body as ApiErrorBody|null;
      throw new ApiRequestError(
        errorBody?.error?.code??"HTTP_ERROR",
        errorBody?.error?.message??"Upload failed.",
        response.status,
        errorBody?.error?.requestId??response.headers.get("X-Request-Id"),
        false,
        errorBody?.error?.details,
      );
    }
    if(!body||(!("asset" in body)&&!("user" in body)&&!("imageUrl" in body))){
      throw new ApiRequestError("INVALID_UPLOAD_RESPONSE","The server returned an invalid upload response.",response.status,null,false);
    }
    await invalidateApiCacheAfterMutation(destination,accessToken);
    return body as T;
  }catch(error){
    if(error instanceof ApiRequestError)throw error;
    const timedOut=error instanceof Error&&error.name==="AbortError";
    throw new ApiRequestError(
      timedOut?"TIMEOUT":"NETWORK_ERROR",
      timedOut?"The upload timed out.":"Cannot reach the server.",
      null,
      null,
      true,
    );
  }finally{
    clearTimeout(timeout);
    if(stagedFile?.exists)stagedFile.delete();
  }
}

async function uploadVenueMediaAsset(
  accessToken:string,
  purpose:VenueMediaAssetPurpose,
  source:LocalMediaUpload,
):Promise<{asset:VenueMediaAssetDto}>{
  return uploadNativeImage<{asset:VenueMediaAssetDto}>(
    accessToken,source,`/api/v1/owner/media-assets?purpose=${encodeURIComponent(purpose)}`,
  );
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
  uploadProfileImage: (accessToken:string,source:LocalMediaUpload) =>
    uploadNativeImage<{user:UserDto}>(accessToken,source,"/api/v1/users/me/avatar"),
  me: (accessToken: string) => request<{ user: UserDto }>("/api/v1/users/me", {}, accessToken),
};

export const ownerApi = {
  settings: (accessToken:string) =>
    request<{settings:OwnerVenueSettingsDto}>("/api/v1/owner/settings",{},accessToken),
  updateSettings: (accessToken:string,input:OwnerVenueSettingsUpdateRequest) =>
    request<{settings:OwnerVenueSettingsDto}>("/api/v1/owner/settings",{method:"PATCH",body:JSON.stringify(input)},accessToken),
  mediaPage: (accessToken:string) =>
    request<{page:VenueMediaPageDto}>("/api/v1/owner/media-page",{},accessToken),
  updateMediaPage: (accessToken:string,input:VenueMediaPageUpdateRequest) =>
    request<{page:VenueMediaPageDto}>("/api/v1/owner/media-page",{method:"PATCH",body:JSON.stringify(input)},accessToken),
  uploadMediaAsset: (accessToken:string,purpose:VenueMediaAssetPurpose,source:LocalMediaUpload) =>
    uploadVenueMediaAsset(accessToken,purpose,source),
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
  timetables: (accessToken: string) =>
    request<VenueTimetableListResponse>("/api/v1/owner/timetables", {}, accessToken),
  createTimetable: (accessToken: string, input: VenueTimetableDraftRequest) =>
    request<{ timetable: import("@leaguekick/contracts").VenueTimetableDto }>("/api/v1/owner/timetables", { method: "POST", body: JSON.stringify(input) }, accessToken),
  updateTimetable: (accessToken: string, timetableId: string, input: VenueTimetableDraftRequest) =>
    request<{ timetable: import("@leaguekick/contracts").VenueTimetableDto }>(`/api/v1/owner/timetables/${timetableId}`, { method: "PUT", body: JSON.stringify(input) }, accessToken),
  duplicateTimetable: (accessToken: string, timetableId: string) =>
    request<{ timetable: import("@leaguekick/contracts").VenueTimetableDto }>(`/api/v1/owner/timetables/${timetableId}/duplicate`, { method: "POST" }, accessToken),
  deleteTimetable: (accessToken: string, timetableId: string) =>
    request<{ deleted: boolean }>(`/api/v1/owner/timetables/${timetableId}`, { method: "DELETE" }, accessToken),
  publishTimetable: (accessToken: string, timetableId: string) =>
    request<VenueTimetablePublishResponse>(`/api/v1/owner/timetables/${timetableId}/publish`, { method: "POST" }, accessToken),
  archiveTimetable: (accessToken: string, timetableId: string) =>
    request<{ timetable: import("@leaguekick/contracts").VenueTimetableDto }>(`/api/v1/owner/timetables/${timetableId}/archive`, { method: "POST" }, accessToken),
  createTimetableException: (accessToken: string, input: VenueTimetableExceptionRequest) =>
    request<{ exception: import("@leaguekick/contracts").VenueTimetableExceptionDto }>("/api/v1/owner/timetable-exceptions", { method: "POST", body: JSON.stringify(input) }, accessToken),
  updateTimetableException: (accessToken: string, exceptionId: string, input: VenueTimetableExceptionRequest) =>
    request<{ exception: import("@leaguekick/contracts").VenueTimetableExceptionDto }>(`/api/v1/owner/timetable-exceptions/${exceptionId}`, { method: "PUT", body: JSON.stringify(input) }, accessToken),
  deleteTimetableException: (accessToken: string, exceptionId: string) =>
    request<{ deleted: boolean }>(`/api/v1/owner/timetable-exceptions/${exceptionId}`, { method: "DELETE" }, accessToken),
  timetableCalendar: (accessToken: string, from: string, to: string, areaId?: string | null) =>
    request<VenueTimetableCalendarResponse>(
      `/api/v1/owner/timetable-calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${areaId ? `&areaId=${encodeURIComponent(areaId)}` : ""}`,
      {},
      accessToken,
    ),
  createManualBooking: (accessToken: string, input: ManualBookingRequest) =>
    request<{ booking: BookingDto }>("/api/v1/owner/bookings/manual", { method: "POST", body: JSON.stringify(input) }, accessToken),
  createBlock: (accessToken: string, input: VenueBlockRequest) =>
    request<{ block: import("@leaguekick/contracts").VenueBlockDto }>("/api/v1/owner/blocks", { method: "POST", body: JSON.stringify(input) }, accessToken),
  updateBlock: (accessToken: string, blockId: string, input: VenueBlockRequest) =>
    request<{ block: import("@leaguekick/contracts").VenueBlockDto }>(
      `/api/v1/owner/blocks/${blockId}`,
      { method: "PUT", body: JSON.stringify(input) },
      accessToken,
    ),
  deleteBlock: (accessToken: string, blockId: string) =>
    request<void>(`/api/v1/owner/blocks/${blockId}`, { method: "DELETE" }, accessToken),
  confirmBooking: (accessToken:string,bookingId:string) =>
    request<{booking:BookingDto}>(`/api/v1/owner/bookings/${bookingId}/confirm`,{method:"POST"},accessToken),
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
  updatePost: (accessToken: string, postId: string, input: import("@leaguekick/contracts").VenuePostUpdateRequest) =>
    request<{ post: VenuePostDto }>(`/api/v1/owner/posts/${postId}`, { method: "PUT", body: JSON.stringify(input) }, accessToken),
  deletePost: (accessToken: string, postId: string) =>
    request<{ deleted: boolean }>(`/api/v1/owner/posts/${postId}`, { method: "DELETE" }, accessToken),
  setPostVisibility: (accessToken: string, postId: string, visibility: import("@leaguekick/contracts").VenuePostVisibility) =>
    request<{ post: VenuePostDto }>(`/api/v1/owner/posts/${postId}/visibility`, { method: "PATCH", body: JSON.stringify({ visibility }) }, accessToken),
  addPostSchedule: (accessToken: string, postId: string, input: import("@leaguekick/contracts").VenuePostScheduleRequest) =>
    request<{ schedule: import("@leaguekick/contracts").VenuePostScheduleDto }>(`/api/v1/owner/posts/${postId}/schedules`, { method: "POST", body: JSON.stringify(input) }, accessToken),
  cancelPostSchedule: (accessToken: string, postId: string, scheduleId: string) =>
    request<{ schedule: import("@leaguekick/contracts").VenuePostScheduleDto }>(`/api/v1/owner/posts/${postId}/schedules/${scheduleId}`, { method: "DELETE" }, accessToken),
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
  nearby: (latitude:number,longitude:number)=>
    request<NearbyVenuesResponse>(`/api/v1/venues/nearby?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`),
  discovery: (filters?:{q?:string;province?:string})=>{
    const params=new URLSearchParams();
    if(filters?.q)params.set("q",filters.q.slice(0,120));
    if(filters?.province)params.set("province",filters.province);
    const query=params.toString();
    return request<VenueDiscoveryResponse>(`/api/v1/venues/discovery${query?`?${query}`:""}`);
  },
  list: (filters?: { city?: string; province?: string; q?: string }) => {
    const params = new URLSearchParams();
    if (filters?.city) params.set("city", filters.city);
    if (filters?.province) params.set("province", filters.province);
    if (filters?.q) params.set("q", filters.q);
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
  socialDirectoryDiscovery:(accessToken:string,entityType:"TEAM"|"COMPETITION")=>
    request<SocialDirectoryDiscoveryResponse>(`/api/v1/social/discovery/${entityType}`,{},accessToken),
  mostFollowedVenues: ()=>request<MostFollowedVenuesResponse>("/api/v1/social/venues/most-followed"),
  followedVenues: (accessToken:string) =>
    request<FollowedVenuesResponse>("/api/v1/social/venues/followed",{},accessToken),
  feed: (accessToken?: string, followingOnly = false) =>
    request<FeedResponse>(followingOnly ? "/api/v1/feed/following" : "/api/v1/feed", {}, followingOnly ? accessToken : undefined),
  venuePosts: (venueId: string, accessToken?: string) =>
    request<{ posts: VenuePostDto[]; generatedAt: string }>(
      accessToken ? `/api/v1/venues/${venueId}/posts/following` : `/api/v1/venues/${venueId}/posts`,
      {},
      accessToken,
    ),
  venuePostForUser: (accessToken: string, postId: string) =>
    request<{ post: VenuePostDto }>(`/api/v1/social/venue-posts/${postId}`, {}, accessToken),
  socialFeed: (accessToken: string) =>
    request<SocialFeedResponse>("/api/v1/social/feed", {}, accessToken),
  publicUserProfile: (accessToken:string,userId:string) =>
    request<{profile:{id:string;type:"USER";name:string;imageUrl:string|null};posts:SocialFeedPostDto[];followState:SocialFollowStateDto}>(
      `/api/v1/social/people/${userId}`,{},accessToken),
  createUserPost: (accessToken:string,input:SocialUserPostCreateRequest) =>
    request<{post:SocialFeedPostDto}>("/api/v1/social/user-posts",
      {method:"POST",body:JSON.stringify(input)},accessToken),
  deleteUserPost: (accessToken:string,postId:string) =>
    request<{deleted:boolean}>(`/api/v1/social/user-posts/${postId}`,{method:"DELETE"},accessToken),
  uploadUserPostImage: (accessToken:string,source:LocalMediaUpload) =>
    uploadNativeImage<{imageUrl:string}>(accessToken,source,"/api/v1/social/post-images"),
  socialFollowState: (accessToken: string, entityType: SocialEntityType, entityId: string) =>
    request<SocialFollowStateDto>(`/api/v1/social/follows/${entityType}/${entityId}`, {}, accessToken),
  socialFollow: (accessToken: string, entityType: SocialEntityType, entityId: string) =>
    request<SocialFollowStateDto>(`/api/v1/social/follows/${entityType}/${entityId}`, { method: "POST" }, accessToken),
  socialUnfollow: (accessToken: string, entityType: SocialEntityType, entityId: string) =>
    request<SocialFollowStateDto>(`/api/v1/social/follows/${entityType}/${entityId}`, { method: "DELETE" }, accessToken),
  likeSocialPost: (accessToken: string, postId: string) =>
    request<{ post: SocialFeedPostDto }>(`/api/v1/social/posts/${postId}/like`, { method: "POST" }, accessToken),
  unlikeSocialPost: (accessToken: string, postId: string) =>
    request<{ post: SocialFeedPostDto }>(`/api/v1/social/posts/${postId}/like`, { method: "DELETE" }, accessToken),
  socialComments: (accessToken: string, postId: string) =>
    request<{ post: SocialFeedPostDto; comments: SocialPostCommentDto[] }>(`/api/v1/social/posts/${postId}/comments`, {}, accessToken),
  addSocialComment: (accessToken: string, postId: string, input: SocialPostCommentCreateRequest) =>
    request<{ comment: SocialPostCommentDto }>(`/api/v1/social/posts/${postId}/comments`, { method: "POST", body: JSON.stringify(input) }, accessToken),
  updateSocialComment: (accessToken: string, postId: string, commentId: string, input: SocialPostCommentUpdateRequest) =>
    request<{ comment: SocialPostCommentDto }>(`/api/v1/social/posts/${postId}/comments/${commentId}`, { method: "PATCH", body: JSON.stringify(input) }, accessToken),
  deleteSocialComment: (accessToken: string, postId: string, commentId: string) =>
    request<{ deleted: boolean }>(`/api/v1/social/posts/${postId}/comments/${commentId}`, { method: "DELETE" }, accessToken),
  likeSocialComment: (accessToken: string, postId: string, commentId: string) =>
    request<{ comment: SocialPostCommentDto }>(`/api/v1/social/posts/${postId}/comments/${commentId}/like`, { method: "POST" }, accessToken),
  unlikeSocialComment: (accessToken: string, postId: string, commentId: string) =>
    request<{ comment: SocialPostCommentDto }>(`/api/v1/social/posts/${postId}/comments/${commentId}/like`, { method: "DELETE" }, accessToken),
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
  list: (accessToken:string,options?:{filter?:NotificationListFilter;limit?:number;offset?:number})=>{
    const query=new URLSearchParams();
    if(options?.filter)query.set("filter",options.filter);
    if(options?.limit!==undefined)query.set("limit",String(options.limit));
    if(options?.offset!==undefined)query.set("offset",String(options.offset));
    const path=`/api/v1/notifications${query.toString()?`?${query}`:""}`;
    return request<NotificationListResponse>(path,{},accessToken);
  },
  markAllRead: (accessToken:string)=>request<{updated:number;unreadCount:number}>(
    "/api/v1/notifications/read-all",{method:"POST"},accessToken),
  clearRead: (accessToken:string)=>request<{deleted:number;unreadCount:number}>(
    "/api/v1/notifications/read",{method:"DELETE"},accessToken),
  remove: (accessToken:string,id:string)=>request<{deleted:boolean;unreadCount:number}>(
    `/api/v1/notifications/${id}`,{method:"DELETE"},accessToken),
  markRead: (accessToken: string, notificationId: string) =>
    request<{ notification: NotificationDto }>(`/api/v1/notifications/${notificationId}/read`, { method: "POST" }, accessToken),
  preferences: (accessToken: string) =>
    request<{ preferences: NotificationPreferences }>("/api/v1/notifications/preferences", {}, accessToken),
  updatePreferences: (accessToken: string, input: NotificationPreferencesUpdate) =>
    request<{ preferences: NotificationPreferences }>("/api/v1/notifications/preferences", { method: "PATCH", body: JSON.stringify(input) }, accessToken),
};


export type TeamOpsCompetition={
  id:string;name:string;format:string;status:string;published:boolean;venueName:string;venueId:string;
  registrationStatus:string;feeStatus:string;registrationClosesAt:string|null;startsAt:string|null;endsAt:string|null;
  rosterUserIds:string[];rosterLocked:boolean;
};
export type TeamOpsMatch={
  id:string;competitionId:string;homeTeamId:string|null;awayTeamId:string|null;
  competitionName:string;opponentName:string|null;status:string;stage:string;round:number;
  startsAt:string|null;endsAt:string|null;homeScore:number|null;awayScore:number|null;
  lineup:{matchId:string;starters:string[];substitutes:string[];captainUserId:string|null}|null;
};
export type TeamAvailability="AVAILABLE"|"UNAVAILABLE"|"UNSURE";
export type TeamActivityInput={
  kind:"TRAINING"|"MEETING"|"FRIENDLY"|"OTHER";title:string;notes:string|null;location:string|null;
  startsAt:string;endsAt:string;
};
export type TeamOpsActivity=TeamActivityInput&{
  id:string;teamId:string;createdAt:string;updatedAt:string;
  rsvps:{activityId:string;userId:string;availability:string}[];
};
export type TeamOperations={
  competitions:TeamOpsCompetition[];matches:TeamOpsMatch[];activities:TeamOpsActivity[];
};
export type TeamMemberActivity=Omit<TeamOpsActivity,"rsvps">&{myAvailability:TeamAvailability|null};
export const teamOperationsApi={
  list:(token:string,teamId:string)=>
    request<TeamOperations>(`/api/v1/teams/${teamId}/manager/operations`,{},token),
  roster:(token:string,teamId:string,competitionId:string,playerUserIds:string[])=>
    request<{playerUserIds:string[]}>(`/api/v1/teams/${teamId}/manager/competitions/${competitionId}/roster`,
      {method:"PUT",body:JSON.stringify({playerUserIds})},token),
  lineup:(token:string,teamId:string,matchId:string,input:{starters:string[];substitutes:string[];captainUserId:string|null})=>
    request<{saved:boolean}>(`/api/v1/teams/${teamId}/manager/matches/${matchId}/lineup`,
      {method:"PUT",body:JSON.stringify(input)},token),
  memberActivities:(token:string,teamId:string)=>
    request<{activities:TeamMemberActivity[]}>(`/api/v1/teams/${teamId}/activities`,{},token),
  createActivity:(token:string,teamId:string,input:TeamActivityInput)=>
    request<{id:string}>(`/api/v1/teams/${teamId}/manager/activities`,
      {method:"POST",body:JSON.stringify(input)},token),
  updateActivity:(token:string,teamId:string,id:string,input:TeamActivityInput)=>
    request<{id:string}>(`/api/v1/teams/${teamId}/manager/activities/${id}`,
      {method:"PUT",body:JSON.stringify(input)},token),
  deleteActivity:(token:string,teamId:string,id:string)=>
    request<{deleted:boolean}>(`/api/v1/teams/${teamId}/manager/activities/${id}`,{method:"DELETE"},token),
  rsvp:(token:string,teamId:string,id:string,availability:TeamAvailability)=>
    request<{availability:TeamAvailability}>(`/api/v1/teams/${teamId}/activities/${id}/availability`,
      {method:"POST",body:JSON.stringify({availability})},token),
};

export type TeamGrowthPost={id:string;body:string;imageUrl:string|null;publishedAt:string};
export type TeamGrowthAnnouncement={id:string;teamId:string;authorId:string;title:string;body:string;createdAt:string;updatedAt:string};
export type TeamGrowthChallenge={id:string;fromTeamId:string;toTeamId:string;opponentName:string;proposedAt:string;
  venueName:string|null;message:string|null;status:string;respondedAt:string|null;createdAt:string};
export type TeamGrowthPlayer={userId:string;displayName:string;matches:number;goals:number;assists:number;
  yellowCards:number;redCards:number;cleanSheets:number;playerOfMatch:number};
export type TeamGrowthHistory={id:string;name:string;status:string;format:string;registrationStatus:string;
  champion:boolean;rewards:{category:string;title:string;prize:string;description:string|null}[]};
export type TeamGrowthData={
  posts:TeamGrowthPost[];announcements:TeamGrowthAnnouncement[];challenges:TeamGrowthChallenge[];
  stats:{played:number;wins:number;draws:number;losses:number;goalsFor:number;goalsAgainst:number;
    goalDifference:number;winRate:number;championships:number;
    players:TeamGrowthPlayer[];competitionHistory:TeamGrowthHistory[]};
};
export const teamGrowthApi={
  list:(token:string,teamId:string)=>request<TeamGrowthData>(`/api/v1/teams/${teamId}/manager/growth`,{},token),
  createPost:(token:string,teamId:string,input:{body:string;imageUrl:string|null})=>
    request<{id:string}>(`/api/v1/teams/${teamId}/manager/posts`,{method:"POST",body:JSON.stringify(input)},token),
  updatePost:(token:string,teamId:string,id:string,input:{body:string;imageUrl:string|null})=>
    request<{updated:boolean}>(`/api/v1/teams/${teamId}/manager/posts/${id}`,{method:"PUT",body:JSON.stringify(input)},token),
  deletePost:(token:string,teamId:string,id:string)=>
    request<{deleted:boolean}>(`/api/v1/teams/${teamId}/manager/posts/${id}`,{method:"DELETE"},token),
  announcements:(token:string,teamId:string)=>
    request<{announcements:TeamGrowthAnnouncement[]}>(`/api/v1/teams/${teamId}/announcements`,{},token),
  createAnnouncement:(token:string,teamId:string,input:{title:string;body:string})=>
    request<{id:string}>(`/api/v1/teams/${teamId}/manager/announcements`,
      {method:"POST",body:JSON.stringify(input)},token),
  deleteAnnouncement:(token:string,teamId:string,id:string)=>
    request<{deleted:boolean}>(`/api/v1/teams/${teamId}/manager/announcements/${id}`,{method:"DELETE"},token),
  challenge:(token:string,teamId:string,input:{toTeamId:string;proposedAt:string;venueName:string|null;message:string|null})=>
    request<{id:string}>(`/api/v1/teams/${teamId}/manager/challenges`,{method:"POST",body:JSON.stringify(input)},token),
  decideChallenge:(token:string,teamId:string,id:string,decision:"ACCEPTED"|"DECLINED")=>
    request<{status:string}>(`/api/v1/teams/${teamId}/manager/challenges/${id}/decision`,
      {method:"POST",body:JSON.stringify({decision})},token),
  cancelChallenge:(token:string,teamId:string,id:string)=>
    request<{status:string}>(`/api/v1/teams/${teamId}/manager/challenges/${id}/cancel`,{method:"POST"},token),
};

export type TeamManagerProfileDetails={
  province:string|null;district:string|null;description:string|null;foundedOn:string|null;
  primaryColor:string|null;secondaryColor:string|null;contactPhone:string|null;homeVenueId:string|null;
  allowJoinRequests:boolean;
};
export type TeamGuestPlayer={id:string;teamId:string;name:string;position:string;shirtNumber:number|null;createdAt:string};
export type TeamManagerOverview={
  canWrite:boolean;profile:TeamManagerProfileDetails;guests:TeamGuestPlayer[];
  stats:{competitions:number;played:number;wins:number};
  nextMatch:null|{id:string;competitionId:string;competitionName:string;opponentName:string;startsAt:string};
};
export const teamManagerApi={
  overview:(token:string,teamId:string)=>
    request<TeamManagerOverview>(`/api/v1/teams/${teamId}/manager/overview`,{},token),
  publicDetails:(teamId:string)=>request<{profile:Omit<TeamManagerProfileDetails,"allowJoinRequests">}>(`/api/v1/teams/${teamId}/profile-details`),
  updateProfile:(token:string,teamId:string,input:TeamManagerProfileDetails)=>
    request<{profile:TeamManagerProfileDetails}>(`/api/v1/teams/${teamId}/manager/profile`,
      {method:"PUT",body:JSON.stringify(input)},token),
  addGuest:(token:string,teamId:string,input:{name:string;position:string;shirtNumber:number|null})=>
    request<{guest:TeamGuestPlayer}>(`/api/v1/teams/${teamId}/manager/guests`,
      {method:"POST",body:JSON.stringify(input)},token),
  updateGuest:(token:string,teamId:string,guestId:string,input:{name:string;position:string;shirtNumber:number|null})=>
    request<{guest:TeamGuestPlayer}>(`/api/v1/teams/${teamId}/manager/guests/${guestId}`,
      {method:"PUT",body:JSON.stringify(input)},token),
  deleteGuest:(token:string,teamId:string,guestId:string)=>
    request<{deleted:boolean}>(`/api/v1/teams/${teamId}/manager/guests/${guestId}`,{method:"DELETE"},token),
};

export type PlayerDashboardPreferences={
  defaultTeamId:string|null;biography:string|null;province:string|null;district:string|null;
  secondaryPosition:"UNSPECIFIED"|"GOALKEEPER"|"FIXO"|"ALA"|"PIVO"|"UNIVERSAL"|null;
  preferredFoot:"LEFT"|"RIGHT"|"BOTH"|null;
};
export type PlayerDashboardRequest={id:string;teamId:string;teamName:string;status:"PENDING"|"ACCEPTED"|"REJECTED"|"CANCELLED";
  createdAt:string;respondedAt:string|null};
export type PlayerDashboardActivity={id:string;teamId:string;kind:string;title:string;location:string|null;
  startsAt:string;endsAt:string;availability:string|null};
export type PlayerDashboardOverview={
  profile:OwnPlayerProfileDto;teams:TeamListItemDto[];selectedTeamId:string|null;
  preferences:PlayerDashboardPreferences;requests:PlayerDashboardRequest[];invitations:TeamInvitationDto[];
  stats:{matches:number;goals:number;assists:number;awards:number};
  nextMatch:null|{id:string;competitionId:string;startsAt:string|null;homeTeamName:string;awayTeamName:string;teamId:string|null};
  activities:PlayerDashboardActivity[];
  recentMatches:Array<{matchId:string;teamId:string;goals:number;assists:number;
    appeared:boolean;best:boolean;startsAt:string|null;homeScore:number|null;awayScore:number|null;
    homeTeamId:string|null;awayTeamId:string|null;matchStatus:string}>;
};
export const playerDashboardApi={
  overview:(token:string)=>request<PlayerDashboardOverview>("/api/v1/player-dashboard",{},token),
  preferences:(token:string)=>request<{preferences:PlayerDashboardPreferences}>("/api/v1/player-dashboard/preferences",{},token),
  updatePreferences:(token:string,input:Partial<PlayerDashboardPreferences>)=>
    request<{preferences:PlayerDashboardPreferences}>("/api/v1/player-dashboard/preferences",
      {method:"PATCH",body:JSON.stringify(input)},token),
  outgoingRequests:(token:string)=>request<{requests:PlayerDashboardRequest[]}>("/api/v1/player-dashboard/join-requests",{},token),
  cancelRequest:(token:string,id:string)=>request<{cancelled:boolean}>(
    `/api/v1/player-dashboard/join-requests/${id}/cancel`,{method:"POST"},token),
  leaveTeam:(token:string,teamId:string)=>request<{left:boolean}>(
    `/api/v1/player-dashboard/teams/${teamId}/leave`,{method:"POST"},token),
};

export const teamApi = {
  myProfile: (accessToken: string) =>
    request<{ player: OwnPlayerProfileDto }>("/api/v1/players/me", {}, accessToken),
  updateMyProfile: (accessToken: string, input: PlayerProfileUpdateRequest) =>
    request<{ player: OwnPlayerProfileDto }>("/api/v1/players/me", { method: "PATCH", body: JSON.stringify(input) }, accessToken),
  publicPlayer: (playerId: string) =>
    request<{ player: PublicPlayerProfileDto }>(`/api/v1/players/${playerId}`),
  directory: (accessToken: string) =>
    request<{ teams: TeamDirectoryItemDto[] }>("/api/v1/teams", {}, accessToken),
  mine: (accessToken: string) =>
    request<{ teams: TeamListItemDto[] }>("/api/v1/teams/mine", {}, accessToken),
  joinRequests:(token:string,teamId:string)=>
    request<{requests:TeamJoinRequestDto[]}>(`/api/v1/teams/${teamId}/join-requests`,{},token),
  respondJoinRequest:(token:string,teamId:string,requestId:string,accept:boolean)=>
    request<{request:TeamJoinRequestDto}>(`/api/v1/teams/${teamId}/join-requests/${requestId}`,
      {method:"PATCH",body:JSON.stringify({accept})},token),
  joinRequest: (accessToken: string, teamId: string) =>
    request<{ request: TeamJoinRequestDto | null }>(`/api/v1/teams/${teamId}/join-request`, {}, accessToken),
  requestJoin: (accessToken: string, teamId: string) =>
    request<{ request: TeamJoinRequestDto }>(`/api/v1/teams/${teamId}/join-request`, { method: "POST" }, accessToken),
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
  manualTeams: (accessToken: string) =>
    request<{ teams: AdminManualTeamDto[] }>("/api/v1/admin/manual-teams", {}, accessToken),
  assignManualTeam: (accessToken: string, teamId: string, input: ManualTeamClaimRequest) =>
    request<{ assignment: { teamId: string; managerUserId: string; claimedAt: string } }>(
      `/api/v1/admin/manual-teams/${teamId}/assign`,
      { method: "POST", body: JSON.stringify(input) }, accessToken),
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

export const manualTeamApi = {
  mine: (accessToken: string) =>
    request<{ teams: ManualTeamDto[] }>("/api/v1/owner/manual-teams", {}, accessToken),
  create: (accessToken: string, input: ManualTeamCreateRequest) =>
    request<{ team: ManualTeamDto }>("/api/v1/owner/manual-teams", { method: "POST", body: JSON.stringify(input) }, accessToken),
  update: (accessToken: string, teamId: string, input: ManualTeamUpdateRequest) =>
    request<{ team: ManualTeamDto }>(`/api/v1/owner/manual-teams/${teamId}`, { method: "PATCH", body: JSON.stringify(input) }, accessToken),
  register: (accessToken: string, competitionId: string, teamId: string) =>
    request<{ registration: { teamId: string; status: "ACCEPTED" } }>(
      `/api/v1/owner/competitions/${competitionId}/manual-teams/${teamId}`,
      { method: "POST" }, accessToken),
};

export const competitionApi = {
  list: () =>
    request<{ generatedAt: string; competitions: CompetitionListItemDto[] }>("/api/v1/competitions"),
  get: (competitionId: string) =>
    request<{ competition: CompetitionDto }>(`/api/v1/competitions/${competitionId}`),
  match: (competitionId:string,matchId:string)=>
    request<CompetitionPublicMatchDetail>(
      `/api/v1/competitions/${competitionId}/matches/${matchId}`),
  media: (competitionId: string) =>
    request<{ posts: CompetitionMediaPostDto[] }>(`/api/v1/competitions/${competitionId}/media`),
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
  ownerMedia: (accessToken: string, competitionId: string) =>
    request<{ posts: CompetitionMediaPostDto[] }>(`/api/v1/owner/competitions/${competitionId}/media`, {}, accessToken),
  create: (accessToken: string, input: CompetitionCreateRequest) =>
    request<{ competition: CompetitionDto }>(
      "/api/v1/owner/competitions",
      { method: "POST", body: JSON.stringify(input) },
      accessToken,
    ),
  duplicate: (accessToken: string, competitionId: string) =>
    request<{ competition: CompetitionDto }>(
      `/api/v1/owner/competitions/${competitionId}/duplicate`,
      { method: "POST" },
      accessToken,
    ),
  update: (accessToken: string, competitionId: string, input: CompetitionUpdateRequest) =>
    request<{ competition: CompetitionDto }>(
      `/api/v1/owner/competitions/${competitionId}`,
      { method: "PATCH", body: JSON.stringify(input) },
      accessToken,
    ),
  replaceRewards:(accessToken:string,competitionId:string,input:CompetitionRewardsUpdateRequest)=>
    request<{competition:CompetitionDto}>(
      `/api/v1/owner/competitions/${competitionId}/rewards`,
      {method:"PUT",body:JSON.stringify(input)},accessToken),
  remove: (accessToken: string, competitionId: string) =>
    request<{ deleted: boolean }>(
      `/api/v1/owner/competitions/${competitionId}`,
      { method: "DELETE" },
      accessToken,
    ),
  createMediaPost: (accessToken: string, competitionId: string, input: CompetitionMediaPostCreateRequest) =>
    request<{ post: CompetitionMediaPostDto }>(
      `/api/v1/owner/competitions/${competitionId}/media`,
      { method: "POST", body: JSON.stringify(input) },
      accessToken,
    ),
  setMediaStatus: (accessToken: string, competitionId: string, postId: string, input: CompetitionMediaPostStatusRequest) =>
    request<{ post: CompetitionMediaPostDto }>(
      `/api/v1/owner/competitions/${competitionId}/media/${postId}`,
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
  removeTeam: (accessToken: string, competitionId: string, teamId: string) =>
    request<{ registration: CompetitionTeamDto | null }>(
      `/api/v1/owner/competitions/${competitionId}/registrations/${teamId}`,
      { method: "DELETE" },
      accessToken,
    ),
  updateSeed: (
    accessToken: string,
    competitionId: string,
    teamId: string,
    input: CompetitionSeedUpdateRequest,
  ) =>
    request<{ registration: CompetitionTeamDto | null }>(
      `/api/v1/owner/competitions/${competitionId}/registrations/${teamId}/seed`,
      { method: "PATCH", body: JSON.stringify(input) },
      accessToken,
    ),
  updateFee: (
    accessToken: string,
    competitionId: string,
    teamId: string,
    input: CompetitionFeeUpdateRequest,
  ) =>
    request<{ registration: CompetitionTeamDto | null }>(
      `/api/v1/owner/competitions/${competitionId}/registrations/${teamId}/fee`,
      { method: "PATCH", body: JSON.stringify(input) },
      accessToken,
    ),
};
