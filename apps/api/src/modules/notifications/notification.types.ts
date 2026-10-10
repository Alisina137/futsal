import type {
  NotificationDto,
  NotificationListFilter,
  NotificationPreferences,
  NotificationPreferencesUpdate,
  NotificationType,
  PushDeviceRegisterRequest,
} from "@leaguekick/contracts";

export type NotificationCreateInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  deepLink: string;
  data?: Record<string, unknown>;
  dedupeKey: string;
  marketing: boolean;
};

export interface NotificationRepository {
  getPreferences(userId: string): Promise<NotificationPreferences>;
  updatePreferences(userId: string, input: NotificationPreferencesUpdate, updatedAt: Date): Promise<NotificationPreferences>;
  listNotifications(userId:string,limit:number,offset?:number,filter?:NotificationListFilter):Promise<NotificationDto[]>;
  countNotifications(userId:string,filter?:NotificationListFilter):Promise<number>;
  countUnreadNotifications(userId:string):Promise<number>;
  markAllRead(userId:string,readAt:Date):Promise<number>;
  deleteNotification(userId:string,notificationId:string):Promise<boolean>;
  clearRead(userId:string):Promise<number>;
  getNotification(userId: string, notificationId: string): Promise<NotificationDto | null>;
  markRead(userId: string, notificationId: string, readAt: Date): Promise<NotificationDto | null>;
  countRecentMarketingNotifications(userId: string, since: Date): Promise<number>;
  createNotification(input: NotificationCreateInput, createdAt: Date): Promise<{ notification: NotificationDto; created: boolean }>;
  registerDevice(userId: string, input: PushDeviceRegisterRequest, seenAt: Date): Promise<void>;
  unregisterDevice(userId: string, expoPushToken: string): Promise<void>;
  hasActivePushDevice(userId: string): Promise<boolean>;
  ensureDeliveries(notificationId: string, channels: Array<"IN_APP" | "PUSH">): Promise<void>;
}

export interface NotificationPublisher {
  bookingConfirmed(input: {
    userId: string;
    bookingId: string;
    venueName: string;
    startsAt: string;
  }): Promise<void>;
  bookingCancelled(input: {
    userId: string;
    bookingId: string;
    venueName: string;
  }): Promise<void>;
  promotionPublished(input: {
    venueId: string;
    promotionId: string;
    venueName: string;
    title: string;
    followerUserIds: string[];
  }): Promise<void>;
  venuePostPublished(input: {
    venueId: string;
    postId: string;
    venueName: string;
    followerUserIds: string[];
  }): Promise<void>;
  teamInvitation(input: {
    userId: string;
    invitationId: string;
    teamId: string;
    teamName: string;
  }): Promise<void>;
  teamActivity(input:{
    teamId:string;activityId:string;teamName:string;title:string;startsAt:string|null;
    userIds:string[];dedupeKey:string;
  }):Promise<void>;
  teamChallenge(input:{teamId:string;challengeId:string;teamName:string;title:string;userIds:string[]}):Promise<void>;
  teamAnnouncement(input:{teamId:string;announcementId:string;teamName:string;title:string;userIds:string[]}):Promise<void>;
  competitionUpdate(input: {
    competitionId: string;
    title: string;
    body: string;
    userIds: string[];
    dedupeKey: string;
  }): Promise<void>;
}
