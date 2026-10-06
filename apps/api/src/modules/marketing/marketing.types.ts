import type {
  FeedItemDto,
  PromotionDto,
  SocialEntityType,
  SocialFeedPostDto,
  SocialPostCommentDto,
  VenuePostDto,
} from "@leaguekick/contracts";

export type MarketingVenueRecord = {
  id: string;
  ownerUserId: string;
  name: string;
  timezone: string;
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
    body: string;
    imageUrl: string | null;
    ctaType: "NONE" | "VENUE" | "PROMOTION" | "COMPETITION";
    ctaTargetId: string | null;
    publishedAt: Date;
  }): Promise<VenuePostDto>;
  listOwnerPosts(ownerUserId: string): Promise<VenuePostDto[]>;
  listPublishedPosts(venueIds?: string[]): Promise<VenuePostDto[]>;
  getPost(postId: string): Promise<VenuePostDto | null>;
  setPostStatus(ownerUserId: string, postId: string, status: "PUBLISHED" | "UNPUBLISHED", changedAt: Date): Promise<VenuePostDto | null>;

  followVenue(userId: string, venueId: string): Promise<void>;
  unfollowVenue(userId: string, venueId: string): Promise<void>;
  isFollowing(userId: string, venueId: string): Promise<boolean>;
  followerCount(venueId: string): Promise<number>;
  listFollowedVenueIds(userId: string): Promise<string[]>;
  listFollowerUserIds(venueId: string): Promise<string[]>;

  getSocialEntity(entityType: SocialEntityType, entityId: string): Promise<MarketingSocialEntityRecord | null>;
  followEntity(userId: string, entityType: SocialEntityType, entityId: string): Promise<void>;
  unfollowEntity(userId: string, entityType: SocialEntityType, entityId: string): Promise<void>;
  isFollowingEntity(userId: string, entityType: SocialEntityType, entityId: string): Promise<boolean>;
  socialFollowerCount(entityType: SocialEntityType, entityId: string): Promise<number>;
  listSocialFeed(userId: string): Promise<SocialFeedPostDto[]>;
  getSocialPost(userId: string, postId: string): Promise<SocialFeedPostDto | null>;
  likeSocialPost(userId: string, postId: string): Promise<SocialFeedPostDto | null>;
  unlikeSocialPost(userId: string, postId: string): Promise<SocialFeedPostDto | null>;
  listSocialComments(postId: string): Promise<SocialPostCommentDto[]>;
  addSocialComment(userId: string, postId: string, body: string, createdAt: Date): Promise<SocialPostCommentDto | null>;
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
