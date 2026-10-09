import { randomUUID } from "node:crypto";
import type {
  PromotionDto,
  SocialEntityType,
  SocialFeedPostDto,
  SocialPostCommentDto,
  VenuePostDto,
} from "@leaguekick/contracts";
import type { MarketingRepository, MarketingVenueRecord } from "../src/modules/marketing/marketing.types.js";

export class FakeMarketingRepository implements MarketingRepository {
  venues = new Map<string, MarketingVenueRecord>();
  promotions = new Map<string, PromotionDto>();
  posts = new Map<string, VenuePostDto>();
  mediaAssets = new Map<string, Awaited<ReturnType<MarketingRepository["createMediaAsset"]>>>();
  follows = new Set<string>();
  directoryFollows = new Set<string>();
  userSocialPosts = new Map<string,SocialFeedPostDto>();
  userPostImages = new Map<string,{id:string;ownerUserId:string;publicToken:string;mimeType:string;byteSize:number;dataBase64:string}>();
  onPromotionCreated?: (promotion: PromotionDto) => void;

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
    this.onPromotionCreated?.(promotion);
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

  async createPost(input: Parameters<MarketingRepository["createPost"]>[0]) {
    const venue=this.venues.get(input.venueId)!;
    const now=input.publishedAt.toISOString();
    const schedules=[
      ...(input.request.publishMode==="SCHEDULED"&&input.request.publishAt
        ?[{
          id:randomUUID(),
          postId:"",
          action:"PUBLISH" as const,
          executeAt:input.request.publishAt,
          executedAt:null,
          cancelledAt:null,
          createdAt:now,
        }]
        :[]),
      ...input.request.schedules.map((item)=>({
        id:randomUUID(),
        postId:"",
        action:item.action,
        executeAt:item.executeAt,
        executedAt:null,
        cancelledAt:null,
        createdAt:now,
      })),
    ];
    const id=randomUUID();
    const post:VenuePostDto={
      id,
      venueId:input.venueId,
      venueName:venue.name,
      socialPostId:null,
      body:input.request.body,
      imageUrl:input.request.imageUrl?.trim()||null,
      ctaType:input.request.ctaType,
      ctaTargetId:input.request.ctaTargetId??null,
      postType:input.request.postType,
      visibility:input.request.visibility,
      notifyFollowers:input.request.notifyFollowers,
      status:input.initialStatus,
      publishedAt:now,
      unpublishedAt:input.initialStatus==="UNPUBLISHED"?now:null,
      createdAt:now,
      updatedAt:now,
      schedules:schedules.map((item)=>({...item,postId:id})),
    };
    this.posts.set(post.id,post);
    return post;
  }

  async updatePost(ownerUserId:string,postId:string,input:Parameters<MarketingRepository["updatePost"]>[2],changedAt:Date){
    const post=this.posts.get(postId);
    const venue=post?this.venues.get(post.venueId):null;
    if(!post||venue?.ownerUserId!==ownerUserId)return null;
    const next:VenuePostDto={
      ...post,
      ...(input.body!==undefined?{body:input.body}:{}),
      ...(input.imageUrl!==undefined?{imageUrl:input.imageUrl.trim()||null}:{}),
      ...(input.ctaType!==undefined?{ctaType:input.ctaType}:{}),
      ...(input.ctaTargetId!==undefined?{ctaTargetId:input.ctaTargetId}:{}),
      ...(input.postType!==undefined?{postType:input.postType}:{}),
      ...(input.visibility!==undefined?{visibility:input.visibility}:{}),
      ...(input.notifyFollowers!==undefined?{notifyFollowers:input.notifyFollowers}:{}),
      updatedAt:changedAt.toISOString(),
    };
    this.posts.set(postId,next);
    return next;
  }

  async deletePost(ownerUserId:string,postId:string){
    const post=this.posts.get(postId);
    const venue=post?this.venues.get(post.venueId):null;
    if(!post||venue?.ownerUserId!==ownerUserId)return false;
    this.posts.delete(postId);
    return true;
  }

  async listOwnerPosts(ownerUserId: string) {
    const venue=await this.getOwnerVenue(ownerUserId);
    return [...this.posts.values()].filter((post)=>post.venueId===venue?.id);
  }

