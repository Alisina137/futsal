import type { PromotionDto, SocialEntityType, SocialFeedPostDto, SocialPostCommentDto, VenuePostDto } from "@leaguekick/contracts";
import type { Database } from "@leaguekick/database";
import {
  bookings,
  competitions,
  socialFollows,
  socialPostCommentLikes,
  socialPostComments,
  socialPostLikes,
  socialPosts,
  teams,
  users,
  venueAreas,
  venueBlocks,
  venueFollows,
  venuePosts,
  venuePromotions,
  venueSubscriptions,
  venues,
} from "@leaguekick/database";
import { and, asc, count, desc, eq, gt, inArray, lt } from "drizzle-orm";
import { errors } from "../../lib/errors.js";
import type { MarketingRepository, MarketingSocialEntityRecord, MarketingVenueRecord } from "./marketing.types.js";

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

function socialDeepLink(entityType: SocialEntityType, entityId: string) {
  if (entityType === "VENUE") return `/venues/${entityId}`;
  if (entityType === "TEAM") return `/teams/${entityId}`;
  return `/competitions/${entityId}`;
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
    await this.db.insert(socialPosts).values({
      entityType: "VENUE",
      entityId: input.venueId,
      createdByUserId: input.createdByUserId,
      legacyVenuePostId: created.id,
      body: input.body,
      imageUrl: input.imageUrl,
      status: "PUBLISHED",
      publishedAt: input.publishedAt,
      createdAt: input.publishedAt,
      updatedAt: input.publishedAt,
    }).onConflictDoNothing();
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

    await this.db.update(socialPosts).set({
      status,
      unpublishedAt: status === "PUBLISHED" ? null : changedAt,
      ...(status === "PUBLISHED" ? { publishedAt: changedAt } : {}),
      updatedAt: changedAt,
    }).where(eq(socialPosts.legacyVenuePostId, postId));

    return this.getPost(postId);
  }

  async getSocialEntity(entityType: SocialEntityType, entityId: string): Promise<MarketingSocialEntityRecord | null> {
    if (entityType === "VENUE") {
      const [row] = await this.db.select({ id: venues.id, name: venues.name }).from(venues)
        .where(and(eq(venues.id, entityId), eq(venues.status, "ACTIVE")))
        .limit(1);
      return row ? { id: row.id, type: entityType, name: row.name, imageUrl: null } : null;
    }
    if (entityType === "TEAM") {
      const [row] = await this.db.select({ id: teams.id, name: teams.name, imageUrl: teams.logoUrl }).from(teams)
        .where(and(eq(teams.id, entityId), eq(teams.status, "ACTIVE")))
        .limit(1);
      return row ? { id: row.id, type: entityType, name: row.name, imageUrl: row.imageUrl } : null;
    }
    const [row] = await this.db.select({ id: competitions.id, name: competitions.name }).from(competitions)
      .where(and(eq(competitions.id, entityId), eq(competitions.published, true)))
      .limit(1);
    return row ? { id: row.id, type: entityType, name: row.name, imageUrl: null } : null;
  }

  async followEntity(userId: string, entityType: SocialEntityType, entityId: string) {
    await this.db.insert(socialFollows).values({ userId, entityType, entityId }).onConflictDoNothing();
  }

  async unfollowEntity(userId: string, entityType: SocialEntityType, entityId: string) {
    await this.db.delete(socialFollows).where(and(
      eq(socialFollows.userId, userId),
      eq(socialFollows.entityType, entityType),
      eq(socialFollows.entityId, entityId),
    ));
  }

  async isFollowingEntity(userId: string, entityType: SocialEntityType, entityId: string) {
    const [row] = await this.db.select({ userId: socialFollows.userId }).from(socialFollows)
      .where(and(
        eq(socialFollows.userId, userId),
        eq(socialFollows.entityType, entityType),
        eq(socialFollows.entityId, entityId),
      ))
      .limit(1);
    return Boolean(row);
  }

  async socialFollowerCount(entityType: SocialEntityType, entityId: string) {
    const [row] = await this.db.select({ value: count() }).from(socialFollows)
      .where(and(eq(socialFollows.entityType, entityType), eq(socialFollows.entityId, entityId)));
    return Number(row?.value ?? 0);
  }

  private async hydrateSocialPost(
    userId: string,
    row: typeof socialPosts.$inferSelect,
    likes?: Array<{ postId: string; userId: string }>,
    comments?: Array<{ postId: string }>,
  ): Promise<SocialFeedPostDto | null> {
    if (row.status !== "PUBLISHED") return null;
    const author = await this.getSocialEntity(row.entityType as SocialEntityType, row.entityId);
    if (!author) return null;

    const likeRows = likes ?? await this.db.select({
      postId: socialPostLikes.postId,
      userId: socialPostLikes.userId,
    }).from(socialPostLikes).where(eq(socialPostLikes.postId, row.id));
    const commentRows = comments ?? await this.db.select({
      postId: socialPostComments.postId,
    }).from(socialPostComments).where(eq(socialPostComments.postId, row.id));

    return {
      id: row.id,
      authorType: author.type,
      authorId: author.id,
      authorName: author.name,
      authorImageUrl: author.imageUrl,
      body: row.body,
      imageUrl: row.imageUrl,
      publishedAt: row.publishedAt.toISOString(),
      deepLink: socialDeepLink(author.type, author.id),
      likedByMe: likeRows.some((item) => item.postId === row.id && item.userId === userId),
      likeCount: likeRows.filter((item) => item.postId === row.id).length,
      commentCount: commentRows.filter((item) => item.postId === row.id).length,
    };
  }

  async listSocialFeed(userId: string): Promise<SocialFeedPostDto[]> {
    const follows = await this.db.select({
      entityType: socialFollows.entityType,
      entityId: socialFollows.entityId,
    }).from(socialFollows).where(eq(socialFollows.userId, userId));
    if (follows.length === 0) return [];

    const followed = new Set(follows.map((item) => `${item.entityType}:${item.entityId}`));
    const candidates = await this.db.select().from(socialPosts)
      .where(eq(socialPosts.status, "PUBLISHED"))
      .orderBy(desc(socialPosts.publishedAt))
      .limit(250);
    const rows = candidates
      .filter((row) => followed.has(`${row.entityType}:${row.entityId}`))
      .slice(0, 100);
    if (rows.length === 0) return [];

    const ids = rows.map((row) => row.id);
    const [likes, comments] = await Promise.all([
      this.db.select({ postId: socialPostLikes.postId, userId: socialPostLikes.userId })
        .from(socialPostLikes)
        .where(inArray(socialPostLikes.postId, ids)),
      this.db.select({ postId: socialPostComments.postId })
        .from(socialPostComments)
        .where(inArray(socialPostComments.postId, ids)),
    ]);

    const result: SocialFeedPostDto[] = [];
    for (const row of rows) {
      const post = await this.hydrateSocialPost(userId, row, likes, comments);
      if (post) result.push(post);
    }
    return result;
  }

  async getSocialPost(userId: string, postId: string) {
    const [row] = await this.db.select().from(socialPosts).where(eq(socialPosts.id, postId)).limit(1);
    return row ? this.hydrateSocialPost(userId, row) : null;
  }

  async likeSocialPost(userId: string, postId: string) {
    const current = await this.getSocialPost(userId, postId);
    if (!current) return null;
    await this.db.insert(socialPostLikes).values({ postId, userId }).onConflictDoNothing();
    return this.getSocialPost(userId, postId);
  }

  async unlikeSocialPost(userId: string, postId: string) {
    const current = await this.getSocialPost(userId, postId);
    if (!current) return null;
    await this.db.delete(socialPostLikes).where(and(
      eq(socialPostLikes.postId, postId),
      eq(socialPostLikes.userId, userId),
    ));
    return this.getSocialPost(userId, postId);
  }

  private async hydrateSocialComment(viewerUserId: string, commentId: string): Promise<SocialPostCommentDto | null> {
    const [row] = await this.db.select({
      id: socialPostComments.id,
      postId: socialPostComments.postId,
      userId: socialPostComments.userId,
      displayName: users.displayName,
      profileImageUrl: users.profileImageUrl,
      body: socialPostComments.body,
      createdAt: socialPostComments.createdAt,
      editedAt: socialPostComments.editedAt,
    }).from(socialPostComments)
      .innerJoin(users, eq(socialPostComments.userId, users.id))
      .innerJoin(socialPosts, eq(socialPostComments.postId, socialPosts.id))
      .where(and(
        eq(socialPostComments.id, commentId),
        eq(users.status, "ACTIVE"),
        eq(socialPosts.status, "PUBLISHED"),
      ))
      .limit(1);
    if (!row) return null;

    const likes = await this.db.select({
      userId: socialPostCommentLikes.userId,
    }).from(socialPostCommentLikes)
      .where(eq(socialPostCommentLikes.commentId, commentId));

    return {
      ...row,
      createdAt: row.createdAt.toISOString(),
      editedAt: row.editedAt?.toISOString() ?? null,
      likedByMe: likes.some((item) => item.userId === viewerUserId),
      likeCount: likes.length,
      canManage: row.userId === viewerUserId,
    };
  }

  async listSocialComments(userId: string, postId: string): Promise<SocialPostCommentDto[]> {
    const [post] = await this.db.select({ id: socialPosts.id }).from(socialPosts)
      .where(and(eq(socialPosts.id, postId), eq(socialPosts.status, "PUBLISHED")))
      .limit(1);
    if (!post) return [];

    const rows = await this.db.select({ id: socialPostComments.id }).from(socialPostComments)
      .where(eq(socialPostComments.postId, postId))
      .orderBy(asc(socialPostComments.createdAt));

    const result: SocialPostCommentDto[] = [];
    for (const row of rows) {
      const comment = await this.hydrateSocialComment(userId, row.id);
      if (comment) result.push(comment);
    }
    return result;
  }

  async addSocialComment(userId: string, postId: string, body: string, createdAt: Date) {
    const [post] = await this.db.select({ id: socialPosts.id }).from(socialPosts)
      .where(and(eq(socialPosts.id, postId), eq(socialPosts.status, "PUBLISHED")))
      .limit(1);
    if (!post) return null;

    const [created] = await this.db.insert(socialPostComments).values({
      postId,
      userId,
      body,
      createdAt,
    }).returning({ id: socialPostComments.id });
    if (!created) return null;
    return this.hydrateSocialComment(userId, created.id);
  }

  async updateSocialComment(
    userId: string,
    postId: string,
    commentId: string,
    body: string,
    editedAt: Date,
  ) {
    const [updated] = await this.db.update(socialPostComments).set({
      body,
      editedAt,
    }).where(and(
      eq(socialPostComments.id, commentId),
      eq(socialPostComments.postId, postId),
      eq(socialPostComments.userId, userId),
    )).returning({ id: socialPostComments.id });
    if (!updated) return null;
    return this.hydrateSocialComment(userId, updated.id);
  }

  async deleteSocialComment(userId: string, postId: string, commentId: string) {
    const rows = await this.db.delete(socialPostComments).where(and(
      eq(socialPostComments.id, commentId),
      eq(socialPostComments.postId, postId),
      eq(socialPostComments.userId, userId),
    )).returning({ id: socialPostComments.id });
    return rows.length > 0;
  }

  async likeSocialComment(userId: string, postId: string, commentId: string) {
    const current = await this.hydrateSocialComment(userId, commentId);
    if (!current || current.postId !== postId) return null;
    await this.db.insert(socialPostCommentLikes).values({ commentId, userId }).onConflictDoNothing();
    return this.hydrateSocialComment(userId, commentId);
  }

  async unlikeSocialComment(userId: string, postId: string, commentId: string) {
    const current = await this.hydrateSocialComment(userId, commentId);
    if (!current || current.postId !== postId) return null;
    await this.db.delete(socialPostCommentLikes).where(and(
      eq(socialPostCommentLikes.commentId, commentId),
      eq(socialPostCommentLikes.userId, userId),
    ));
    return this.hydrateSocialComment(userId, commentId);
  }

  async followVenue(userId: string, venueId: string) {
    await Promise.all([
      this.db.insert(venueFollows).values({ userId, venueId }).onConflictDoNothing(),
      this.followEntity(userId, "VENUE", venueId),
    ]);
  }

  async unfollowVenue(userId: string, venueId: string) {
    await Promise.all([
      this.db.delete(venueFollows).where(and(eq(venueFollows.userId, userId), eq(venueFollows.venueId, venueId))),
      this.unfollowEntity(userId, "VENUE", venueId),
    ]);
  }

  isFollowing(userId: string, venueId: string) {
    return this.isFollowingEntity(userId, "VENUE", venueId);
  }

  followerCount(venueId: string) {
    return this.socialFollowerCount("VENUE", venueId);
  }

  async listFollowedVenueIds(userId: string) {
    const rows = await this.db.select({ entityId: socialFollows.entityId }).from(socialFollows)
      .where(and(eq(socialFollows.userId, userId), eq(socialFollows.entityType, "VENUE")));
    return rows.map((row) => row.entityId);
  }

  async listFollowerUserIds(venueId: string) {
    const rows = await this.db.select({ userId: socialFollows.userId }).from(socialFollows)
      .where(and(eq(socialFollows.entityType, "VENUE"), eq(socialFollows.entityId, venueId)));
    return rows.map((row) => row.userId);
  }
}
