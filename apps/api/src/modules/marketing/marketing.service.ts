import { randomBytes } from "node:crypto";
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
  VenuePostScheduleRequest,
  VenuePostUpdateRequest,
  VenuePostVisibility,
  VenueMediaAssetPurpose,
  VenueMediaPageDto,
  VenueMediaPageUpdateRequest,
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

  private async notifyVenuePost(post:VenuePostDto){
    if(!post.notifyFollowers||post.visibility==="PRIVATE")return;
    const venue=await this.repository.getVenue(post.venueId);
    if(!venue)return;
    try{
      await this.notifications?.venuePostPublished({
        venueId:venue.id,
        postId:post.id,
        venueName:venue.name,
        followerUserIds:await this.repository.listFollowerUserIds(venue.id),
      });
    }catch{
      // Post state remains authoritative even if notification fan-out fails.
    }
  }

  private async refreshMedia(){
    const now=this.now();
    await this.repository.refreshPromotionStates(now);
    const newlyPublished=await this.repository.refreshPostStates(now);
    await Promise.all(newlyPublished.map((post)=>this.notifyVenuePost(post)));
  }

  async refreshScheduledMedia(){
    await this.refreshMedia();
  }

  private async normalizePostCta(
    venueId:string,
    ctaType:"NONE"|"VENUE"|"PROMOTION"|"COMPETITION",
    requestedTargetId:string|null|undefined,
  ){
    if(ctaType==="VENUE")return venueId;
    if(ctaType==="NONE")return null;
    const targetId=requestedTargetId??null;
    if(!targetId)throw errors.badRequest("INVALID_POST_CTA","Choose a valid target for this post.");
    if(ctaType==="PROMOTION"){
      const promotion=await this.repository.getPromotion(targetId);
      if(!promotion||promotion.venueId!==venueId||promotion.status!=="ACTIVE"){
        throw errors.badRequest("INVALID_POST_CTA","Choose an active promotion from this venue.");
      }
      return targetId;
    }
    if(!(await this.repository.competitionBelongsToVenue(targetId,venueId))){
      throw errors.badRequest("INVALID_POST_CTA","Choose a competition managed by this venue.");
    }
    return targetId;
  }

  private assertFutureSchedule(input:VenuePostScheduleRequest,now:Date){
    if(new Date(input.executeAt).getTime()<=now.getTime()){
      throw errors.badRequest("MEDIA_SCHEDULE_IN_PAST","Scheduled media actions must be in the future.");
    }
  }

  private mediaAssetRef(value:string){
    const match=/^\/api\/v1\/media-assets\/([0-9a-f-]{36})\/([A-Za-z0-9_-]{32,64})$/.exec(value);
    return match?{assetId:match[1]!,publicToken:match[2]!}:null;
  }

  private async assertOwnedMediaReference(ownerUserId:string,value:string|null|undefined){
    if(!value||value.startsWith("https://"))return;
    const ref=this.mediaAssetRef(value);
    if(!ref)throw errors.badRequest("INVALID_MEDIA_ASSET","Choose an uploaded image from this venue.");
    const asset=await this.repository.getMediaAsset(ref.assetId,ref.publicToken);
    if(!asset||asset.ownerUserId!==ownerUserId){
      throw errors.forbidden("MEDIA_ASSET_ACCESS_DENIED","You cannot use this media asset.");
    }
  }

  private async mediaPageDto(venue:Awaited<ReturnType<MarketingRepository["getVenue"]>>):Promise<VenueMediaPageDto>{
    if(!venue)throw errors.badRequest("VENUE_REQUIRED","Complete venue setup first.");
    const [followerCount,posts]=await Promise.all([
      this.repository.followerCount(venue.id),
      this.repository.listOwnerPosts(venue.ownerUserId),
    ]);
    return {
      venueId:venue.id,
      name:venue.name,
      city:venue.city,
      province:venue.province,
      pageProfileImageUrl:venue.pageProfileImageUrl,
      pageCoverImageUrl:venue.pageCoverImageUrl,
      pageBio:venue.pageBio,
      followerCount,
      postCount:posts.length,
    };
  }

  async ownerMediaPage(ownerUserId:string){
    const venue=await this.ownerVenue(ownerUserId,false);
    return {page:await this.mediaPageDto(venue)};
  }

  async updateOwnerMediaPage(ownerUserId:string,input:VenueMediaPageUpdateRequest){
    await this.ownerVenue(ownerUserId,true);
    await Promise.all([
      this.assertOwnedMediaReference(ownerUserId,input.pageProfileImageUrl),
      this.assertOwnedMediaReference(ownerUserId,input.pageCoverImageUrl),
    ]);
    const venue=await this.repository.updateVenueMediaPage(ownerUserId,input,this.now());
    if(!venue)throw errors.badRequest("VENUE_REQUIRED","Complete venue setup first.");
    return {page:await this.mediaPageDto(venue)};
  }

  async createMediaAsset(
    ownerUserId:string,
    purpose:VenueMediaAssetPurpose,
    mimeType:string,
    bytes:Buffer,
  ){
    const venue=await this.ownerVenue(ownerUserId,true);
    const allowed=new Set(["image/jpeg","image/png","image/webp","image/heic","image/heif"]);
    if(!allowed.has(mimeType.toLowerCase())){
      throw errors.badRequest("MEDIA_TYPE_NOT_ALLOWED","Use a JPG, PNG, WEBP, HEIC, or HEIF image.");
    }
    if(bytes.length===0)throw errors.badRequest("MEDIA_EMPTY","Choose a non-empty image.");
    if(bytes.length>6*1024*1024)throw errors.badRequest("MEDIA_TOO_LARGE","Images must be 6 MB or smaller.");
    const publicToken=randomBytes(24).toString("base64url");
    const createdAt=this.now();
    const asset=await this.repository.createMediaAsset({
      venueId:venue.id,
      ownerUserId,
      purpose,
      publicToken,
      mimeType:mimeType.toLowerCase(),
      byteSize:bytes.length,
      dataBase64:bytes.toString("base64"),
      createdAt,
    });
    return {
      asset:{
        id:asset.id,
        purpose,
        imageUrl:`/api/v1/media-assets/${asset.id}/${publicToken}`,
        mimeType:asset.mimeType,
        byteSize:asset.byteSize,
        createdAt:asset.createdAt.toISOString(),
      },
    };
  }

  async publicMediaAsset(assetId:string,publicToken:string){
    const asset=await this.repository.getMediaAsset(assetId,publicToken);
    if(!asset)throw errors.badRequest("MEDIA_ASSET_NOT_FOUND","This image is no longer available.");
    return asset;
  }

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
    await this.refreshMedia();
    const venue=await this.ownerVenue(ownerUserId,true);
    const now=this.now();
    const targetId=await this.normalizePostCta(venue.id,input.ctaType,input.ctaTargetId);

    if(input.publishMode==="SCHEDULED"){
      if(!input.publishAt||new Date(input.publishAt).getTime()<=now.getTime()){
        throw errors.badRequest("MEDIA_SCHEDULE_IN_PAST","Scheduled publication must be in the future.");
      }
    }
    input.schedules.forEach((schedule)=>this.assertFutureSchedule(schedule,now));

    await this.assertOwnedMediaReference(ownerUserId,input.imageUrl);
    const request:VenuePostCreateRequest={...input,ctaTargetId:targetId};
    const post=await this.repository.createPost({
      venueId:venue.id,
      createdByUserId:ownerUserId,
      request,
      publishedAt:now,
      initialStatus:input.publishMode==="NOW"?"PUBLISHED":"UNPUBLISHED",
    });

    if(input.publishMode==="NOW")await this.notifyVenuePost(post);
    return post;
  }

  async listOwnerPosts(ownerUserId:string){
    await this.ownerVenue(ownerUserId,false);
    await this.refreshMedia();
    return {posts:await this.repository.listOwnerPosts(ownerUserId),generatedAt:this.now().toISOString()};
  }

  async updatePost(ownerUserId:string,postId:string,input:VenuePostUpdateRequest){
    const venue=await this.ownerVenue(ownerUserId,true);
    await this.refreshMedia();
    const current=await this.repository.getPost(postId);
    if(!current||current.venueId!==venue.id)throw errors.forbidden("POST_ACCESS_DENIED","You cannot manage this post.");
    const ctaType=input.ctaType??current.ctaType;
    const targetId=await this.normalizePostCta(
      venue.id,
      ctaType,
      input.ctaTargetId!==undefined?input.ctaTargetId:current.ctaTargetId,
    );
    await this.assertOwnedMediaReference(ownerUserId,input.imageUrl);
    const updated=await this.repository.updatePost(ownerUserId,postId,{...input,ctaType,ctaTargetId:targetId},this.now());
    if(!updated)throw errors.forbidden("POST_ACCESS_DENIED","You cannot manage this post.");
    return updated;
  }

  async deletePost(ownerUserId:string,postId:string){
    await this.ownerVenue(ownerUserId,false);
    if(!(await this.repository.deletePost(ownerUserId,postId))){
      throw errors.forbidden("POST_ACCESS_DENIED","You cannot manage this post.");
    }
    return {deleted:true};
  }

  async setPostPublished(ownerUserId: string, postId: string, published: boolean) {
    const venue=await this.ownerVenue(ownerUserId,published);
    await this.refreshMedia();
    if(published){
      const current=await this.repository.getPost(postId);
      if(!current||current.venueId!==venue.id)throw errors.forbidden("POST_ACCESS_DENIED","You cannot manage this post.");
      await this.normalizePostCta(venue.id,current.ctaType,current.ctaTargetId);
    }
    const post=await this.repository.setPostStatus(ownerUserId,postId,published?"PUBLISHED":"UNPUBLISHED",this.now());
    if(!post)throw errors.forbidden("POST_ACCESS_DENIED","You cannot manage this post.");
    if(published)await this.notifyVenuePost(post);
    return post;
  }

  async setPostVisibility(ownerUserId:string,postId:string,visibility:VenuePostVisibility){
    await this.ownerVenue(ownerUserId,true);
    const post=await this.repository.setPostVisibility(ownerUserId,postId,visibility,this.now());
    if(!post)throw errors.forbidden("POST_ACCESS_DENIED","You cannot manage this post.");
    return post;
  }

  async addPostSchedule(ownerUserId:string,postId:string,input:VenuePostScheduleRequest){
    await this.ownerVenue(ownerUserId,true);
    this.assertFutureSchedule(input,this.now());
    const schedule=await this.repository.addPostSchedule(ownerUserId,postId,input,this.now());
    if(!schedule)throw errors.forbidden("POST_ACCESS_DENIED","You cannot manage this post.");
    return schedule;
  }

  async cancelPostSchedule(ownerUserId:string,postId:string,scheduleId:string){
    await this.ownerVenue(ownerUserId,false);
    const schedule=await this.repository.cancelPostSchedule(ownerUserId,postId,scheduleId,this.now());
    if(!schedule)throw errors.badRequest("MEDIA_SCHEDULE_NOT_FOUND","This pending media action is no longer available.");
    return schedule;
  }

  async getPublicPost(postId:string){
    await this.refreshMedia();
    const post=await this.repository.getPost(postId);
    if(!post||post.status!=="PUBLISHED"||post.visibility!=="PUBLIC"){
      throw errors.badRequest("POST_NOT_FOUND","This post is not public.");
    }
    const venue=await this.repository.getVenue(post.venueId);
    if(!venue||venue.status!=="ACTIVE")throw errors.badRequest("POST_NOT_FOUND","This post is not public.");
    return post;
  }

  async getVenuePostForUser(userId:string,postId:string){
    await this.refreshMedia();
    const post=await this.repository.getPost(postId);
    if(!post||post.status!=="PUBLISHED"||post.visibility==="PRIVATE"){
      throw errors.badRequest("POST_NOT_FOUND","This post is not available.");
    }
    if(post.visibility==="FOLLOWERS"&&!(await this.repository.isFollowing(userId,post.venueId))){
      throw errors.forbidden("POST_FOLLOWERS_ONLY","Follow this venue to view this post.");
    }
    return post;
  }

  async venuePosts(venueId:string,userId?:string){
    await this.refreshMedia();
    const venue=await this.repository.getVenue(venueId);
    if(!venue||venue.status!=="ACTIVE")throw errors.badRequest("VENUE_NOT_FOUND","Venue not found.");
    const following=userId?await this.repository.isFollowing(userId,venueId):false;
    return {
      posts:await this.repository.listVenuePosts(venueId,following?"PUBLIC_OR_FOLLOWERS":"PUBLIC"),
      generatedAt:this.now().toISOString(),
    };
  }

  async feed(userId?: string, followingOnly = false): Promise<FeedResponse> {
    await this.refreshMedia();
    const venueIds=followingOnly
      ?userId?await this.repository.listFollowedVenueIds(userId):[]
      :undefined;
    const [promotions,posts]=await Promise.all([
      this.repository.listActivePromotions(venueIds),
      this.repository.listPublishedPosts(venueIds,followingOnly?"PUBLIC_OR_FOLLOWERS":"PUBLIC"),
    ]);
    return {generatedAt:this.now().toISOString(),items:mergeFeed(promotions,posts).slice(0,100)};
  }

  async socialFeed(userId:string):Promise<SocialFeedResponse>{
    await this.refreshMedia();
    return {generatedAt:this.now().toISOString(),items:await this.repository.listSocialFeed(userId)};
  }

  private async requireSocialEntity(entityType: SocialEntityType, entityId: string) {
    const entity = await this.repository.getSocialEntity(entityType, entityId);
    if (!entity) throw errors.badRequest("SOCIAL_ENTITY_NOT_FOUND", "This page is not available.");
    return entity;
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
