import type {
  NotificationDto,
  NotificationPreferences,
  NotificationPreferencesUpdate,
  PushDeviceRegisterRequest,
} from "@leaguekick/contracts";
import type {
  NotificationCreateInput,
  NotificationRepository,
} from "../src/modules/notifications/notification.types.js";

export class FakeNotificationRepository implements NotificationRepository {
  preferences = new Map<string, NotificationPreferences>();
  notifications: NotificationDto[] = [];
  devices = new Set<string>();
  deliveries: Array<{notificationId:string;channel:"IN_APP"|"PUSH"}> = [];

  async getPreferences(userId:string){
    return this.preferences.get(userId)??{inAppEnabled:true,pushEnabled:true,promotionsEnabled:true,venuePostsEnabled:true};
  }

  async updatePreferences(userId:string,input:NotificationPreferencesUpdate,_updatedAt:Date){
    const next={...(await this.getPreferences(userId)),...input};
    this.preferences.set(userId,next);
    return next;
  }

  async listNotifications(userId:string,limit:number){
    return this.notifications.filter((item)=>(item.data.userId as string|undefined)===userId).slice(-limit).reverse();
  }

  async getNotification(userId:string,notificationId:string){
    return this.notifications.find((item)=>item.id===notificationId&&(item.data.userId as string|undefined)===userId)??null;
  }

  async markRead(userId:string,notificationId:string,readAt:Date){
    const index=this.notifications.findIndex((item)=>item.id===notificationId&&(item.data.userId as string|undefined)===userId);
    if(index<0)return null;
    const next={...this.notifications[index]!,readAt:readAt.toISOString()};
    this.notifications[index]=next;
    return next;
  }

  async countRecentMarketingNotifications(userId:string,since:Date){
    return this.notifications.filter((item)=>
      (item.data.userId as string|undefined)===userId &&
      ["SLOT_PROMOTION","VENUE_POST"].includes(item.type) &&
      Date.parse(item.createdAt)>since.getTime()
    ).length;
  }

  async createNotification(input:NotificationCreateInput,createdAt:Date){
    const existing=this.notifications.find((item)=>
      (item.data.userId as string|undefined)===input.userId &&
      (item.data.dedupeKey as string|undefined)===input.dedupeKey
    );
    if(existing)return{notification:existing,created:false};

    const notification:NotificationDto={
      id:crypto.randomUUID(),
      type:input.type,
      title:input.title,
      body:input.body,
      deepLink:input.deepLink,
      data:{...(input.data??{}),userId:input.userId,dedupeKey:input.dedupeKey},
      readAt:null,
      createdAt:createdAt.toISOString(),
    };
    this.notifications.push(notification);
    return{notification,created:true};
  }

  async registerDevice(userId:string,input:PushDeviceRegisterRequest,_seenAt:Date){
    this.devices.add(`${userId}:${input.expoPushToken}`);
  }

  async unregisterDevice(userId:string,expoPushToken:string){
    this.devices.delete(`${userId}:${expoPushToken}`);
  }

  async hasActivePushDevice(userId:string){
    return [...this.devices].some((value)=>value.startsWith(`${userId}:`));
  }

  async ensureDeliveries(notificationId:string,channels:Array<"IN_APP"|"PUSH">){
    for(const channel of channels){
      if(!this.deliveries.some((item)=>item.notificationId===notificationId&&item.channel===channel)){
        this.deliveries.push({notificationId,channel});
      }
    }
  }
}
