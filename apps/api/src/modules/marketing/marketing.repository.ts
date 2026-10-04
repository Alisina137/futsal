import type { PromotionDto, VenuePostDto } from "@leaguekick/contracts";
import type { Database } from "@leaguekick/database";
import {
  bookings,
  venueAreas,
  venueBlocks,
  venueFollows,
  venuePosts,
  venuePromotions,
  venueSubscriptions,
  venues,
} from "@leaguekick/database";
import { and, count, desc, eq, gt, inArray, lt } from "drizzle-orm";
import { errors } from "../../lib/errors.js";
import type { MarketingRepository, MarketingVenueRecord } from "./marketing.types.js";

function discountPercent(original: number, discounted: number) {
  if (original <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((original - discounted) / original) * 100)));
}

function promotionDto(row: {
  id: string;
  venueId: string;
  venueName: string;
  areaId: string;
  areaName: string;
  startsAt: Date;
  endsAt: Date;
  originalPriceAfn: number;
  discountedPriceAfn: number;
  status: "ACTIVE" | "CLOSED" | "EXPIRED";
  title: string;
  note: string | null;
  notifyFollowers: boolean;
  createdAt: Date;
  closedAt: Date | null;
  closeReason: string | null;
}): PromotionDto {
  return {
    id: row.id,
    venueId: row.venueId,
    venueName: row.venueName,
    areaId: row.areaId,
    areaName: row.areaName,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    originalPriceAfn: row.originalPriceAfn,
    discountedPriceAfn: row.discountedPriceAfn,
    discountPercent: discountPercent(row.originalPriceAfn, row.discountedPriceAfn),
    currency: "AFN",
    status: row.status,
    title: row.title,
    note: row.note,
    notifyFollowers: row.notifyFollowers,
    createdAt: row.createdAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
    closeReason: row.closeReason,
  };
}

function postDto(row: {
  id: string;
  venueId: string;
  venueName: string;
  body: string;
  imageUrl: string | null;
  ctaType: "NONE" | "VENUE" | "PROMOTION" | "COMPETITION";
  ctaTargetId: string | null;
  status: "PUBLISHED" | "UNPUBLISHED";
  publishedAt: Date;
  unpublishedAt: Date | null;
}): VenuePostDto {
  return {
    id: row.id,
    venueId: row.venueId,
    venueName: row.venueName,
    body: row.body,
    imageUrl: row.imageUrl,
    ctaType: row.ctaType,
    ctaTargetId: row.ctaTargetId,
    status: row.status,
    publishedAt: row.publishedAt.toISOString(),
    unpublishedAt: row.unpublishedAt?.toISOString() ?? null,
  };
}

export class DrizzleMarketingRepository implements MarketingRepository {
  constructor(private readonly db: Database) {}

  private async hydrateVenue(row: typeof venues.$inferSelect): Promise<MarketingVenueRecord> {
    const [subscription] = await this.db.select().from(venueSubscriptions)
      .where(eq(venueSubscriptions.venueId, row.id))
      .limit(1);
    return {
      id: row.id,
      ownerUserId: row.ownerUserId,
      name: row.name,
      timezone: row.timezone,
      status: row.status,
      subscription: subscription ? {
        status: subscription.status,
        trialEndsAt: subscription.trialEndsAt,
        activeUntil: subscription.activeUntil,
      } : null,
    };
  }

  async getOwnerVenue(ownerUserId: string) {
    const [row] = await this.db.select().from(venues).where(eq(venues.ownerUserId, ownerUserId)).limit(1);
    return row ? this.hydrateVenue(row) : null;
  }

  async getVenue(venueId: string) {
    const [row] = await this.db.select().from(venues).where(eq(venues.id, venueId)).limit(1);
    return row ? this.hydrateVenue(row) : null;
  }

  private promotionProjection() {
    return this.db.select({
      id: venuePromotions.id,
      venueId: venuePromotions.venueId,
      venueName: venues.name,
      areaId: venuePromotions.areaId,
      areaName: venueAreas.name,
      startsAt: venuePromotions.startsAt,
      endsAt: venuePromotions.endsAt,
      originalPriceAfn: venuePromotions.originalPriceAfn,
      discountedPriceAfn: venuePromotions.discountedPriceAfn,
      status: venuePromotions.status,
      title: venuePromotions.title,
      note: venuePromotions.note,
      notifyFollowers: venuePromotions.notifyFollowers,
      createdAt: venuePromotions.createdAt,
      closedAt: venuePromotions.closedAt,
      closeReason: venuePromotions.closeReason,
    }).from(venuePromotions)
      .innerJoin(venues, eq(venuePromotions.venueId, venues.id))
      .innerJoin(venueAreas, eq(venuePromotions.areaId, venueAreas.id));
  }

