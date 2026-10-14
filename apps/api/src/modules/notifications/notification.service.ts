import type {
  NotificationPreferencesUpdate,
  NotificationListFilter,
  PushDeviceRegisterRequest,
} from "@leaguekick/contracts";
import { errors } from "../../lib/errors.js";
import type {
  NotificationCreateInput,
  NotificationPublisher,
  NotificationRepository,
} from "./notification.types.js";

const MARKETING_LIMIT_PER_24H = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export class NotificationService implements NotificationPublisher {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Opaque createdAt/id keyset cursor; stable when new rows arrive ahead of page 1. */
  async list(userId:string,filter:NotificationListFilter="ALL",limit=30,offset=0,cursor?:string){
    let before:{createdAt:Date;id:string}|undefined;
    if(cursor){
      try{
        const value=Buffer.from(cursor,"base64url").toString("utf8");
        const separator=value.indexOf("|");
        const rawDate=value.slice(0,separator),id=value.slice(separator+1);
        const date=new Date(rawDate);
        if(separator<=0||!/^\\d{4}-\\d{2}-\\d{2}T/.test(rawDate)||date.toISOString()!==rawDate||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
          throw new Error("Invalid cursor");
        before={createdAt:date,id};
      }catch{
        throw errors.badRequest("INVALID_NOTIFICATION_CURSOR","Invalid notification page cursor.");
      }
    }
    const [page,total,unreadCount]=await Promise.all([
      this.repository.listNotifications(userId,limit+1,cursor?0:offset,filter,before),
      this.repository.countNotifications(userId,filter),
      this.repository.countUnreadNotifications(userId),
    ]);
    const hasMore=page.length>limit,notifications=page.slice(0,limit);
    const last=notifications[notifications.length-1];
    const nextCursor=hasMore&&last?
      Buffer.from(last.createdAt+"|"+last.id).toString("base64url"):null;
    return {notifications,total,unreadCount,hasMore,nextCursor,
      generatedAt:this.now().toISOString()};
  }

  async unreadCount(userId:string){
    return {unreadCount:await this.repository.countUnreadNotifications(userId)};
  }

  async markAllRead(userId:string){
    const updated=await this.repository.markAllRead(userId,this.now());
    return {updated,unreadCount:await this.repository.countUnreadNotifications(userId)};
  }

  async deleteNotification(userId:string,notificationId:string){
    const deleted=await this.repository.deleteNotification(userId,notificationId);
    if(!deleted)throw errors.badRequest("NOTIFICATION_NOT_FOUND","Notification not found.");
    return {deleted:true,unreadCount:await this.repository.countUnreadNotifications(userId)};
  }

  async clearRead(userId:string){
    const deleted=await this.repository.clearRead(userId);
    return {deleted,unreadCount:await this.repository.countUnreadNotifications(userId)};
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.repository.markRead(userId, notificationId, this.now());
    if (!notification) throw errors.badRequest("NOTIFICATION_NOT_FOUND", "Notification not found.");
    return {notification,unreadCount:await this.repository.countUnreadNotifications(userId)};
  }

  getPreferences(userId: string) {
    return this.repository.getPreferences(userId);
  }

  updatePreferences(userId: string, input: NotificationPreferencesUpdate) {
    return this.repository.updatePreferences(userId, input, this.now());
  }

  async registerDevice(userId: string, input: PushDeviceRegisterRequest) {
    await this.repository.registerDevice(userId, input, this.now());
  }

  async unregisterDevice(userId: string, expoPushToken: string) {
    await this.repository.unregisterDevice(userId, expoPushToken);
  }

  private async publish(input: NotificationCreateInput) {
    const preferences = await this.repository.getPreferences(input.userId);

    if (input.type === "SLOT_PROMOTION" && !preferences.promotionsEnabled) return;
    if (input.type === "VENUE_POST" && !preferences.venuePostsEnabled) return;
    if (input.type === "TEAM_INVITATION" && !preferences.teamInvitesEnabled) return;

    if (input.marketing) {
      const since = new Date(this.now().getTime() - DAY_MS);
      const recent = await this.repository.countRecentMarketingNotifications(input.userId, since);
      if (recent >= MARKETING_LIMIT_PER_24H) return;
    }

    const channels: Array<"IN_APP" | "PUSH"> = [];
    if (preferences.inAppEnabled) channels.push("IN_APP");
    if (preferences.pushEnabled && await this.repository.hasActivePushDevice(input.userId)) channels.push("PUSH");
    if (channels.length === 0) return;

    const { notification, created } = await this.repository.createNotification(input, this.now());
    if (!created) return;
    await this.repository.ensureDeliveries(notification.id, channels);
  }

  async slotAvailable(input:{userId:string;watchId:string;venueId:string;areaId:string;
    venueName:string;startsAt:string}){
    await this.publish({
      userId:input.userId,type:"SLOT_AVAILABLE",title:"Your watched slot is available",
      body:input.venueName+" · "+input.startsAt,
      deepLink:"/venues/"+input.venueId+"?startsAt="+encodeURIComponent(input.startsAt),
      data:{venueId:input.venueId,startsAt:input.startsAt,areaId:input.areaId,
        venueName:input.venueName},dedupeKey:"slot-available:"+input.watchId,
      marketing:false,
    });
  }

  async bookingRequest(input:{ownerUserId:string;bookingId:string;venueId:string;venueName:string;startsAt:string}){
    await this.publish({
      userId:input.ownerUserId,type:"BOOKING_REQUEST",title:"New booking requires approval",
      body:`${input.venueName} · ${input.startsAt}`,
      deepLink:"/owner/schedule",
      data:{bookingId:input.bookingId,venueId:input.venueId,venueName:input.venueName,startsAt:input.startsAt},
      dedupeKey:`booking-request:${input.bookingId}`,marketing:false,
    });
  }

  async teamJoinRequest(input:{managerUserId:string;teamId:string;teamName:string;requestId:string;requesterDisplayName:string}){
    await this.publish({
      userId:input.managerUserId,type:"TEAM_JOIN_REQUEST",title:"New team join request",
      body:`${input.requesterDisplayName} wants to join ${input.teamName}.`,
      deepLink:`/teams/${input.teamId}/manage`,
      data:{teamId:input.teamId,requestId:input.requestId,teamName:input.teamName,requesterDisplayName:input.requesterDisplayName},
      dedupeKey:`team-join-request:${input.requestId}`,marketing:false,
    });
  }

  async teamJoinDecision(input:{requesterUserId:string;teamId:string;teamName:string;requestId:string;accepted:boolean}){
    await this.publish({
      userId:input.requesterUserId,type:"TEAM_JOIN_DECISION",
      title:input.accepted?"Team request approved":"Team request declined",
      body:`${input.teamName}: your request to join was ${input.accepted?"approved":"declined"}.`,
      deepLink:`/teams/${input.teamId}`,
      data:{teamId:input.teamId,requestId:input.requestId,teamName:input.teamName,accepted:input.accepted},
      dedupeKey:`team-join-decision:${input.requestId}`,marketing:false,
    });
  }

  async bookingConfirmed(input: {
    userId: string;
    bookingId: string;
    venueName: string;
    startsAt: string;
  }) {
    await this.publish({
      userId: input.userId,
      type: "BOOKING_CONFIRMED",
      title: "Booking confirmed",
      body: `${input.venueName} · ${input.startsAt}`,
      deepLink: "/bookings",
      data: { bookingId: input.bookingId, startsAt: input.startsAt, venueName: input.venueName },
      dedupeKey: `booking-confirmed:${input.bookingId}`,
      marketing: false,
    });
  }

  async bookingCancelled(input: {
    userId: string;
    bookingId: string;
    venueName: string;
  }) {
    await this.publish({
      userId: input.userId,
      type: "BOOKING_CANCELLED",
      title: "Booking cancelled",
      body: `Your booking at ${input.venueName} was cancelled.`,
      deepLink: "/bookings",
      data: { bookingId: input.bookingId, venueName: input.venueName },
      dedupeKey: `booking-cancelled:${input.bookingId}`,
      marketing: false,
    });
  }

  async promotionPublished(input: {
    venueId: string;
    promotionId: string;
    venueName: string;
    title: string;
    followerUserIds: string[];
  }) {
    await Promise.allSettled(input.followerUserIds.map((userId) => this.publish({
      userId,
      type: "SLOT_PROMOTION",
      title: input.title,
      body: `${input.venueName} published a discounted futsal slot.`,
      deepLink: `/venues/${input.venueId}?promotionId=${input.promotionId}`,
      data: { venueId: input.venueId, promotionId: input.promotionId },
      dedupeKey: `promotion:${input.promotionId}`,
      marketing: true,
    })));
  }

  async venuePostPublished(input: {
    venueId: string;
    postId: string;
    venueName: string;
    followerUserIds: string[];
  }) {
    await Promise.allSettled(input.followerUserIds.map((userId) => this.publish({
      userId,
      type: "VENUE_POST",
      title: input.venueName,
      body: "A venue you follow published a new update.",
      deepLink: `/posts/${input.postId}`,
      data: { venueId: input.venueId, postId: input.postId, venueName: input.venueName },
      dedupeKey: `venue-post:${input.postId}`,
      marketing: true,
    })));
  }

  async teamInvitation(input: {
    userId: string;
    invitationId: string;
    teamId: string;
    teamName: string;
  }) {
    await this.publish({
      userId: input.userId,
      type: "TEAM_INVITATION",
      title: "Team invitation",
      body: `You were invited to join ${input.teamName}.`,
      deepLink: "/teams/invitations",
      data: {
        invitationId: input.invitationId,
        teamId: input.teamId,
        teamName: input.teamName,
      },
      dedupeKey: `team-invitation:${input.invitationId}`,
      marketing: false,
    });
  }

  async teamActivity(input:{
    teamId:string;activityId:string;teamName:string;title:string;startsAt:string|null;
    userIds:string[];dedupeKey:string;
  }){
    await Promise.allSettled(input.userIds.map(userId=>this.publish({
      userId,type:"TEAM_ACTIVITY",
      title:input.teamName,
      body:input.title,
      deepLink:`/teams/${input.teamId}/activities`,
      data:{teamId:input.teamId,activityId:input.activityId,startsAt:input.startsAt},
      dedupeKey:`${input.dedupeKey}:${userId}`,
      marketing:false,
    })));
  }

  async teamChallenge(input:{teamId:string;challengeId:string;teamName:string;title:string;userIds:string[]}){
    await Promise.allSettled(input.userIds.map(userId=>this.publish({
      userId,type:"TEAM_CHALLENGE",title:input.teamName,body:input.title,
      deepLink:"/dashboard",data:{teamId:input.teamId,challengeId:input.challengeId},
      dedupeKey:`team-challenge:${input.challengeId}:${input.title}:${userId}`,marketing:false,
    })));
  }
  async teamAnnouncement(input:{teamId:string;announcementId:string;teamName:string;title:string;userIds:string[]}){
    await Promise.allSettled(input.userIds.map(userId=>this.publish({
      userId,type:"TEAM_ANNOUNCEMENT",title:input.teamName,body:input.title,
      deepLink:`/teams/${input.teamId}/announcements`,
      data:{teamId:input.teamId,announcementId:input.announcementId},
      dedupeKey:`team-announcement:${input.announcementId}:${userId}`,marketing:false,
    })));
  }

  async competitionUpdate(input: {
    competitionId: string;
    title: string;
    body: string;
    userIds: string[];
    dedupeKey: string;
  }) {
    await Promise.allSettled(input.userIds.map((userId) => this.publish({
      userId,
      type: "COMPETITION_UPDATE",
      title: input.title,
      body: input.body,
      deepLink: `/competitions/${input.competitionId}`,
      data: { competitionId: input.competitionId },
      dedupeKey: `${input.dedupeKey}:${userId}`,
      marketing: false,
    })));
  }
}

export { MARKETING_LIMIT_PER_24H };
