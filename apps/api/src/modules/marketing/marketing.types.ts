import type {
  FeedItemDto,
  FollowedVenueDto,
  PromotionDto,
  SocialEntityType,
  SocialFeedPostDto,
  SocialPostCommentDto,
  VenuePostCreateRequest,
  VenuePostDto,
  VenuePostScheduleDto,
  VenuePostScheduleRequest,
  VenuePostUpdateRequest,
  VenuePostVisibility,
  VenueMediaAssetPurpose,
  VenueMediaPageUpdateRequest,
} from "@leaguekick/contracts";

export type MarketingVenueRecord = {
  id: string;
  ownerUserId: string;
  name: string;
  city?: string;
  province?: string;
  timezone: string;
  pageProfileImageUrl?: string | null;
  pageCoverImageUrl?: string | null;
  pageBio?: string | null;
  status: "DRAFT" | "READY" | "ACTIVE" | "SUSPENDED";
  subscription: {
    status: "TRIAL" | "ACTIVE" | "EXPIRED" | "CANCELLED";
    trialEndsAt: Date | null;
    activeUntil: Date | null;
  } | null;
};

export type MarketingSocialEntityRecord = {
  id: string;
  type: SocialEntityType;
  name: string;
  imageUrl: string | null;
};

export interface MarketingRepository {
  getOwnerVenue(ownerUserId: string): Promise<MarketingVenueRecord | null>;
  getVenue(venueId: string): Promise<MarketingVenueRecord | null>;
  createPromotion(input: {
    venueId: string;
    areaId: string;
    startsAt: Date;
    endsAt: Date;
    originalPriceAfn: number;
    discountedPriceAfn: number;
    title: string;
    note: string | null;
    notifyFollowers: boolean;
    createdByUserId: string;
    createdAt: Date;
  }): Promise<PromotionDto>;
  listOwnerPromotions(ownerUserId: string): Promise<PromotionDto[]>;
  listActivePromotions(venueIds?: string[]): Promise<PromotionDto[]>;
  getPromotion(promotionId: string): Promise<PromotionDto | null>;
  closePromotion(ownerUserId: string, promotionId: string, reason: string, closedAt: Date): Promise<PromotionDto | null>;
  refreshPromotionStates(now: Date): Promise<void>;

  createPost(input: {
    venueId: string;
    createdByUserId: string;
    request: VenuePostCreateRequest;
    publishedAt: Date;
    initialStatus: "PUBLISHED" | "UNPUBLISHED";
  }): Promise<VenuePostDto>;
  updatePost(ownerUserId: string, postId: string, input: VenuePostUpdateRequest, changedAt: Date): Promise<VenuePostDto | null>;
  deletePost(ownerUserId: string, postId: string): Promise<boolean>;
  listOwnerPosts(ownerUserId: string): Promise<VenuePostDto[]>;
  listPublishedPosts(venueIds?: string[], visibility?: "PUBLIC" | "PUBLIC_OR_FOLLOWERS"): Promise<VenuePostDto[]>;
  listVenuePosts(venueId: string, visibility: "PUBLIC" | "PUBLIC_OR_FOLLOWERS"): Promise<VenuePostDto[]>;
  getPost(postId: string): Promise<VenuePostDto | null>;
  setPostStatus(ownerUserId: string, postId: string, status: "PUBLISHED" | "UNPUBLISHED", changedAt: Date): Promise<VenuePostDto | null>;
  setPostVisibility(ownerUserId: string, postId: string, visibility: VenuePostVisibility, changedAt: Date): Promise<VenuePostDto | null>;
  addPostSchedule(ownerUserId: string, postId: string, input: VenuePostScheduleRequest, createdAt: Date): Promise<VenuePostScheduleDto | null>;
  cancelPostSchedule(ownerUserId: string, postId: string, scheduleId: string, cancelledAt: Date): Promise<VenuePostScheduleDto | null>;
  refreshPostStates(now: Date): Promise<VenuePostDto[]>;
  competitionBelongsToVenue(competitionId: string, venueId: string): Promise<boolean>;
  createMediaAsset(input: {
    venueId: string;
    ownerUserId: string;
    purpose: VenueMediaAssetPurpose;
    publicToken: string;
    mimeType: string;
    byteSize: number;
    dataBase64: string;
    createdAt: Date;
  }): Promise<{
    id: string;
    venueId: string;
    ownerUserId: string;
    purpose: VenueMediaAssetPurpose;
    publicToken: string;
    mimeType: string;
    byteSize: number;
    dataBase64: string;
    createdAt: Date;
  }>;
  getMediaAsset(assetId: string, publicToken: string): Promise<{
    id: string;
    venueId: string;
    ownerUserId: string;
    purpose: VenueMediaAssetPurpose;
    publicToken: string;
    mimeType: string;
    byteSize: number;
    dataBase64: string;
    createdAt: Date;
  } | null>;
  updateVenueMediaPage(ownerUserId: string, input: VenueMediaPageUpdateRequest, updatedAt: Date): Promise<MarketingVenueRecord | null>;

