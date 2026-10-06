import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import {
  promotionCreateRequestSchema,
  socialEntityTypeSchema,
  socialPostCommentCreateRequestSchema,
  venuePostCreateRequestSchema,
} from "@leaguekick/contracts";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import type { TokenService } from "../auth/token.service.js";
import type { MarketingService } from "./marketing.service.js";

const routeIdSchema = z.string().uuid();

export function createPublicMarketingRouter(marketing: MarketingService, tokens: TokenService) {
  const router = Router();
  router.use(rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: "draft-8", legacyHeaders: false }));

  router.get("/feed", async (_request, response, next) => {
    try { response.json(await marketing.feed()); }
    catch (error) { next(error); }
  });

  router.get("/promotions/:promotionId", async (request, response, next) => {
    try {
      const promotionId = routeIdSchema.parse(request.params.promotionId);
      response.json({ promotion: await marketing.getPromotion(promotionId) });
    } catch (error) { next(error); }
  });

  router.get("/posts/:postId", async (request, response, next) => {
    try {
      const postId = routeIdSchema.parse(request.params.postId);
      response.json({ post: await marketing.getPublicPost(postId) });
    } catch (error) { next(error); }
  });

  router.get("/feed/following", requireAuth(tokens), async (request, response, next) => {
    try { response.json(await marketing.feed(request.auth!.userId, true)); }
    catch (error) { next(error); }
  });

  router.get("/social/feed", requireAuth(tokens), async (request, response, next) => {
    try { response.json(await marketing.socialFeed(request.auth!.userId)); }
    catch (error) { next(error); }
  });

  router.get("/social/follows/:entityType/:entityId", requireAuth(tokens), async (request, response, next) => {
    try {
      const entityType = socialEntityTypeSchema.parse(String(request.params.entityType).toUpperCase());
      const entityId = routeIdSchema.parse(request.params.entityId);
      response.json(await marketing.socialFollowState(request.auth!.userId, entityType, entityId));
    } catch (error) { next(error); }
  });

  router.post("/social/follows/:entityType/:entityId", requireAuth(tokens), async (request, response, next) => {
    try {
      const entityType = socialEntityTypeSchema.parse(String(request.params.entityType).toUpperCase());
      const entityId = routeIdSchema.parse(request.params.entityId);
      response.json(await marketing.socialFollow(request.auth!.userId, entityType, entityId));
    } catch (error) { next(error); }
  });

  router.delete("/social/follows/:entityType/:entityId", requireAuth(tokens), async (request, response, next) => {
    try {
      const entityType = socialEntityTypeSchema.parse(String(request.params.entityType).toUpperCase());
      const entityId = routeIdSchema.parse(request.params.entityId);
      response.json(await marketing.socialUnfollow(request.auth!.userId, entityType, entityId));
    } catch (error) { next(error); }
  });

  router.post("/social/posts/:postId/like", requireAuth(tokens), async (request, response, next) => {
    try {
      const postId = routeIdSchema.parse(request.params.postId);
      response.json({ post: await marketing.likeSocialPost(request.auth!.userId, postId) });
    } catch (error) { next(error); }
  });

  router.delete("/social/posts/:postId/like", requireAuth(tokens), async (request, response, next) => {
    try {
      const postId = routeIdSchema.parse(request.params.postId);
      response.json({ post: await marketing.unlikeSocialPost(request.auth!.userId, postId) });
    } catch (error) { next(error); }
  });

  router.get("/social/posts/:postId/comments", requireAuth(tokens), async (request, response, next) => {
    try {
      const postId = routeIdSchema.parse(request.params.postId);
      response.json(await marketing.socialComments(request.auth!.userId, postId));
    } catch (error) { next(error); }
  });

  router.post("/social/posts/:postId/comments", requireAuth(tokens), async (request, response, next) => {
    try {
      const postId = routeIdSchema.parse(request.params.postId);
      const input = socialPostCommentCreateRequestSchema.parse(request.body);
      response.status(201).json({ comment: await marketing.addSocialComment(request.auth!.userId, postId, input) });
    } catch (error) { next(error); }
  });

  router.get("/venues/:venueId/follow", requireAuth(tokens), async (request, response, next) => {
    try {
      const venueId = routeIdSchema.parse(request.params.venueId);
      response.json(await marketing.followState(request.auth!.userId, venueId));
    } catch (error) { next(error); }
  });

  router.post("/venues/:venueId/follow", requireAuth(tokens), async (request, response, next) => {
    try {
      const venueId = routeIdSchema.parse(request.params.venueId);
      response.json(await marketing.follow(request.auth!.userId, venueId));
    } catch (error) { next(error); }
  });

  router.delete("/venues/:venueId/follow", requireAuth(tokens), async (request, response, next) => {
    try {
      const venueId = routeIdSchema.parse(request.params.venueId);
      response.json(await marketing.unfollow(request.auth!.userId, venueId));
    } catch (error) { next(error); }
  });

  return router;
}

export function createOwnerMarketingRouter(marketing: MarketingService, tokens: TokenService) {
  const router = Router();
  router.use(requireAuth(tokens), requireRole("VENUE_OWNER"));
  const writeLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false });

  router.get("/promotions", async (request, response, next) => {
    try { response.json(await marketing.listOwnerPromotions(request.auth!.userId)); }
    catch (error) { next(error); }
  });

  router.post("/promotions", writeLimiter, async (request, response, next) => {
    try {
      const input = promotionCreateRequestSchema.parse(request.body);
      response.status(201).json({ promotion: await marketing.createPromotion(request.auth!.userId, input) });
    } catch (error) { next(error); }
  });

  router.post("/promotions/:promotionId/close", writeLimiter, async (request, response, next) => {
    try {
      const promotionId = routeIdSchema.parse(request.params.promotionId);
      response.json({ promotion: await marketing.closePromotion(request.auth!.userId, promotionId) });
    } catch (error) { next(error); }
  });

  router.get("/posts", async (request, response, next) => {
    try { response.json(await marketing.listOwnerPosts(request.auth!.userId)); }
    catch (error) { next(error); }
  });

  router.post("/posts", writeLimiter, async (request, response, next) => {
    try {
      const input = venuePostCreateRequestSchema.parse(request.body);
      response.status(201).json({ post: await marketing.createPost(request.auth!.userId, input) });
    } catch (error) { next(error); }
  });

  router.post("/posts/:postId/unpublish", writeLimiter, async (request, response, next) => {
    try {
      const postId = routeIdSchema.parse(request.params.postId);
      response.json({ post: await marketing.setPostPublished(request.auth!.userId, postId, false) });
    } catch (error) { next(error); }
  });

  router.post("/posts/:postId/publish", writeLimiter, async (request, response, next) => {
    try {
      const postId = routeIdSchema.parse(request.params.postId);
      response.json({ post: await marketing.setPostPublished(request.auth!.userId, postId, true) });
    } catch (error) { next(error); }
  });

  return router;
}
