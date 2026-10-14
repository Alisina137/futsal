import { randomUUID } from "node:crypto";
import type {
  NotificationDto,
  NotificationListFilter,
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
    return this.preferences.get(userId)??{inAppEnabled:true,pushEnabled:true,promotionsEnabled:true,venuePostsEnabled:true,teamInvitesEnabled:true};
  }

  async updatePreferences(
    userId:string,
    input:NotificationPreferencesUpdate,
    _updatedAt:Date,
  ):Promise<NotificationPreferences>{
    const current=await this.getPreferences(userId);
    const next:NotificationPreferences={
      inAppEnabled:input.inAppEnabled??current.inAppEnabled,
      pushEnabled:input.pushEnabled??current.pushEnabled,
      promotionsEnabled:input.promotionsEnabled??current.promotionsEnabled,
      venuePostsEnabled:input.venuePostsEnabled??current.venuePostsEnabled,
      teamInvitesEnabled:input.teamInvitesEnabled??current.teamInvitesEnabled,
    };
    this.preferences.set(userId,next);
    return next;
  }

  private filtered(userId:string,filter:NotificationListFilter="ALL"){
    return this.notifications.filter(item=>{
      if(item.data.userId!==userId)return false;
      if(!this.deliveries.some(d=>d.notificationId===item.id&&d.channel==="IN_APP"))return false;
      if(filter==="UNREAD")return !item.readAt;
      if(filter==="BOOKINGS")return ["BOOKING_CONFIRMED","BOOKING_CANCELLED","BOOKING_REQUEST"].includes(item.type);
      if(filter==="VENUES")return ["SLOT_PROMOTION","SLOT_AVAILABLE","VENUE_POST"].includes(item.type);
      if(filter==="TEAMS")return ["TEAM_INVITATION","TEAM_JOIN_REQUEST","TEAM_JOIN_DECISION","TEAM_ACTIVITY","TEAM_CHALLENGE","TEAM_ANNOUNCEMENT"].includes(item.type);
      if(filter==="COMPETITIONS")return item.type==="COMPETITION_UPDATE";
      return true;
    }).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
  }
  async listNotifications(userId:string,limit:number,offset=0,filter:NotificationListFilter="ALL",cursor?:{createdAt:string;id:string}){
    const items=this.filtered(userId,filter).filter(item=>!cursor||item.createdAt<cursor.createdAt||(item.createdAt===cursor.createdAt&&item.id<cursor.id));
    return items.slice(cursor?0:offset,(cursor?0:offset)+limit);
  }
  async countNotifications(userId:string,filter:NotificationListFilter="ALL"){
    return this.filtered(userId,filter).length;
  }
  async countUnreadNotifications(userId:string){
    return this.filtered(userId,"UNREAD").length;
  }
  async markAllRead(userId:string,readAt:Date){
    let updated=0;
    this.notifications=this.notifications.map(item=>{
      if(item.data.userId!==userId||item.readAt||
        !this.deliveries.some(delivery=>delivery.notificationId===item.id&&delivery.channel==="IN_APP"))return item;
      updated++;return {...item,readAt:readAt.toISOString()};
    });
    return updated;
  }
  async deleteNotification(userId:string,notificationId:string){
    const previous=this.notifications.length;
    this.notifications=this.notifications.filter(item=>item.id!==notificationId||item.data.userId!==userId||
      !this.deliveries.some(delivery=>delivery.notificationId===item.id&&delivery.channel==="IN_APP"));
    return this.notifications.length<previous;
  }
  async clearRead(userId:string){
    const previous=this.notifications.length;
    this.notifications=this.notifications.filter(item=>item.data.userId!==userId||!item.readAt||
      !this.deliveries.some(delivery=>delivery.notificationId===item.id&&delivery.channel==="IN_APP"));
    return previous-this.notifications.length;
  }

  async getNotification(userId:string,notificationId:string){
    return this.notifications.find((item)=>item.id===notificationId&&(item.data.userId as string|undefined)===userId
      &&this.deliveries.some(delivery=>delivery.notificationId===item.id&&delivery.channel==="IN_APP"))??null;
  }

  async markRead(userId:string,notificationId:string,readAt:Date){
    const index=this.notifications.findIndex((item)=>item.id===notificationId&&(item.data.userId as string|undefined)===userId
      &&this.deliveries.some(delivery=>delivery.notificationId===item.id&&delivery.channel==="IN_APP"));
    if(index<0)return null;
    if(this.notifications[index]!.readAt)return this.notifications[index]!;
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
      id:randomUUID(),
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
