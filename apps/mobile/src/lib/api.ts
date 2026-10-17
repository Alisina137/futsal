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
  VenueDirectoryFilters,
  VenueDirectoryResponse,
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
  VenueReviewCreate,
  VenueReviewDto,
  VenueReviewSummary,
  MyVenueReviews,
  VenueSlotWatchCreate,
  VenueSlotWatchDto,
  BookingDto,
  OwnerBookingListQuery,
  OwnerBookingListResponse,
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
  VenueMatchPage,
  CompetitionFeeUpdateRequest,
  CompetitionDiscoveryQuery,
  CompetitionDiscoveryResponse,
  CompetitionParticipationsResponse,
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
import {API_PROBE_TIMEOUT_MS} from "./api-reachability";

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
    const externalAbort=()=>controller.abort();
    if(init.signal?.aborted)externalAbort();
    init.signal?.addEventListener("abort",externalAbort,{once:true});
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
      if(init.signal?.aborted)
        throw new ApiRequestError("REQUEST_CANCELLED","Request cancelled.",null);
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
      init.signal?.removeEventListener("abort",externalAbort);
    }
  }

  throw new ApiRequestError("NETWORK_ERROR", "Cannot reach the server.", null, null, true);
}

async function request<T>(path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
  if (isSafeRead(init)) {
    // Sensitive live administration must never be served from the app's offline
    // cache, and stale page queries must obey the caller's abort signal.
    if(path.startsWith("/api/v1/admin/")||path.startsWith("/api/v1/venues/search?")||path.startsWith("/api/v1/competitions/discover")||path.endsWith("/participation"))
      return networkRequest<T>(path,init,accessToken);
    return cachedApiRead(path, accessToken, () => networkRequest<T>(path, init, accessToken));
  }

  const value = await networkRequest<T>(path, init, accessToken);
  await invalidateApiCacheAfterMutation(path, accessToken);
  return value;
}