  async createPromotion(input: {
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
  }) {
    try {
      const [created] = await this.db.insert(venuePromotions).values({
        venueId: input.venueId,
        areaId: input.areaId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        originalPriceAfn: input.originalPriceAfn,
        discountedPriceAfn: input.discountedPriceAfn,
        title: input.title,
        note: input.note,
        notifyFollowers: input.notifyFollowers,
        createdByUserId: input.createdByUserId,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      }).returning({ id: venuePromotions.id });
      if (!created) throw new Error("Promotion could not be created.");
      const promotion = await this.getPromotion(created.id);
      if (!promotion) throw new Error("Promotion could not be loaded.");
      return promotion;
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        throw errors.conflict("PROMOTION_EXISTS", "A promotion already exists for this exact slot.");
      }
      throw error;
    }
  }

  async listOwnerPromotions(ownerUserId: string) {
    const rows = await this.promotionProjection()
      .where(eq(venues.ownerUserId, ownerUserId))
      .orderBy(desc(venuePromotions.createdAt));
    return rows.map(promotionDto);
  }

  async listActivePromotions(venueIds?: string[]) {
    if (venueIds && venueIds.length === 0) return [];
    const condition = venueIds
      ? and(eq(venuePromotions.status, "ACTIVE"), inArray(venuePromotions.venueId, venueIds))
      : eq(venuePromotions.status, "ACTIVE");
    const rows = await this.promotionProjection().where(condition).orderBy(desc(venuePromotions.createdAt));
    return rows.map(promotionDto);
  }

  async getPromotion(promotionId: string) {
    const [row] = await this.promotionProjection().where(eq(venuePromotions.id, promotionId)).limit(1);
    return row ? promotionDto(row) : null;
  }

  async closePromotion(ownerUserId: string, promotionId: string, reason: string, closedAt: Date) {
    const [owned] = await this.db.select({ id: venuePromotions.id }).from(venuePromotions)
      .innerJoin(venues, eq(venuePromotions.venueId, venues.id))
      .where(and(eq(venuePromotions.id, promotionId), eq(venues.ownerUserId, ownerUserId)))
      .limit(1);
    if (!owned) return null;

    await this.db.update(venuePromotions).set({
      status: "CLOSED",
      closedAt,
      closeReason: reason,
      updatedAt: closedAt,
    }).where(eq(venuePromotions.id, promotionId));
    return this.getPromotion(promotionId);
  }

  async refreshPromotionStates(now: Date) {
    const activeRows = await this.db.select({
      id: venuePromotions.id,
      areaId: venuePromotions.areaId,
      startsAt: venuePromotions.startsAt,
      endsAt: venuePromotions.endsAt,
      venueStatus: venues.status,
      subscriptionStatus: venueSubscriptions.status,
      trialEndsAt: venueSubscriptions.trialEndsAt,
      activeUntil: venueSubscriptions.activeUntil,
    }).from(venuePromotions)
      .innerJoin(venues, eq(venuePromotions.venueId, venues.id))
      .leftJoin(venueSubscriptions, eq(venuePromotions.venueId, venueSubscriptions.venueId))
      .where(eq(venuePromotions.status, "ACTIVE"));

    for (const row of activeRows) {
      let nextStatus: "CLOSED" | "EXPIRED" | null = null;
      let reason: string | null = null;

      if (row.endsAt.getTime() <= now.getTime()) {
        nextStatus = "EXPIRED";
        reason = "EXPIRED";
      } else if (row.venueStatus !== "ACTIVE") {
        nextStatus = "CLOSED";
        reason = "VENUE_UNAVAILABLE";
      } else {
        const entitled =
          (row.subscriptionStatus === "TRIAL" && Boolean(row.trialEndsAt && row.trialEndsAt.getTime() > now.getTime())) ||
          (row.subscriptionStatus === "ACTIVE" && (!row.activeUntil || row.activeUntil.getTime() > now.getTime()));
        if (!entitled) {
          nextStatus = "CLOSED";
          reason = "ENTITLEMENT_ENDED";
        }
      }

      if (!nextStatus) {
        const [[booking], [block]] = await Promise.all([
          this.db.select({ id: bookings.id }).from(bookings).where(and(
            eq(bookings.areaId, row.areaId),
            inArray(bookings.status, ["PENDING", "CONFIRMED"]),
            lt(bookings.startsAt, row.endsAt),
            gt(bookings.endsAt, row.startsAt),
          )).limit(1),
          this.db.select({ id: venueBlocks.id }).from(venueBlocks).where(and(
            eq(venueBlocks.areaId, row.areaId),
            lt(venueBlocks.startsAt, row.endsAt),
            gt(venueBlocks.endsAt, row.startsAt),
          )).limit(1),
        ]);
        if (booking || block) {
          nextStatus = "CLOSED";
          reason = booking ? "BOOKED" : "BLOCKED";
        }
      }

      if (nextStatus) {
        await this.db.update(venuePromotions).set({
          status: nextStatus,
          closedAt: now,
          closeReason: reason,
          updatedAt: now,
        }).where(and(eq(venuePromotions.id, row.id), eq(venuePromotions.status, "ACTIVE")));
      }
    }
  }

  private postProjection() {
    return this.db.select({
      id: venuePosts.id,
      venueId: venuePosts.venueId,
      venueName: venues.name,
      body: venuePosts.body,
      imageUrl: venuePosts.imageUrl,
      ctaType: venuePosts.ctaType,
      ctaTargetId: venuePosts.ctaTargetId,
      status: venuePosts.status,
      publishedAt: venuePosts.publishedAt,
      unpublishedAt: venuePosts.unpublishedAt,
    }).from(venuePosts).innerJoin(venues, eq(venuePosts.venueId, venues.id));
  }

  async createPost(input: {
    venueId: string;
    createdByUserId: string;
    body: string;
    imageUrl: string | null;
    ctaType: "NONE" | "VENUE" | "PROMOTION" | "COMPETITION";
    ctaTargetId: string | null;
    publishedAt: Date;
  }) {
    const [created] = await this.db.insert(venuePosts).values({
      venueId: input.venueId,
      createdByUserId: input.createdByUserId,
      body: input.body,
      imageUrl: input.imageUrl,
      ctaType: input.ctaType,
      ctaTargetId: input.ctaTargetId,
      status: "PUBLISHED",
      publishedAt: input.publishedAt,
      createdAt: input.publishedAt,
      updatedAt: input.publishedAt,
    }).returning({ id: venuePosts.id });
    if (!created) throw new Error("Post could not be created.");
    const post = await this.getPost(created.id);
    if (!post) throw new Error("Post could not be loaded.");
    return post;
  }

  async listOwnerPosts(ownerUserId: string) {
    const rows = await this.postProjection()
      .where(eq(venues.ownerUserId, ownerUserId))
      .orderBy(desc(venuePosts.publishedAt));
    return rows.map(postDto);
  }

  async listPublishedPosts(venueIds?: string[]) {
    if (venueIds && venueIds.length === 0) return [];
    const condition = venueIds
      ? and(eq(venuePosts.status, "PUBLISHED"), eq(venues.status, "ACTIVE"), inArray(venuePosts.venueId, venueIds))
      : and(eq(venuePosts.status, "PUBLISHED"), eq(venues.status, "ACTIVE"));
    const rows = await this.postProjection().where(condition).orderBy(desc(venuePosts.publishedAt));
    return rows.map(postDto);
  }

  async getPost(postId: string) {
    const [row] = await this.postProjection().where(eq(venuePosts.id, postId)).limit(1);
    return row ? postDto(row) : null;
  }

  async setPostStatus(ownerUserId: string, postId: string, status: "PUBLISHED" | "UNPUBLISHED", changedAt: Date) {
    const [owned] = await this.db.select({ id: venuePosts.id }).from(venuePosts)
      .innerJoin(venues, eq(venuePosts.venueId, venues.id))
      .where(and(eq(venuePosts.id, postId), eq(venues.ownerUserId, ownerUserId)))
      .limit(1);
    if (!owned) return null;
    if (status === "PUBLISHED") {
      await this.db.update(venuePosts).set({
        status,
        unpublishedAt: null,
        publishedAt: changedAt,
        updatedAt: changedAt,
      }).where(eq(venuePosts.id, postId));
    } else {
      await this.db.update(venuePosts).set({
        status,
        unpublishedAt: changedAt,
        updatedAt: changedAt,
      }).where(eq(venuePosts.id, postId));
    }
    return this.getPost(postId);
  }

  async followVenue(userId: string, venueId: string) {
    await this.db.insert(venueFollows).values({ userId, venueId }).onConflictDoNothing();
  }

  async unfollowVenue(userId: string, venueId: string) {
    await this.db.delete(venueFollows).where(and(eq(venueFollows.userId, userId), eq(venueFollows.venueId, venueId)));
  }

  async isFollowing(userId: string, venueId: string) {
    const [row] = await this.db.select({ userId: venueFollows.userId }).from(venueFollows)
      .where(and(eq(venueFollows.userId, userId), eq(venueFollows.venueId, venueId)))
      .limit(1);
    return Boolean(row);
  }

  async followerCount(venueId: string) {
    const [row] = await this.db.select({ value: count() }).from(venueFollows).where(eq(venueFollows.venueId, venueId));
    return Number(row?.value ?? 0);
  }

  async listFollowedVenueIds(userId: string) {
    const rows = await this.db.select({ venueId: venueFollows.venueId }).from(venueFollows).where(eq(venueFollows.userId, userId));
    return rows.map((row) => row.venueId);
  }

  async listFollowerUserIds(venueId: string) {
    const rows = await this.db.select({ userId: venueFollows.userId }).from(venueFollows).where(eq(venueFollows.venueId, venueId));
    return rows.map((row) => row.userId);
  }
}