  async listPublishedPosts(venueIds?: string[],visibility:"PUBLIC"|"PUBLIC_OR_FOLLOWERS"="PUBLIC") {
    return [...this.posts.values()].filter((post)=>
      post.status==="PUBLISHED"
      &&post.visibility!=="PRIVATE"
      &&(visibility==="PUBLIC_OR_FOLLOWERS"||post.visibility==="PUBLIC")
      &&(!venueIds||venueIds.includes(post.venueId)));
  }

  async listVenuePosts(venueId:string,visibility:"PUBLIC"|"PUBLIC_OR_FOLLOWERS"){
    return this.listPublishedPosts([venueId],visibility);
  }

  async getPost(postId: string) { return this.posts.get(postId)??null; }

  async setPostStatus(ownerUserId:string,postId:string,status:"PUBLISHED"|"UNPUBLISHED",changedAt:Date){
    const post=this.posts.get(postId); const venue=post?this.venues.get(post.venueId):null;
    if(!post||venue?.ownerUserId!==ownerUserId)return null;
    const next={
      ...post,
      status,
      publishedAt:status==="PUBLISHED"?changedAt.toISOString():post.publishedAt,
      unpublishedAt:status==="UNPUBLISHED"?changedAt.toISOString():null,
      updatedAt:changedAt.toISOString(),
    };
    this.posts.set(postId,next); return next;
  }

  async setPostVisibility(
    ownerUserId:string,
    postId:string,
    visibility:Parameters<MarketingRepository["setPostVisibility"]>[2],
    changedAt:Date,
  ){
    const post=this.posts.get(postId); const venue=post?this.venues.get(post.venueId):null;
    if(!post||venue?.ownerUserId!==ownerUserId)return null;
    const next={...post,visibility,updatedAt:changedAt.toISOString()};
    this.posts.set(postId,next);
    return next;
  }

  async addPostSchedule(
    ownerUserId:string,
    postId:string,
    input:Parameters<MarketingRepository["addPostSchedule"]>[2],
    createdAt:Date,
  ){
    const post=this.posts.get(postId); const venue=post?this.venues.get(post.venueId):null;
    if(!post||venue?.ownerUserId!==ownerUserId)return null;
    const schedule={
      id:randomUUID(),
      postId,
      action:input.action,
      executeAt:input.executeAt,
      executedAt:null,
      cancelledAt:null,
      createdAt:createdAt.toISOString(),
    };
    this.posts.set(postId,{...post,schedules:[...post.schedules,schedule]});
    return schedule;
  }

  async cancelPostSchedule(ownerUserId:string,postId:string,scheduleId:string,cancelledAt:Date){
    const post=this.posts.get(postId); const venue=post?this.venues.get(post.venueId):null;
    if(!post||venue?.ownerUserId!==ownerUserId)return null;
    const schedule=post.schedules.find((item)=>item.id===scheduleId&&item.executedAt===null&&item.cancelledAt===null);
    if(!schedule)return null;
    const next={...schedule,cancelledAt:cancelledAt.toISOString()};
    this.posts.set(postId,{
      ...post,
      schedules:post.schedules.map((item)=>item.id===scheduleId?next:item),
    });
    return next;
  }

  async refreshPostStates(now:Date){
    const published:VenuePostDto[]=[];
    for(const post of [...this.posts.values()]){
      let next=post;
      for(const schedule of post.schedules
        .filter((item)=>!item.executedAt&&!item.cancelledAt&&Date.parse(item.executeAt)<=now.getTime())
        .sort((a,b)=>a.executeAt.localeCompare(b.executeAt))){
        if(schedule.action==="DELETE"){
          this.posts.delete(post.id);
          break;
        }
        if(schedule.action==="PUBLISH"){
          next={...next,status:"PUBLISHED",publishedAt:now.toISOString(),unpublishedAt:null};
          published.push(next);
        }else if(schedule.action==="UNPUBLISH"){
          next={...next,status:"UNPUBLISHED",unpublishedAt:now.toISOString()};
        }else{
          next={...next,visibility:schedule.action==="MAKE_PUBLIC"?"PUBLIC":schedule.action==="MAKE_FOLLOWERS"?"FOLLOWERS":"PRIVATE"};
        }
        next={
          ...next,
          updatedAt:now.toISOString(),
          schedules:next.schedules.map((item)=>item.id===schedule.id?{...item,executedAt:now.toISOString()}:item),
        };
        this.posts.set(post.id,next);
      }
    }
    return published;
  }

