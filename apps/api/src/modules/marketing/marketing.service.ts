import type {
  FeedResponse,
  FollowStateDto,
  PromotionCreateRequest,
  PromotionDto,
  VenuePostCreateRequest,
  VenuePostDto,
} from "@leaguekick/contracts";
import { errors } from "../../lib/errors.js";
import type { BookingService } from "../booking/booking.service.js";
import type { MarketingRepository, MarketingVenueRecord } from "./marketing.types.js";
import { mergeFeed } from "./marketing.types.js";

function entitlementActive(venue: MarketingVenueRecord, now: Date) {
  if (venue.status !== "ACTIVE" || !venue.subscription) return false;
  if (venue.subscription.status === "TRIAL") {
    return Boolean(venue.subscription.trialEndsAt && venue.subscription.trialEndsAt.getTime() > now.getTime());
  }
  if (venue.subscription.status === "ACTIVE") {
    return !venue.subscription.activeUntil || venue.subscription.activeUntil.getTime() > now.getTime();
  }
  return false;
}

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
  ) {}

  private async ownerVenue(ownerUserId: string, requireWrite = true) {
    const venue = await this.repository.getOwnerVenue(ownerUserId);
    if (!venue) throw errors.badRequest("VENUE_REQUIRED", "Complete venue setup first.");
    if (venue.status === "SUSPENDED") throw errors.forbidden("VENUE_SUSPENDED", "This venue is suspended.");
    if (requireWrite && !entitlementActive(venue, this.now())) {
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

    return this.repository.createPromotion({
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

    return this.repository.createPost({
      venueId: venue.id,
      createdByUserId: ownerUserId,
      body: input.body.trim(),
      imageUrl: input.imageUrl?.trim() || null,
      ctaType: input.ctaType,
      ctaTargetId: targetId,
      publishedAt: this.now(),
    });
  }

  async listOwnerPosts(ownerUserId: string) {
    await this.ownerVenue(ownerUserId, false);
    return { posts: await this.repository.listOwnerPosts(ownerUserId), generatedAt: this.now().toISOString() };
  }

  async setPostPublished(ownerUserId: string, postId: string, published: boolean) {
    if (published) await this.ownerVenue(ownerUserId, true);
    else await this.ownerVenue(ownerUserId, false);

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