async function probeApi(timeoutMs = API_PROBE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    });
    // Ngrok error/interstitial pages and unrelated websites may return HTTP
    // 200. Only the Futsal API's real health payload proves connectivity.
    if (!response.ok) return false;
    const value = await response.json().catch(() => null);
    return value?.service === "futsal-api" && value?.status === "ok";
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
  requestEmailVerification: (token:string,input:{email:string;password:string}) =>
    request<import("@leaguekick/contracts").EmailVerificationRequestResponse>(
      "/api/v1/auth/email-verification/request",{method:"POST",body:JSON.stringify(input)},token),
  confirmEmailVerification: (token:string,input:{requestId:string;code:string}) =>
    request<{user:UserDto;reauthRequired:boolean}>(
      "/api/v1/auth/email-verification/confirm",{method:"POST",body:JSON.stringify(input)},token),

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
  listBookings: (accessToken:string,filters:Partial<OwnerBookingListQuery>={}) =>{
    const params=new URLSearchParams();
    for(const [key,value] of Object.entries(filters)){
      if(value!==undefined&&value!==null&&String(value)!=="")params.set(key,String(value));
    }
    const query=params.toString();
    return request<OwnerBookingListResponse>("/api/v1/owner/bookings"+
      (query?"?"+query:""),{cache:"no-store"},accessToken);
  },
  pendingBookings: (accessToken:string) =>
    request<{bookings:BookingDto[];generatedAt:string}>("/api/v1/owner/bookings/pending",{},accessToken),
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
  deleteArchivedTimetable: (accessToken: string, timetableId: string) =>
    request<{ deleted: boolean }>(`/api/v1/owner/timetables/${timetableId}/history`,
      { method: "DELETE" }, accessToken),
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
  scheduleChanges:(venueId:string,from:string,to:string)=>
    networkRequest<import("@leaguekick/contracts").PublicVenueScheduleChangesResponse>(
      `/api/v1/venues/${encodeURIComponent(venueId)}/schedule-changes?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      {cache:"no-store"}),
  reviews:(venueId:string,page=1,sort:"recent"|"highest"|"lowest"="recent")=>
    networkRequest<VenueReviewSummary>(
      `/api/v1/venues/${encodeURIComponent(venueId)}/reviews?page=${page}&sort=${sort}`),
  search: (filters:VenueDirectoryFilters)=>{
    const params=new URLSearchParams();
    params.set("date",filters.date);
    if(filters.province)params.set("province",filters.province);
    if(filters.q)params.set("q",filters.q);
    if(filters.startTime)params.set("startTime",filters.startTime);
    if(filters.endTime)params.set("endTime",filters.endTime);
    if(filters.minPriceAfn!==undefined)params.set("minPriceAfn",String(filters.minPriceAfn));
    if(filters.maxPriceAfn!==undefined)params.set("maxPriceAfn",String(filters.maxPriceAfn));
    if(filters.availableOnly)params.set("availableOnly","true");
    params.set("sort",filters.sort);
    if(filters.latitude!==undefined&&filters.longitude!==undefined){
      params.set("latitude",String(filters.latitude));
      params.set("longitude",String(filters.longitude));
    }
    // Dynamic availability should never be served from stale GET cache entries.
    return request<VenueDirectoryResponse>("/api/v1/venues/search?"+params.toString(),
      {headers:{"Cache-Control":"no-store"}});
  },
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
  /** A tapped preview must be checked against the network, not an offline snapshot. */
  availabilityLive: (venueId:string,date:string)=>
    networkRequest<VenueAvailabilityResponse>(
      `/api/v1/venues/${encodeURIComponent(venueId)}/availability?date=${encodeURIComponent(date)}`,
      {cache:"no-store"}),

};

export const bookingApi = {
  myVenueReviews:(token:string,venueId:string)=>networkRequest<MyVenueReviews>(
    `/api/v1/bookings/reviews/mine?venueId=${encodeURIComponent(venueId)}`,
    {cache:"no-store"},token),
  review:(token:string,input:VenueReviewCreate)=>request<{review:VenueReviewDto}>(
    "/api/v1/bookings/reviews",{method:"POST",body:JSON.stringify(input)},token),
  savedVenueTime:(token:string,venueId:string)=>request<{venueId:string;preferredStart:string|null}>(
    `/api/v1/bookings/venue-preferences/${encodeURIComponent(venueId)}`,{},token),
  saveVenueTime:(token:string,venueId:string,preferredStart:string|null)=>
    request<{venueId:string;preferredStart:string|null}>(
      `/api/v1/bookings/venue-preferences/${encodeURIComponent(venueId)}`,
      {method:"PUT",body:JSON.stringify({preferredStart})},token),
  slotWatches:(token:string,venueId:string)=>networkRequest<{watches:VenueSlotWatchDto[]}>(
    `/api/v1/bookings/slot-watches?venueId=${encodeURIComponent(venueId)}`,{cache:"no-store"},token),
  watchSlot:(token:string,input:VenueSlotWatchCreate)=>request<{watch:VenueSlotWatchDto}>(
    "/api/v1/bookings/slot-watches",{method:"POST",body:JSON.stringify(input)},token),
  unwatchSlot:(token:string,watchId:string)=>request<{removed:boolean}>(
    `/api/v1/bookings/slot-watches/${encodeURIComponent(watchId)}`,{method:"DELETE"},token),
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
  venuePromotions:(venueId:string)=>networkRequest<{
    venueId:string;promotions:PromotionDto[];generatedAt:string;
  }>(`/api/v1/promotions/venues/${encodeURIComponent(venueId)}`,{cache:"no-store"}),
  venueMedia:(venueId:string,options:import("@leaguekick/contracts").VenueMediaBrowseQuery,
    accessToken?:string)=>
    networkRequest<import("@leaguekick/contracts").VenueMediaBrowseResponse>(
      `/api/v1/venues/${encodeURIComponent(venueId)}/media`+
      (accessToken?"/following":"")+"?"+new URLSearchParams(Object.entries(options)
        .filter(([,value])=>value!==undefined).map(([key,value])=>[key,String(value)])).toString(),
      {cache:"no-store"},accessToken),
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
  venue:(accessToken:string,venueId:string,page=1)=>
    networkRequest<import("@leaguekick/contracts").VenueNotificationPage>(
      `/api/v1/notifications/venues/${encodeURIComponent(venueId)}?page=${page}&limit=12`,
      {cache:"no-store"},accessToken),
  unreadCount:(accessToken:string)=>
    request<{unreadCount:number}>("/api/v1/notifications/unread-count",{},accessToken),
  registerDevice:(accessToken:string,input:{expoPushToken:string;platform:"ANDROID"|"IOS"})=>
    request<void>("/api/v1/notifications/devices",{method:"POST",body:JSON.stringify(input)},accessToken),
  unregisterDevice:(accessToken:string,expoPushToken:string)=>
    request<void>("/api/v1/notifications/devices/unregister",
      {method:"POST",body:JSON.stringify({expoPushToken})},accessToken),
  list: (accessToken:string,options?:{filter?:NotificationListFilter;limit?:number;offset?:number;cursor?:string})=>{
    const query=new URLSearchParams();
    if(options?.filter)query.set("filter",options.filter);
    if(options?.limit!==undefined)query.set("limit",String(options.limit));
    if(options?.offset!==undefined)query.set("offset",String(options.offset));
    if(options?.cursor)query.set("cursor",options.cursor);
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

export type TeamPublicPost={id:string;body:string;imageUrl:string|null;publishedAt:string};
export type TeamPublicHighlights={
  posts:TeamPublicPost[];
  competitions:Array<{id:string;name:string;status:string;format:string;startsAt:string|null;endsAt:string|null}>;
  matches:Array<{id:string;competitionId:string;competitionName:string;homeTeamId:string|null;
    awayTeamId:string|null;homeTeamName:string;awayTeamName:string;
    homeLogoUrl?:string|null;awayLogoUrl?:string|null;status:string;stage:string;
    startsAt:string|null;homeScore:number|null;awayScore:number|null}>;
  stats:{played:number;wins:number;draws:number;losses:number;goalsFor:number;
    goalsAgainst:number;goalDifference:number;winRate:number;
    players:Array<{userId:string;displayName:string;appearances:number;goals:number;assists:number}>};
};
export const teamPublicApi={
  highlights:(teamId:string)=>request<TeamPublicHighlights>(
    `/api/v1/teams/${teamId}/public-highlights`),
  posts:(teamId:string,offset:number,limit=20)=>
    request<{posts:TeamPublicPost[];hasMore:boolean}>(
      `/api/v1/teams/${teamId}/public-posts?`+new URLSearchParams({
        offset:String(offset),limit:String(limit),
      }).toString()),
};

export type TeamGrowthPost={id:string;body:string;imageUrl:string|null;publishedAt:string;
  likeCount:number;commentCount:number};
export type TeamGrowthAnnouncement={id:string;teamId:string;authorId:string;title:string;body:string;createdAt:string;updatedAt:string};
export type TeamGrowthChallenge={id:string;fromTeamId:string;toTeamId:string;opponentName:string;proposedAt:string;
  venueName:string|null;message:string|null;status:string;respondedAt:string|null;createdAt:string};
export type TeamGrowthPlayer={userId:string;displayName:string;matches:number;goals:number;assists:number;
  yellowCards:number;redCards:number;cleanSheets:number;playerOfMatch:number};
export type TeamGrowthHistory={id:string;name:string;status:string;format:string;registrationStatus:string;
  startsAt?:string|null;endsAt?:string|null;
  champion:boolean;rewards:{category:string;title:string;prize:string;description:string|null}[]};
export type TeamAnalyticsMatch={
  id:string;competitionId:string;startsAt:string|null;status:string;
  homeTeamId:string|null;awayTeamId:string|null;homeScore:number;awayScore:number;
};
export type TeamAnalyticsPlayerRow={
  matchId:string;competitionId:string;startsAt:string|null;
  userId:string;displayName:string;appeared:boolean;goals:number;assists:number;
  yellowCards:number;redCards:number;cleanSheet:boolean;playerOfMatch:boolean;
};
export type TeamAnalyticsDetails={matches:TeamAnalyticsMatch[];players:TeamAnalyticsPlayerRow[]};
export type TeamGrowthData={
  posts:TeamGrowthPost[];announcements:TeamGrowthAnnouncement[];challenges:TeamGrowthChallenge[];
  stats:{played:number;wins:number;draws:number;losses:number;goalsFor:number;goalsAgainst:number;
    goalDifference:number;winRate:number;championships:number;
    players:TeamGrowthPlayer[];competitionHistory:TeamGrowthHistory[];
    /** Optional while older servers are still deployed: never pretend partial
     * analytics or scoped metrics exist until this verified detail is supplied. */
    analytics?:TeamAnalyticsDetails};
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
  coverImageUrl:string|null;
  allowJoinRequests:boolean;whatsappGroupUrl:string|null;
};
export type TeamGuestPlayer={id:string;teamId:string;name:string;position:string;shirtNumber:number|null;createdAt:string};
export type TeamManagerOverview={
  canWrite:boolean;profile:TeamManagerProfileDetails;guests:TeamGuestPlayer[];
  stats:{competitions:number;played:number;wins:number;draws:number;losses:number;upcoming:number;winRate:number};
  nextMatch:null|{id:string;competitionId:string;competitionName:string;
    opponentName:string;opponentLogoUrl:string|null;venueName:string;startsAt:string};
};
export const teamManagerApi={
  overview:(token:string,teamId:string)=>
    request<TeamManagerOverview>(`/api/v1/teams/${teamId}/manager/overview`,{},token),
  publicDetails:(teamId:string)=>request<{profile:Omit<TeamManagerProfileDetails,"allowJoinRequests"|"whatsappGroupUrl">}>(`/api/v1/teams/${teamId}/profile-details`),
  updateLogo:(token:string,teamId:string,imageUrl:string|null)=>
    request<{logoUrl:string|null}>(`/api/v1/teams/${teamId}/manager/logo`,
      {method:"PUT",body:JSON.stringify({imageUrl})},token),
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

export type PlayerParticipation={
  id:string;name:string;format:string;status:string;published:boolean;
  teamId:string;teamName:string;venueName:string;registrationStatus:string;
  startsAt:string|null;endsAt:string|null;inRoster:boolean;
};
export type PlayerMatchItem={
  id:string;competitionId:string;competitionName:string;teamId:string;teamName:string;
  opponentName:string;homeTeamName:string;awayTeamName:string;venueName:string|null;
  status:string;stage:string;startsAt:string|null;endsAt:string|null;
  homeScore:number|null;awayScore:number|null;
  lineupStatus:"STARTER"|"SUBSTITUTE"|"NOT_SELECTED"|"NOT_PUBLISHED";
  myStatistics:{
    appeared:boolean;goals:number;assists:number;yellowCards:number;
    redCards:number;cleanSheet:boolean;playerOfMatch:boolean;
  }|null;
};
export type PlayerTeamEvent={
  id:string;teamId:string;teamName:string;kind:string;title:string;notes:string|null;
  location:string|null;startsAt:string;endsAt:string;
  myAvailability:"AVAILABLE"|"UNAVAILABLE"|"UNSURE"|null;
};
export type PlayerFriendlyFixture={
  id:string;teamId:string;teamName:string;opponentName:string;proposedAt:string;
  venueName:string|null;status:string;
};
export type PlayerActivities={
  competitions:PlayerParticipation[];matches:PlayerMatchItem[];
  activities:PlayerTeamEvent[];friendlies:PlayerFriendlyFixture[];
};
export const playerActivityApi={
  list:(token:string)=>request<PlayerActivities>("/api/v1/player-dashboard/activities",{},token),
};

export type PlayerCareerResult="WIN"|"DRAW"|"LOSS"|"UNKNOWN";
export type PlayerCareerMatch={
  matchId:string;teamId:string;teamName:string;competitionId:string;competitionName:string;
  recordedAt:string;startsAt:string|null;goals:number;assists:number;yellowCards:number;
  redCards:number;cleanSheet:boolean;playerOfMatch:boolean;homeScore:number|null;
  awayScore:number|null;result:PlayerCareerResult;
};
export type PlayerCareerTotals={
  matches:number;goals:number;assists:number;yellowCards:number;redCards:number;
  cleanSheets:number;playerOfMatch:number;wins:number;draws:number;losses:number;
  unknownResults:number;winRate:number;
};
export type PlayerCareerAward={
  id:string;kind:"CHAMPION"|"PLAYER_OF_MATCH"|"MILESTONE";label:string;
  competitionId:string|null;competitionName:string|null;teamId:string|null;teamName:string|null;
  matchId:string|null;achievedAt:string;verified:true;
};
export type PlayerCareerData={
  visibility:"PUBLIC"|"PRIVATE";totals:PlayerCareerTotals;records:PlayerCareerMatch[];
  achievements:PlayerCareerAward[];
  teams:Array<{id:string;name:string}>;competitions:Array<{id:string;name:string}>;
};
export const playerCareerApi={
  mine:(token:string)=>request<PlayerCareerData>("/api/v1/player-dashboard/career",{},token),
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
  whatsappGroups:Record<string,string>;
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

export type TeamExtraSlot={
  id:string;userId:string;teamId:string|null;teamName:string|null;
  status:"PENDING"|"ACTIVE"|"EXPIRED"|"CANCELLED";
  monthlyPriceAfn:number;requestedAt:string;activeUntil:string|null;
  paymentReference:string|null;username?:string|null;displayName?:string;
};
export type TeamCapacity={
  baseActive:boolean;monthlyPriceAfn:number;ownedTeams:number;canCreate:boolean;slots:TeamExtraSlot[];
};
export const teamApi = {
  capacity:(token:string)=>request<TeamCapacity>("/api/v1/teams/manager/capacity",{},token),
  requestSlot:(token:string,paymentReference:string,renewSlotId?:string)=>
    request<{slot:TeamExtraSlot}>("/api/v1/teams/manager/slots/request",
      {method:"POST",body:JSON.stringify({paymentReference,...(renewSlotId?{renewSlotId}:{})})},token),
  myProfile: (accessToken: string) =>
    request<{ player: OwnPlayerProfileDto }>("/api/v1/players/me", {}, accessToken),
  updateMyProfile: (accessToken: string, input: PlayerProfileUpdateRequest) =>
    request<{ player: OwnPlayerProfileDto }>("/api/v1/players/me", { method: "PATCH", body: JSON.stringify(input) }, accessToken),
  publicPlayer: (playerId: string) =>
    request<{ player: PublicPlayerProfileDto }>(`/api/v1/players/${playerId}`),
  discover:(token:string,input:import("@leaguekick/contracts").TeamDiscoveryQuery)=>
    request<import("@leaguekick/contracts").TeamDiscoveryResponse>(
      "/api/v1/teams/discover?"+new URLSearchParams({
        q:input.q,province:input.province,city:input.city,district:input.district,
        sort:input.sort,scope:input.scope,page:String(input.page),limit:String(input.limit),
      }).toString(),{},token),
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
  cancelJoin: (accessToken: string, teamId: string) =>
    request<{ request: TeamJoinRequestDto }>(`/api/v1/teams/${teamId}/join-request`, { method: "DELETE" }, accessToken),
  publicJoinPolicy: (teamId: string) =>
    request<{ allowJoinRequests: boolean }>(`/api/v1/teams/${teamId}/join-policy`),
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



export type AdminTrustRecord={id:string;kind?:"POST"|"COMMENT"|"PROMOTION";body?:string;
  imageUrl?:string|null;status:string;author?:string;authorUserId?:string;
  targetType?:string;targetId?:string;category?:string;description?:string;
  resolutionNote?:string|null;subject?:string;priority?:string;requesterUserId?:string;
  assignedToUserId?:string|null;title?:string;audience?:string;audienceValue?:string|null;
  scheduledAt?:string;totalRecipients?:number;deliveredRecipients?:number;
  createdAt:string;updatedAt?:string;note?:string};
export type AdminTrustPage={items:AdminTrustRecord[];total:number;page:number;pageSize:number;hasMore:boolean};
export type AdminSupportEvent={id:string;actorUserId:string;action:string;note:string;
  previousStatus:string|null;nextStatus:string|null;createdAt:string};
export type AdminTrustDelivery={notificationId:string;channel:string;status:string;attempts:number;
  lastAttemptAt:string|null;error:string|null;userId:string;title:string;createdAt:string};
export const trustApi={
  report:(token:string,input:{targetType:string;targetId:string;category:string;description:string})=>
    request<{id:string;status:string}>("/api/v1/trust/reports",{method:"POST",body:JSON.stringify(input)},token),
  myTickets:(token:string)=>request<AdminTrustPage>("/api/v1/trust/tickets",{},token),
  createTicket:(token:string,input:{category:string;subject:string;description:string})=>
    request<AdminTrustRecord>("/api/v1/trust/tickets",{method:"POST",body:JSON.stringify(input)},token),
  myTicket:(token:string,id:string)=>request<{ticket:AdminTrustRecord;events:AdminSupportEvent[]}>(
    "/api/v1/trust/tickets/"+encodeURIComponent(id),{},token),
  reply:(token:string,id:string,note:string)=>request<{updated:boolean}>(
    "/api/v1/trust/tickets/"+encodeURIComponent(id)+"/replies",{method:"POST",body:JSON.stringify({note})},token),
};
export const adminTrustApi={
  page:(token:string,section:"moderation"|"reports"|"support"|"announcements"|"deliveries",
    filters:{page:number;pageSize:number;status?:string;kind?:string;q?:string},signal?:AbortSignal)=>{
    const params=new URLSearchParams();
    for(const [k,v] of Object.entries(filters))if(v!==undefined)params.set(k,String(v));
    const path=section==="moderation"?"moderation/inventory":section==="support"?"support/tickets":
      section==="deliveries"?"delivery-health":section;
    return request<AdminTrustPage&{summary?:Array<{channel:string;status:string;total:number}>}>(
      "/api/v1/admin/"+path+"?"+params.toString(),signal?{signal}:{},token);
  },
  moderate:(token:string,kind:string,id:string,action:string,reason:string)=>
    request<{updated:boolean}>("/api/v1/admin/moderation/"+encodeURIComponent(kind)+"/"+encodeURIComponent(id),
      {method:"POST",body:JSON.stringify({action,reason})},token),
  reviewReport:(token:string,id:string,status:string,note:string)=>
    request<{item:AdminTrustRecord}>("/api/v1/admin/reports/"+encodeURIComponent(id),
      {method:"PATCH",body:JSON.stringify({status,note})},token),
  ticket:(token:string,id:string)=>request<{ticket:AdminTrustRecord;events:AdminSupportEvent[]}>(
    "/api/v1/admin/support/tickets/"+encodeURIComponent(id),{},token),
  updateTicket:(token:string,id:string,input:{status:string;priority:string;
    assignedToUserId:string|null;note:string})=>
    request<{item:AdminTrustRecord}>("/api/v1/admin/support/tickets/"+encodeURIComponent(id),
      {method:"PATCH",body:JSON.stringify(input)},token),
  ticketReply:(token:string,id:string,note:string)=>request<{updated:boolean}>(
    "/api/v1/admin/support/tickets/"+encodeURIComponent(id)+"/replies",
    {method:"POST",body:JSON.stringify({note})},token),
  createAnnouncement:(token:string,input:{title:string;body:string;audience:string;
    audienceValue:string|null;scheduledAt:string})=>
    request<{item:AdminTrustRecord}>("/api/v1/admin/announcements",
      {method:"POST",body:JSON.stringify(input)},token),
  cancelAnnouncement:(token:string,id:string,reason:string)=>
    request<{cancelled:boolean}>("/api/v1/admin/announcements/"+encodeURIComponent(id)+"/cancel",
      {method:"POST",body:JSON.stringify({reason})},token),
  processDue:(token:string)=>request<{processed:boolean}>("/api/v1/admin/announcements/process-due",
    {method:"POST"},token),
  requeue:(token:string,id:string,reason:string)=>request<{queued:boolean}>(
    "/api/v1/admin/delivery-health/"+encodeURIComponent(id)+"/requeue",
    {method:"POST",body:JSON.stringify({reason})},token),
};

export const adminApi = {
  billingReceipts:(token:string,filters:import("@leaguekick/contracts").AdminBillingFilters,
    signal?:AbortSignal)=>{
    const params=new URLSearchParams();
    for(const [key,value] of Object.entries(filters)){
      if(value!==undefined&&value!==null&&String(value).trim()!=="")params.set(key,String(value));
    }
    return request<{items:import("@leaguekick/contracts").AdminBillingReceipt[];total:number;
      page:number;pageSize:number;hasMore:boolean}>(
      "/api/v1/admin/billing/receipts?"+params.toString(),signal?{signal}:{},token);
  },
  billingSummary:(token:string,filters:Pick<import("@leaguekick/contracts").AdminBillingFilters,"from"|"to">,
    signal?:AbortSignal)=>{
    const params=new URLSearchParams();
    if(filters.from)params.set("from",filters.from);
    if(filters.to)params.set("to",filters.to);
    return request<import("@leaguekick/contracts").AdminBillingSummary>(
      "/api/v1/admin/billing/summary?"+params.toString(),signal?{signal}:{},token);
  },
  voidPaidReceipt:(token:string,id:string,reason:string)=>
    request<{voided:boolean}>("/api/v1/admin/billing/paid-receipts/"+encodeURIComponent(id)+"/void",
      {method:"POST",body:JSON.stringify({reason})},token),

  operationsPage:(token:string,kind:import("@leaguekick/contracts").AdminOperationKind,
    filters:Partial<import("@leaguekick/contracts").AdminOperationFilters>,signal?:AbortSignal)=>{
    const params=new URLSearchParams();
    for(const [key,value] of Object.entries(filters)){
      if(value!==undefined&&value!==null&&String(value).trim()!=="")params.set(key,String(value));
    }
    return request<{items:import("@leaguekick/contracts").AdminOperationItem[];total:number;page:number;pageSize:number;hasMore:boolean}>(
      "/api/v1/admin/operations/"+kind+"?"+params.toString(),signal?{signal}:{},token);
  },
  operationDetail:(token:string,kind:import("@leaguekick/contracts").AdminOperationKind,
    id:string,signal?:AbortSignal)=>request<{detail:import("@leaguekick/contracts").AdminOperationDetail}>(
    "/api/v1/admin/operations/"+kind+"/"+encodeURIComponent(id),signal?{signal}:{},token),
  operationDuplicates:(token:string,signal?:AbortSignal)=>
    request<{groups:Array<{key:string;count:number;items:import("@leaguekick/contracts").AdminOperationItem[]}>}>(
      "/api/v1/admin/operations/venues/duplicates",signal?{signal}:{},token),
  operationCases:(token:string,kind:import("@leaguekick/contracts").AdminOperationKind,id:string,signal?:AbortSignal)=>
    request<{items:import("@leaguekick/contracts").AdminCaseDto[]}>(
      "/api/v1/admin/operations/"+kind+"/"+encodeURIComponent(id)+"/cases",signal?{signal}:{},token),
  adminCases:(token:string,filters:{page:number;pageSize:number;state?:string|undefined;targetType?:string|undefined},signal?:AbortSignal)=>
    request<{items:import("@leaguekick/contracts").AdminCaseDto[];total:number;page:number;pageSize:number;hasMore:boolean}>(
      "/api/v1/admin/cases?"+new URLSearchParams(Object.entries(filters)
        .filter(([,value])=>value!==undefined).map(([key,value])=>[key,String(value)])).toString(),
      signal?{signal}:{},token),
  openAdminCase:(token:string,input:{targetType:import("@leaguekick/contracts").AdminOperationKind;
    targetId:string;reason:string;note:string})=>
    request<{item:import("@leaguekick/contracts").AdminCaseDto}>("/api/v1/admin/cases",
      {method:"POST",body:JSON.stringify(input)},token),
  updateAdminCase:(token:string,id:string,input:{state:"OPEN"|"UNDER_REVIEW"|"RESOLVED";reason:string;note:string})=>
    request<{item:import("@leaguekick/contracts").AdminCaseDto}>(
      "/api/v1/admin/cases/"+encodeURIComponent(id),
      {method:"PATCH",body:JSON.stringify(input)},token),
  teamSlots:(token:string)=>request<{slots:TeamExtraSlot[]}>("/api/v1/admin/team-slots",{},token),
  activateTeamSlot:(token:string,id:string,months:number,paymentReference:string)=>
    request<{slot:TeamExtraSlot}>(`/api/v1/admin/team-slots/${id}/activate`,
      {method:"POST",body:JSON.stringify({months,paymentReference})},token),
  manualTeams: (accessToken: string) =>
    request<{ teams: AdminManualTeamDto[] }>("/api/v1/admin/manual-teams", {}, accessToken),
  assignManualTeam: (accessToken: string, teamId: string, input: ManualTeamClaimRequest) =>
    request<{ assignment: { teamId: string; managerUserId: string; claimedAt: string } }>(
      `/api/v1/admin/manual-teams/${teamId}/assign`,
      { method: "POST", body: JSON.stringify(input) }, accessToken),
  analytics:(accessToken:string,days:7|30|90|365,signal?:AbortSignal)=>
    request<import("@leaguekick/contracts").AdminAnalyticsResponse>(
      `/api/v1/admin/analytics?days=${days}`,signal?{signal}:{},accessToken),
  dashboard: (accessToken: string) =>
    request<AdminDashboardResponse>("/api/v1/admin/dashboard", {}, accessToken),
  usersPage:(accessToken:string,q="",page=1,pageSize=25,signal?:AbortSignal,sort:"newest"|"oldest"="newest",filters:import("@leaguekick/contracts").AdminUserDirectoryFilter={})=>
    request<{users:AdminUserDto[];total:number;page:number;pageSize:number;hasMore:boolean}>(
      `/api/v1/admin/users/page?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}&sort=${sort}${filters.status?"&status="+filters.status:""}${filters.role?"&role="+filters.role:""}${filters.city?"&city="+encodeURIComponent(filters.city):""}`,signal?{signal}:{},accessToken),
  venuesPage:(accessToken:string,q="",page=1,pageSize=25,signal?:AbortSignal,sort:"newest"|"oldest"="newest")=>
    request<{venues:AdminVenueDto[];total:number;page:number;pageSize:number;hasMore:boolean}>(
      `/api/v1/admin/venues/page?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}&sort=${sort}`,signal?{signal}:{},accessToken),
  users: (accessToken: string, q = "") =>
    request<{ users: AdminUserDto[] }>(`/api/v1/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`, {}, accessToken),
  userDetail:(accessToken:string,userId:string,signal?:AbortSignal)=>
    request<{detail:import("@leaguekick/contracts").AdminUserDetailDto}>(
      "/api/v1/admin/users/"+encodeURIComponent(userId),signal?{signal}:{},accessToken),
  revokeUserSessions:(accessToken:string,userId:string,reason:string)=>
    request<{revoked:boolean}>("/api/v1/admin/users/"+encodeURIComponent(userId)+"/revoke-sessions",
      {method:"POST",body:JSON.stringify({reason})},accessToken),
  userNote:(accessToken:string,userId:string,reason:string,note:string)=>
    request<{created:boolean}>("/api/v1/admin/users/"+encodeURIComponent(userId)+"/notes",
      {method:"POST",body:JSON.stringify({reason,note})},accessToken),
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
  auditPage:(accessToken:string,filters:import("@leaguekick/contracts").AdminAuditFilter,signal?:AbortSignal)=>{
    const params=new URLSearchParams();
    for(const [key,value] of Object.entries(filters)){
      if(value!==undefined&&value!==null&&String(value).trim())params.set(key,String(value));
    }
    return request<{items:AdminAuditLogDto[];page:number;pageSize:number;total:number;hasMore:boolean}>(
      "/api/v1/admin/audit/page?"+params.toString(),signal?{signal}:{},accessToken);
  },
  auditExport:async(accessToken:string,filters:import("@leaguekick/contracts").AdminAuditFilter)=>{
    const params=new URLSearchParams();
    for(const [key,value] of Object.entries(filters)){
      if(value!==undefined&&value!==null&&String(value).trim())params.set(key,String(value));
    }
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
    try{
      const response=await fetch(baseUrl+"/api/v1/admin/audit/export?"+params.toString(),{
        signal:controller.signal,headers:{Authorization:"Bearer "+accessToken,Accept:"text/csv"},
        cache:"no-store",
      });
      if(!response.ok){
        const payload=await response.json().catch(()=>null) as ApiErrorBody|null;
        throw new ApiRequestError(payload?.error?.code??"AUDIT_EXPORT_FAILED",
          payload?.error?.message??"Audit export failed.",response.status,
          payload?.error?.requestId??response.headers.get("X-Request-Id"));
      }
      return response.text();
    }catch(e){
      if(e instanceof ApiRequestError)throw e;
      throw new ApiRequestError("AUDIT_EXPORT_FAILED","Could not export audit records.",null);
    }finally{clearTimeout(timeout);}
  },
  diagnostics:(accessToken:string,signal?:AbortSignal)=>
    request<import("@leaguekick/contracts").AdminDiagnostics>("/api/v1/admin/diagnostics",
      signal?{signal}:{},accessToken),

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
  venueMatches:(venueId:string,scope:"upcoming"|"results",page=1,
    filters?:{competitionId?:string;teamId?:string;year?:number;month?:number;week?:number})=>{
    const params=new URLSearchParams({scope,page:String(page),limit:"12"});
    if(filters?.competitionId)params.set("competitionId",filters.competitionId);
    if(filters?.teamId)params.set("teamId",filters.teamId);
    if(filters?.year!==undefined)params.set("year",String(filters.year));
    if(filters?.month!==undefined)params.set("month",String(filters.month));
    if(filters?.week!==undefined)params.set("week",String(filters.week));
    return networkRequest<VenueMatchPage>(
      `/api/v1/venues/${encodeURIComponent(venueId)}/competition-matches?${params.toString()}`,
      {cache:"no-store"});
  },
  myParticipations:(accessToken:string,competitionId?:string)=>
    request<CompetitionParticipationsResponse>(
      competitionId?`/api/v1/competitions/${competitionId}/participation`:
        "/api/v1/competitions/participation",
      {cache:"no-store"},accessToken),

  discover:(options:CompetitionDiscoveryQuery,accessToken?:string)=>
    request<CompetitionDiscoveryResponse>(
      "/api/v1/competitions/discover"+(accessToken?"/private":"")+
      "?"+new URLSearchParams(Object.entries(options).filter(([,value])=>
        value!==undefined&&value!==null&&String(value)!=="").map(([key,value])=>
          [key,String(value)])).toString(),
      {cache:"no-store"},accessToken),

  list: () =>
    request<{ generatedAt: string; competitions: CompetitionListItemDto[] }>("/api/v1/competitions"),
  mine: (accessToken:string) =>
    request<{ generatedAt:string; competitions:CompetitionListItemDto[] }>(
      "/api/v1/competitions/mine",{},accessToken),
  get: (competitionId: string) =>
    request<{ competition: CompetitionDto }>(`/api/v1/competitions/${competitionId}`),
  match: (competitionId:string,matchId:string)=>
    request<CompetitionPublicMatchDetail>(
      `/api/v1/competitions/${competitionId}/matches/${matchId}`),
  media: (competitionId: string) =>
    request<{ posts: CompetitionMediaPostDto[] }>(`/api/v1/competitions/${competitionId}/media`),
  mediaPage:(competitionId:string,options:{
    page?:number;limit?:number;kind?:"all"|"photos";sort?:"newest"|"oldest";
  }={})=>
    request<{posts:CompetitionMediaPostDto[];page:number;limit:number;hasMore:boolean}>(
      `/api/v1/competitions/${encodeURIComponent(competitionId)}/media?`+
      new URLSearchParams({
        page:String(options.page??1),limit:String(options.limit??12),
        kind:options.kind??"all",sort:options.sort??"newest",
      }).toString(),{cache:"no-store"}),
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

export type RefereeAvailabilitySlot={day:number;start:string;end:string};
export type RefereeAvailabilityException={date:string;available:boolean};
export type RefereeProfile={
  level:string|null;experienceYears:number;biography:string|null;
  weeklyAvailability:RefereeAvailabilitySlot[];exceptions:RefereeAvailabilityException[];
};
export type RefereeVenue={
  id:string;name:string;city:string;province:string;address:string;
  latitude:number|null;longitude:number|null;
};
export type RefereeMatch={
  id:string;competitionId:string;competitionName:string;format:string;
  homeTeamId:string|null;awayTeamId:string|null;homeTeamName:string;awayTeamName:string;
  venueId:string|null;venueName:string;venueAddress:string;
  latitude:number|null;longitude:number|null;
  startsAt:string|null;endsAt:string|null;durationMinutes:number;
  matchStatus:string;homeScore:number|null;awayScore:number|null;
  responseStatus:"PENDING"|"ACCEPTED"|"DECLINED"|"WITHDRAW_REQUESTED";
  responseReason:string|null;respondedAt:string|null;authorized:boolean;
  reportStatus:string|null;reportStartedAt:string|null;reportFinishedAt:string|null;
};
export type RefereeOverview={
  person:{id:string;name:string;city:string|null;image:string|null;status:string};
  venues:RefereeVenue[];profile:RefereeProfile;assignments:RefereeMatch[];
  stats:{total:number;upcoming:number;pending:number;completed:number;accepted:number;declined:number};
  nextMatch:RefereeMatch|null;
};
export type RefereeMatchClock={elapsedSeconds:number;period:number;runningSince:string|null};
export type RefereeMatchChecks={homePresent:boolean;awayPresent:boolean;rosterChecked:boolean;venueReady:boolean};
export type RefereeMatchEvent={id:string;kind:"GOAL"|"YELLOW_CARD"|"RED_CARD"|"FOUL"|"TIMEOUT"|"SUBSTITUTION"|"INCIDENT";
  side:"HOME"|"AWAY"|null;playerUserId:string|null;assistingUserId?:string|null;
  elapsedSeconds:number;period:number;details:string};
export type RefereeMatchReport={
  matchId:string;status:"DRAFT"|"SUBMITTED"|"CHANGES_REQUESTED"|"APPROVING"|"APPROVED";
  events:RefereeMatchEvent[];checks:RefereeMatchChecks;clock:RefereeMatchClock;
  currentSeconds:number;score:{homeScore:number;awayScore:number};
  startedAt:string|null;finishedAt:string|null;summary:string;revision:number;
  submittedAt:string|null;reviewedAt:string|null;feedback:string|null;
};
export type RefereeReportMatch={
  id:string;competitionId:string;homeTeamId:string|null;awayTeamId:string|null;
  matchStatus:string;stage:string;startsAt:string|null;durationMinutes:number;
};
export type RefereeReportMember={teamId:string;userId:string;name:string;shirtNumber:number|null};
export type OrganizerRefereeReport=RefereeMatchReport&{
  refereeName:string;refereeUserId:string;competitionId:string;
  homeTeamId:string|null;awayTeamId:string|null;matchStatus:string;
  homeTeamName:string;awayTeamName:string;
};
export const refereePhase2Api={
  get:(token:string,matchId:string)=>request<{report:RefereeMatchReport|null;match:RefereeReportMatch;roster:RefereeReportMember[]}>(
    `/api/v1/referee/matches/${matchId}/report`,{},token),
  update:(token:string,matchId:string,input:{revision:number;checks?:RefereeMatchChecks;summary?:string})=>
    request<{report:RefereeMatchReport}>(`/api/v1/referee/matches/${matchId}/report`,
      {method:"PATCH",body:JSON.stringify(input)},token),
  clock:(token:string,matchId:string,action:"START"|"PAUSE"|"RESUME"|"NEXT_PERIOD"|"FINISH",revision:number)=>
    request<{report:RefereeMatchReport}>(`/api/v1/referee/matches/${matchId}/clock`,
      {method:"POST",body:JSON.stringify({action,revision})},token),
  event:(token:string,matchId:string,input:Omit<RefereeMatchEvent,"elapsedSeconds">&{elapsedSeconds?:number;recordedOffline?:boolean})=>
    request<{report:RefereeMatchReport}>(`/api/v1/referee/matches/${matchId}/events`,
      {method:"POST",body:JSON.stringify(input)},token),
  removeEvent:(token:string,matchId:string,eventId:string,revision:number,reason:string)=>
    request<{report:RefereeMatchReport}>(`/api/v1/referee/matches/${matchId}/events/${eventId}`,
      {method:"DELETE",body:JSON.stringify({revision,reason})},token),
  submit:(token:string,matchId:string,revision:number)=>
    request<{report:RefereeMatchReport}>(`/api/v1/referee/matches/${matchId}/submit`,
      {method:"POST",body:JSON.stringify({revision})},token),
  organizerReports:(token:string,competitionId:string)=>
    request<{reports:OrganizerRefereeReport[]}>(`/api/v1/owner/referee-reports/${competitionId}`,{},token),
  review:(token:string,matchId:string,action:"APPROVE"|"RETURN",feedback:string,confirmImpact=false)=>
    request<{report:RefereeMatchReport}>(`/api/v1/owner/referee-reports/${matchId}/review`,
      {method:"POST",body:JSON.stringify({action,feedback,confirmImpact})},token),
};
export type RefereeCareerWindow="7d"|"30d"|"90d"|"year"|"all";
export type RefereeCareerCalendar="gregory"|"persian";
export type RefereeCareerResponse={
  period:RefereeCareerWindow;calendar:RefereeCareerCalendar;
  total:number;finishedReports:number;
  competitionsCount:number;submitted:number;onTime:number;
  submissionRate:number;onTimeRate:number;
  awaitingReview:number;correctionsRequested:number;draftReports:number;
  averageSubmissionHours:number|null;
  events:{GOAL:number;YELLOW_CARD:number;RED_CARD:number;FOUL:number;TIMEOUT:number;INCIDENT:number};
  monthly:Array<{month:string;matches:number}>;
  competitions:Array<{id:string;name:string;matches:number}>;
  venues:Array<{id:string;name:string;matches:number}>;
  history:Array<{matchId:string;competitionId:string;competitionName:string;
    venueId:string;venueName:string;
    homeName:string;awayName:string;finishedAt:string|null;
    homeScore:number|null;awayScore:number|null}>;
};
export const refereeCareerApi={
  career:(token:string,period:RefereeCareerWindow,calendar:RefereeCareerCalendar="gregory")=>
    request<RefereeCareerResponse>(`/api/v1/referee/career?period=${period}&calendar=${calendar}`,{},token),
  pdfTicket:(token:string,matchId:string,owner=false)=>
    request<{token:string;expiresAt:string}>(owner?
      `/api/v1/owner/referee-reports/${matchId}/pdf-ticket`:
      `/api/v1/referee/matches/${matchId}/pdf-ticket`,{method:"POST"},token),
  pdfUrl:(ticket:string)=>`${baseUrl}/api/v1/referee/reports/download/${ticket}`,
};
export const refereeApi={
  overview:(token:string)=>request<RefereeOverview>("/api/v1/referee/overview",{},token),
  updateProfile:(token:string,input:RefereeProfile)=>
    request<{profile:RefereeProfile}>("/api/v1/referee/profile",{method:"PUT",body:JSON.stringify(input)},token),
  respond:(token:string,matchId:string,action:"ACCEPTED"|"DECLINED"|"WITHDRAW_REQUESTED",reason?:string)=>
    request<{status:string}>(`/api/v1/referee/assignments/${matchId}/respond`,
      {method:"POST",body:JSON.stringify({action,...(reason?{reason}:{})})},token),
  organizerAssignments:(token:string,competitionId:string)=>
    request<{assignments:Array<{matchId:string;refereeUserId:string|null;status:string|null;reason:string|null}>}>(
      `/api/v1/owner/referee-assignments/${competitionId}`,{},token),
};
