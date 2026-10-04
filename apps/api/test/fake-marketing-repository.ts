import { randomUUID } from "node:crypto";
import type { PromotionDto, VenuePostDto } from "@leaguekick/contracts";
import type { MarketingRepository, MarketingVenueRecord } from "../src/modules/marketing/marketing.types.js";

export class FakeMarketingRepository implements MarketingRepository {
  venues = new Map<string, MarketingVenueRecord>();
  promotions = new Map<string, PromotionDto>();
  posts = new Map<string, VenuePostDto>();
  follows = new Set<string>();

  seedVenue(venue: MarketingVenueRecord) {
    this.venues.set(venue.id, venue);
  }

  async getOwnerVenue(ownerUserId: string) {
    return [...this.venues.values()].find((venue) => venue.ownerUserId === ownerUserId) ?? null;
  }

  async getVenue(venueId: string) {
    return this.venues.get(venueId) ?? null;
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
    const venue = this.venues.get(input.venueId)!;
    const promotion: PromotionDto = {
      id: randomUUID(),
      venueId: input.venueId,
      venueName: venue.name,
      areaId: input.areaId,
      areaName: "Pitch 1",
      startsAt: input.startsAt.toISOString(),
      endsAt: input.endsAt.toISOString(),
      originalPriceAfn: input.originalPriceAfn,
      discountedPriceAfn: input.discountedPriceAfn,
      discountPercent: Math.round(((input.originalPriceAfn-input.discountedPriceAfn)/input.originalPriceAfn)*100),
      currency: "AFN",
      status: "ACTIVE",
      title: input.title,
      note: input.note,
      notifyFollowers: input.notifyFollowers,
      createdAt: input.createdAt.toISOString(),
      closedAt: null,
      closeReason: null,
    };
    this.promotions.set(promotion.id,promotion);
    return promotion;
  }

  async listOwnerPromotions(ownerUserId: string) {
    const venue = await this.getOwnerVenue(ownerUserId);
    return [...this.promotions.values()].filter((promotion)=>promotion.venueId===venue?.id);
  }

  async listActivePromotions(venueIds?: string[]) {
    return [...this.promotions.values()].filter((promotion)=>
      promotion.status==="ACTIVE" && (!venueIds || venueIds.includes(promotion.venueId)));
  }

  async getPromotion(promotionId: string) {
    return this.promotions.get(promotionId) ?? null;
  }

  async closePromotion(ownerUserId: string,promotionId: string,reason: string,closedAt: Date) {
    const promotion=this.promotions.get(promotionId);
    const venue=promotion?this.venues.get(promotion.venueId):null;
    if(!promotion||venue?.ownerUserId!==ownerUserId)return null;
    const next={...promotion,status:"CLOSED" as const,closedAt:closedAt.toISOString(),closeReason:reason};
    this.promotions.set(promotionId,next);
    return next;
  }

  async refreshPromotionStates(now: Date) {
    for(const promotion of this.promotions.values()){
      if(promotion.status==="ACTIVE" && Date.parse(promotion.endsAt)<=now.getTime()){
        this.promotions.set(promotion.id,{...promotion,status:"EXPIRED",closedAt:now.toISOString(),closeReason:"EXPIRED"});
      }
    }
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
    const venue=this.venues.get(input.venueId)!;
    const post:VenuePostDto={
      id:randomUUID(),
      venueId:input.venueId,
      venueName:venue.name,
      body:input.body,
      imageUrl:input.imageUrl,
      ctaType:input.ctaType,
      ctaTargetId:input.ctaTargetId,
      status:"PUBLISHED",
      publishedAt:input.publishedAt.toISOString(),
      unpublishedAt:null,
    };
    this.posts.set(post.id,post);
    return post;
  }

  async listOwnerPosts(ownerUserId: string) {
    const venue=await this.getOwnerVenue(ownerUserId);
    return [...this.posts.values()].filter((post)=>post.venueId===venue?.id);
  }

  async listPublishedPosts(venueIds?: string[]) {
    return [...this.posts.values()].filter((post)=>
      post.status==="PUBLISHED" && (!venueIds || venueIds.includes(post.venueId)));
  }

  async getPost(postId: string) { return this.posts.get(postId)??null; }

  async setPostStatus(ownerUserId:string,postId:string,status:"PUBLISHED"|"UNPUBLISHED",changedAt:Date){
    const post=this.posts.get(postId); const venue=post?this.venues.get(post.venueId):null;
    if(!post||venue?.ownerUserId!==ownerUserId)return null;
    const next={...post,status,publishedAt:status==="PUBLISHED"?changedAt.toISOString():post.publishedAt,unpublishedAt:status==="UNPUBLISHED"?changedAt.toISOString():null};
    this.posts.set(postId,next); return next;
  }

  async followVenue(userId:string,venueId:string){this.follows.add(`${userId}:${venueId}`);}
  async unfollowVenue(userId:string,venueId:string){this.follows.delete(`${userId}:${venueId}`);}
  async isFollowing(userId:string,venueId:string){return this.follows.has(`${userId}:${venueId}`);}
  async followerCount(venueId:string){return [...this.follows].filter((key)=>key.endsWith(`:${venueId}`)).length;}
  async listFollowedVenueIds(userId:string){return [...this.follows].filter((key)=>key.startsWith(`${userId}:`)).map((key)=>key.slice(userId.length+1));}
  async listFollowerUserIds(venueId:string){return [...this.follows].filter((key)=>key.endsWith(`:${venueId}`)).map((key)=>key.slice(0,key.length-venueId.length-1));}
}