  async competitionBelongsToVenue(_competitionId:string,_venueId:string){return true;}

  async createMediaAsset(input:Parameters<MarketingRepository["createMediaAsset"]>[0]){
    const asset={
      id:randomUUID(),
      venueId:input.venueId,
      ownerUserId:input.ownerUserId,
      purpose:input.purpose,
      publicToken:input.publicToken,
      mimeType:input.mimeType,
      byteSize:input.byteSize,
      dataBase64:input.dataBase64,
      createdAt:input.createdAt,
    };
    this.mediaAssets.set(asset.id,asset);
    return asset;
  }

  async getMediaAsset(assetId:string,publicToken:string){
    const asset=this.mediaAssets.get(assetId)??null;
    return asset?.publicToken===publicToken?asset:null;
  }

  async updateVenueMediaPage(
    ownerUserId:string,
    input:Parameters<MarketingRepository["updateVenueMediaPage"]>[1],
    _updatedAt:Date,
  ){
    const venue=await this.getOwnerVenue(ownerUserId);
    if(!venue)return null;
    const next={
      ...venue,
      ...(input.pageProfileImageUrl!==undefined?{pageProfileImageUrl:input.pageProfileImageUrl}:{}),
      ...(input.pageCoverImageUrl!==undefined?{pageCoverImageUrl:input.pageCoverImageUrl}:{}),
      ...(input.pageBio!==undefined?{pageBio:input.pageBio}:{}),
    };
    this.venues.set(venue.id,next);
    return next;
  }

  async followVenue(userId:string,venueId:string){this.follows.add(`${userId}:${venueId}`);}
  async unfollowVenue(userId:string,venueId:string){this.follows.delete(`${userId}:${venueId}`);}
  async isFollowing(userId:string,venueId:string){return this.follows.has(`${userId}:${venueId}`);}
  async followerCount(venueId:string){return [...this.follows].filter((key)=>key.endsWith(`:${venueId}`)).length;}
  async listSocialDirectoryCounts(entityType:"TEAM"|"COMPETITION"){
    const ids=[...this.directoryFollows].filter(row=>row.startsWith(`${entityType}:`));
    const totals=new Map<string,number>();
    for(const row of ids){
      const id=row.split(":")[2]!;
      totals.set(id,(totals.get(id)??0)+1);
    }
    return [...totals].map(([id,count])=>({id,count}));
  }
  async listFollowedEntityIds(userId:string,entityType:"TEAM"|"COMPETITION"){
    return [...this.directoryFollows].filter(row=>row.startsWith(`${entityType}:${userId}:`))
      .map(row=>row.slice(entityType.length+userId.length+2));
  }
  async listVenueFollowerCounts(ids:string[]):Promise<Record<string,number>>{
    const counts:Record<string,number>={};
    for(const id of ids)counts[id]=await this.followerCount(id);
    return counts;
  }

  async listFollowedVenues(userId:string){
    const ids=await this.listFollowedVenueIds(userId);
    return ids.map(id=>this.venues.get(id)).filter(
      (venue):venue is MarketingVenueRecord=>Boolean(venue&&venue.status==="ACTIVE")
    ).map(venue=>({
      id:venue.id,name:venue.name,imageUrl:venue.pageProfileImageUrl??null,
      city:venue.city??"",province:venue.province??"",
    })).reverse();
  }
  async listFollowedVenueIds(userId:string){return [...this.follows].filter((key)=>key.startsWith(`${userId}:`)).map((key)=>key.slice(userId.length+1));}
  async listFollowerUserIds(venueId:string){return [...this.follows].filter((key)=>key.endsWith(`:${venueId}`)).map((key)=>key.slice(0,key.length-venueId.length-1));}