  followVenue(userId: string, venueId: string): Promise<void>;
  unfollowVenue(userId: string, venueId: string): Promise<void>;
  isFollowing(userId: string, venueId: string): Promise<boolean>;
  followerCount(venueId: string): Promise<number>;
  listFollowedVenueIds(userId: string): Promise<string[]>;
  listFollowedVenues(userId: string): Promise<FollowedVenueDto[]>;
  listVenueFollowerCounts(venueIds:string[]):Promise<Record<string,number>>;
  listFollowerUserIds(venueId: string): Promise<string[]>;

  getSocialEntity(entityType: SocialEntityType, entityId: string): Promise<MarketingSocialEntityRecord | null>;
  followEntity(userId: string, entityType: SocialEntityType, entityId: string): Promise<void>;
  unfollowEntity(userId: string, entityType: SocialEntityType, entityId: string): Promise<void>;
  isFollowingEntity(userId: string, entityType: SocialEntityType, entityId: string): Promise<boolean>;
  socialFollowerCount(entityType: SocialEntityType, entityId: string): Promise<number>;
  listUserPosts(viewerId:string,userId:string):Promise<SocialFeedPostDto[]>;
  createUserPost(userId:string,body:string,imageUrl:string|null,createdAt:Date):Promise<SocialFeedPostDto>;
  deleteUserPost(userId:string,postId:string):Promise<boolean>;
  createUserPostImage(input:{ownerUserId:string;publicToken:string;mimeType:string;byteSize:number;dataBase64:string}):
    Promise<{id:string;ownerUserId:string;publicToken:string;mimeType:string;byteSize:number;dataBase64:string}>;
  getUserPostImage(assetId:string,publicToken:string):
    Promise<{id:string;ownerUserId:string;publicToken:string;mimeType:string;byteSize:number;dataBase64:string}|null>;
  listSocialFeed(userId: string): Promise<SocialFeedPostDto[]>;
  getSocialPost(userId: string, postId: string): Promise<SocialFeedPostDto | null>;
  likeSocialPost(userId: string, postId: string): Promise<SocialFeedPostDto | null>;
  unlikeSocialPost(userId: string, postId: string): Promise<SocialFeedPostDto | null>;
  listSocialComments(userId: string, postId: string): Promise<SocialPostCommentDto[]>;
  addSocialComment(userId: string, postId: string, body: string, createdAt: Date): Promise<SocialPostCommentDto | null>;
  updateSocialComment(userId: string, postId: string, commentId: string, body: string, editedAt: Date): Promise<SocialPostCommentDto | null>;
  deleteSocialComment(userId: string, postId: string, commentId: string): Promise<boolean>;
  likeSocialComment(userId: string, postId: string, commentId: string): Promise<SocialPostCommentDto | null>;
  unlikeSocialComment(userId: string, postId: string, commentId: string): Promise<SocialPostCommentDto | null>;
}

export function mergeFeed(promotions: PromotionDto[], posts: VenuePostDto[]): FeedItemDto[] {
  const items: FeedItemDto[] = [
    ...promotions.map((promotion) => ({
      type: "PROMOTION" as const,
      id: promotion.id,
      venueId: promotion.venueId,
      venueName: promotion.venueName,
      createdAt: promotion.createdAt,
      deepLink: `/venues/${promotion.venueId}?promotionId=${promotion.id}&startsAt=${encodeURIComponent(promotion.startsAt)}`,
      promotion,
    })),
    ...posts.map((post) => ({
      type: "POST" as const,
      id: post.id,
      venueId: post.venueId,
      venueName: post.venueName,
      createdAt: post.publishedAt,
      deepLink: `/posts/${post.id}`,
      post,
    })),
  ];
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
