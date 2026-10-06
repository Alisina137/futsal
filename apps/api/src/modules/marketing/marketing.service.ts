import type {
  FeedResponse,
  FollowStateDto,
  PromotionCreateRequest,
  PromotionDto,
  SocialEntityType,
  SocialFeedResponse,
  SocialFollowStateDto,
  SocialPostCommentCreateRequest,
  SocialPostCommentUpdateRequest,
  VenuePostCreateRequest,
  VenuePostDto,
} from "@leaguekick/contracts";
import { errors } from "../../lib/errors.js";
import type { BookingService } from "../booking/booking.service.js";
import type { MarketingRepository } from "./marketing.types.js";
import { mergeFeed } from "./marketing.types.js";
import type { NotificationPublisher } from "../notifications/notification.types.js";
import { hasPremiumWriteAccess } from "../billing/entitlement.js";

function localDateForInstant(instant: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(instant)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export class MarketingService {
  constructor(
    private readonly repository: MarketingRepository,
    private readonly booking: BookingService,
    private readonly now: () => Date = () => new Date(),
    private readonly notifications?: NotificationPublisher,
  ) {}

  private async ownerVenue(ownerUserId: string, requireWrite = true) {
    const venue = await this.repository.getOwnerVenue(ownerUserId);
    if (!venue) throw errors.badRequest("VENUE_REQUIRED", "Complete venue setup first.");
    if (venue.status === "SUSPENDED") throw errors.forbidden("VENUE_SUSPENDED", "This venue is suspended.");
    if (requireWrite && !hasPremiumWriteAccess(venue.subscription, this.now())) {
      throw errors.forbidden("SUBSCRIPTION_REQUIRED", "An active Premium trial or subscription is required.");
    }
    return venue;
  }

  async createPromotion(ownerUserId: string, input: PromotionCreateRequest): Promise<PromotionDto> {
    await this.repository.refreshPromotionStates(this.now());
    const venue = await this.ownerVenue(ownerUserId, true);
    const startsAt = new Date(input.startsAt);
    if (startsAt.getTime() <= this.now().getTime()) {
      throw errors.badRequest("PROMOTION_IN_PAST", "Choose a future available slot.");
    }

    const date = localDateForInstant(startsAt, venue.timezone);
    const availability = await this.booking.getAvailability(venue.id, date);
    const slot = availability.slots.find(
      (candidate) => candidate.areaId === input.areaId && candidate.startsAt === startsAt.toISOString(),
    );
    if (!slot) throw errors.conflict("SLOT_UNAVAILABLE", "Only a currently available future slot can be promoted.");
    if (input.discountedPriceAfn >= slot.priceAfn) {
      throw errors.badRequest("INVALID_DISCOUNT", "The promotion price must be lower than the current slot price.");
    }

    const promotion = await this.repository.createPromotion({
      venueId: venue.id,
      areaId: slot.areaId,
      startsAt: new Date(slot.startsAt),
      endsAt: new Date(slot.endsAt),
      originalPriceAfn: slot.priceAfn,
      discountedPriceAfn: input.discountedPriceAfn,
      title: input.title.trim(),
      note: input.note?.trim() || null,
      notifyFollowers: input.notifyFollowers,
      createdByUserId: ownerUserId,
      createdAt: this.now(),
    });
    if (input.notifyFollowers) {
      try {
        await this.notifications?.promotionPublished({
          venueId: venue.id,
          promotionId: promotion.id,
          venueName: venue.name,
          title: promotion.title,
          followerUserIds: await this.repository.listFollowerUserIds(venue.id),
        });
      } catch {
        // Publishing the promotion succeeds even if follower notification fan-out fails.
      }
    }
    return promotion;
  }

  async listOwnerPromotions(ownerUserId: string) {
    await this.ownerVenue(ownerUserId, false);
    await this.repository.refreshPromotionStates(this.now());
    return { promotions: await this.repository.listOwnerPromotions(ownerUserId), generatedAt: this.now().toISOString() };
  }

  async closePromotion(ownerUserId: string, promotionId: string) {
    await this.ownerVenue(ownerUserId, false);
    const promotion = await this.repository.closePromotion(ownerUserId, promotionId, "OWNER_CLOSED", this.now());
    if (!promotion) throw errors.forbidden("PROMOTION_ACCESS_DENIED", "You cannot manage this promotion.");
    return promotion;
  }

  async getPromotion(promotionId: string) {
    await this.repository.refreshPromotionStates(this.now());
    const promotion = await this.repository.getPromotion(promotionId);
    if (!promotion || promotion.status !== "ACTIVE") {
      throw errors.badRequest("PROMOTION_NOT_ACTIVE", "This promotion is no longer active.");
    }
    return promotion;
  }

  async createPost(ownerUserId: string, input: VenuePostCreateRequest): Promise<VenuePostDto> {
    await this.repository.refreshPromotionStates(this.now());
    const venue = await this.ownerVenue(ownerUserId, true);
    let targetId: string | null = input.ctaTargetId ?? null;

    if (input.ctaType === "VENUE") {
      targetId = venue.id;
    } else if (input.ctaType === "PROMOTION") {
      const promotion = targetId ? await this.repository.getPromotion(targetId) : null;
      if (!promotion || promotion.venueId !== venue.id || promotion.status !== "ACTIVE") {
        throw errors.badRequest("INVALID_POST_CTA", "Choose an active promotion from this venue.");
      }
    } else if (input.ctaType === "COMPETITION") {
      throw errors.badRequest("CTA_NOT_AVAILABLE", "Competition CTAs become available with the competition phase.");
    } else {
      targetId = null;
    }

    const post = await this.repository.createPost({
      venueId: venue.id,
      createdByUserId: ownerUserId,
      body: input.body.trim(),
      imageUrl: input.imageUrl?.trim() || null,
      ctaType: input.ctaType,
      ctaTargetId: targetId,
      publishedAt: this.now(),
    });
    if (input.notifyFollowers) {
      try {
        await this.notifications?.venuePostPublished({
          venueId: venue.id,
          postId: post.id,
          venueName: venue.name,
          followerUserIds: await this.repository.listFollowerUserIds(venue.id),
        });
      } catch {
        // Publishing the post succeeds even if follower notification fan-out fails.
      }
    }
    return post;
  }

  async listOwnerPosts(ownerUserId: string) {
    await this.ownerVenue(ownerUserId, false);
    return { posts: await this.repository.listOwnerPosts(ownerUserId), generatedAt: this.now().toISOString() };
  }

  async setPostPublished(ownerUserId: string, postId: string, published: boolean) {
    const venue = await this.ownerVenue(ownerUserId, published);
    if (published) {
      await this.repository.refreshPromotionStates(this.now());
      const current = await this.repository.getPost(postId);
      if (!current || current.venueId !== venue.id) {
        throw errors.forbidden("POST_ACCESS_DENIED", "You cannot manage this post.");
      }
      if (current.ctaType === "PROMOTION" && current.ctaTargetId) {
        const promotion = await this.repository.getPromotion(current.ctaTargetId);
        if (!promotion || promotion.venueId !== venue.id || promotion.status !== "ACTIVE") {
          throw errors.badRequest("INVALID_POST_CTA", "This post links to a promotion that is no longer active.");
        }
      }
    }

    const post = await this.repository.setPostStatus(
      ownerUserId,
      postId,
      published ? "PUBLISHED" : "UNPUBLISHED",
      this.now(),
    );
    if (!post) throw errors.forbidden("POST_ACCESS_DENIED", "You cannot manage this post.");
    return post;
  }

  async getPublicPost(postId: string) {
    const post = await this.repository.getPost(postId);
    if (!post || post.status !== "PUBLISHED") throw errors.badRequest("POST_NOT_FOUND", "This post is not public.");
    const venue = await this.repository.getVenue(post.venueId);
    if (!venue || venue.status !== "ACTIVE") throw errors.badRequest("POST_NOT_FOUND", "This post is not public.");
    return post;
  }

  async feed(userId?: string, followingOnly = false): Promise<FeedResponse> {
    await this.repository.refreshPromotionStates(this.now());
    const venueIds = followingOnly
      ? userId
        ? await this.repository.listFollowedVenueIds(userId)
        : []
      : undefined;

    const [promotions, posts] = await Promise.all([
      this.repository.listActivePromotions(venueIds),
      this.repository.listPublishedPosts(venueIds),
    ]);

    return {
      generatedAt: this.now().toISOString(),
      items: mergeFeed(promotions, posts).slice(0, 100),
    };
  }

  private async requireSocialEntity(entityType: SocialEntityType, entityId: string) {
    const entity = await this.repository.getSocialEntity(entityType, entityId);
    if (!entity) throw errors.badRequest("SOCIAL_ENTITY_NOT_FOUND", "This page is not available.");
    return entity;
  }

  async socialFeed(userId: string): Promise<SocialFeedResponse> {
    return {
      generatedAt: this.now().toISOString(),
      items: await this.repository.listSocialFeed(userId),
    };
  }

  async socialFollowState(
    userId: string,
    entityType: SocialEntityType,
    entityId: string,
  ): Promise<SocialFollowStateDto> {
    await this.requireSocialEntity(entityType, entityId);
    const [following, followerCount] = await Promise.all([
      this.repository.isFollowingEntity(userId, entityType, entityId),
      this.repository.socialFollowerCount(entityType, entityId),
    ]);
    return { entityType, entityId, following, followerCount };
  }

  async socialFollow(userId: string, entityType: SocialEntityType, entityId: string) {
    await this.requireSocialEntity(entityType, entityId);
    await this.repository.followEntity(userId, entityType, entityId);
    return this.socialFollowState(userId, entityType, entityId);
  }

  async socialUnfollow(userId: string, entityType: SocialEntityType, entityId: string) {
    await this.requireSocialEntity(entityType, entityId);
    await this.repository.unfollowEntity(userId, entityType, entityId);
    return this.socialFollowState(userId, entityType, entityId);
  }

  async likeSocialPost(userId: string, postId: string) {
    const post = await this.repository.likeSocialPost(userId, postId);
    if (!post) throw errors.badRequest("SOCIAL_POST_NOT_FOUND", "This post is no longer available.");
    return post;
  }

  async unlikeSocialPost(userId: string, postId: string) {
    const post = await this.repository.unlikeSocialPost(userId, postId);
    if (!post) throw errors.badRequest("SOCIAL_POST_NOT_FOUND", "This post is no longer available.");
    return post;
  }

  async socialComments(userId: string, postId: string) {
    const post = await this.repository.getSocialPost(userId, postId);
    if (!post) throw errors.badRequest("SOCIAL_POST_NOT_FOUND", "This post is no longer available.");
    return {
      post,
      comments: await this.repository.listSocialComments(userId, postId),
    };
  }

  async addSocialComment(userId: string, postId: string, input: SocialPostCommentCreateRequest) {
    const post = await this.repository.getSocialPost(userId, postId);
    if (!post) throw errors.badRequest("SOCIAL_POST_NOT_FOUND", "This post is no longer available.");
    const comment = await this.repository.addSocialComment(userId, postId, input.body.trim(), this.now());
    if (!comment) throw errors.badRequest("SOCIAL_POST_NOT_FOUND", "This post is no longer available.");
    return comment;
  }

  async updateSocialComment(
    userId: string,
    postId: string,
    commentId: string,
    input: SocialPostCommentUpdateRequest,
  ) {
    const comment = await this.repository.updateSocialComment(
      userId,
      postId,
      commentId,
      input.body.trim(),
      this.now(),
    );
    if (!comment) {
      throw errors.forbidden("COMMENT_ACCESS_DENIED", "You can only edit your own comment.");
    }
    return comment;
  }

  async deleteSocialComment(userId: string, postId: string, commentId: string) {
    const deleted = await this.repository.deleteSocialComment(userId, postId, commentId);
    if (!deleted) {
      throw errors.forbidden("COMMENT_ACCESS_DENIED", "You can only delete your own comment.");
    }
    return { deleted: true };
  }

  async likeSocialComment(userId: string, postId: string, commentId: string) {
    const comment = await this.repository.likeSocialComment(userId, postId, commentId);
    if (!comment) throw errors.badRequest("COMMENT_NOT_FOUND", "This comment is no longer available.");
    return comment;
  }

  async unlikeSocialComment(userId: string, postId: string, commentId: string) {
    const comment = await this.repository.unlikeSocialComment(userId, postId, commentId);
    if (!comment) throw errors.badRequest("COMMENT_NOT_FOUND", "This comment is no longer available.");
    return comment;
  }

  async followState(userId: string, venueId: string): Promise<FollowStateDto> {
    const venue = await this.repository.getVenue(venueId);
    if (!venue || venue.status !== "ACTIVE") throw errors.badRequest("VENUE_NOT_FOUND", "Venue not found.");
    const [following, followerCount] = await Promise.all([
      this.repository.isFollowing(userId, venueId),
      this.repository.followerCount(venueId),
    ]);
    return { venueId, following, followerCount };
  }

  async follow(userId: string, venueId: string): Promise<FollowStateDto> {
    const venue = await this.repository.getVenue(venueId);
    if (!venue || venue.status !== "ACTIVE") throw errors.badRequest("VENUE_NOT_FOUND", "Venue not found.");
    await this.repository.followVenue(userId, venueId);
    return this.followState(userId, venueId);
  }

  async unfollow(userId: string, venueId: string): Promise<FollowStateDto> {
    await this.repository.unfollowVenue(userId, venueId);
    return this.followState(userId, venueId);
  }

  listFollowerUserIds(venueId: string) {
    return this.repository.listFollowerUserIds(venueId);
  }
}