  async getSocialEntity(entityType:SocialEntityType,entityId:string){
    if(entityType==="USER")return {id:entityId,type:"USER" as const,name:"Futsal Member",imageUrl:null};
    if(entityType!=="VENUE")return null;
    const venue=this.venues.get(entityId);
    return venue?{id:venue.id,type:"VENUE" as const,name:venue.name,imageUrl:venue.pageProfileImageUrl??null}:null;
  }
  async followEntity(userId:string,entityType:SocialEntityType,entityId:string){
    if(entityType==="VENUE")await this.followVenue(userId,entityId);
    else this.directoryFollows.add(`${entityType}:${userId}:${entityId}`);
  }
  async unfollowEntity(userId:string,entityType:SocialEntityType,entityId:string){
    if(entityType==="VENUE")await this.unfollowVenue(userId,entityId);
    else this.directoryFollows.delete(`${entityType}:${userId}:${entityId}`);
  }
  async isFollowingEntity(userId:string,entityType:SocialEntityType,entityId:string){
    return entityType==="VENUE"?this.isFollowing(userId,entityId):this.directoryFollows.has(`${entityType}:${userId}:${entityId}`);
  }
  async socialFollowerCount(entityType:SocialEntityType,entityId:string){
    if(entityType==="VENUE")return this.followerCount(entityId);
    if(entityType==="TEAM"||entityType==="COMPETITION")
      return (await this.listSocialDirectoryCounts(entityType)).find(x=>x.id===entityId)?.count??0;
    return 0;
  }
  async listUserPosts(_viewerId:string,userId:string):Promise<SocialFeedPostDto[]>{
    return [...this.userSocialPosts.values()].filter(post=>post.authorId===userId).reverse();
  }
  async createUserPost(userId:string,body:string,imageUrl:string|null,createdAt:Date):Promise<SocialFeedPostDto>{
    const id=randomUUID();
    const post:SocialFeedPostDto={
      id,authorId:userId,authorType:"USER",authorName:"Futsal Member",
      authorImageUrl:null,body,imageUrl,postType:"GENERAL",
      publishedAt:createdAt.toISOString(),deepLink:`/people/${userId}`,
      likedByMe:false,likeCount:0,commentCount:0,
    };
    this.userSocialPosts.set(id,post);
    return post;
  }
  async deleteUserPost(userId:string,postId:string){
    const post=this.userSocialPosts.get(postId);
    if(!post||post.authorId!==userId)return false;
    this.userSocialPosts.delete(postId);
    return true;
  }
  async createUserPostImage(input:{ownerUserId:string;publicToken:string;mimeType:string;byteSize:number;dataBase64:string}){
    const asset={id:randomUUID(),...input};
    this.userPostImages.set(asset.id,asset);
    return asset;
  }
  async getUserPostImage(assetId:string,publicToken:string){
    const asset=this.userPostImages.get(assetId);
    return asset?.publicToken===publicToken?asset:null;
  }
  async listSocialFeed(userId:string):Promise<SocialFeedPostDto[]>{
    return [...this.userSocialPosts.values()].filter(post=>post.authorId===userId).reverse();
  }
  async getSocialPost(_userId:string,postId:string):Promise<SocialFeedPostDto|null>{return this.userSocialPosts.get(postId)??null;}
  async likeSocialPost(_userId:string,_postId:string):Promise<SocialFeedPostDto|null>{return null;}
  async unlikeSocialPost(_userId:string,_postId:string):Promise<SocialFeedPostDto|null>{return null;}
  async listSocialComments(_userId:string,_postId:string):Promise<SocialPostCommentDto[]>{return [];}
  async addSocialComment(_userId:string,_postId:string,_body:string,_createdAt:Date):Promise<SocialPostCommentDto|null>{return null;}
  async updateSocialComment(_userId:string,_postId:string,_commentId:string,_body:string,_editedAt:Date):Promise<SocialPostCommentDto|null>{return null;}
  async deleteSocialComment(_userId:string,_postId:string,_commentId:string){return false;}
  async likeSocialComment(_userId:string,_postId:string,_commentId:string):Promise<SocialPostCommentDto|null>{return null;}
  async unlikeSocialComment(_userId:string,_postId:string,_commentId:string):Promise<SocialPostCommentDto|null>{return null;}
}
