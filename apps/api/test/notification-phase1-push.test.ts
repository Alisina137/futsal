import {randomUUID} from "node:crypto";
import {describe,expect,it} from "vitest";
import {NotificationService} from "../src/modules/notifications/notification.service.js";
import {BookingService} from "../src/modules/booking/booking.service.js";
import {FakeBookingRepository} from "./fake-booking-repository.js";
import {PushDispatcher,type PendingPush,type PushDeliveryStore} from "../src/modules/notifications/push-delivery.js";
import {FakeNotificationRepository} from "./fake-notification-repository.js";

const now=new Date("2026-10-14T08:00:00.000Z");

describe("Notifications Phase 1 — actionable events",()=>{
  it("sends pending booking alerts only to venue owner, deduplicated, grouped in BOOKINGS",async()=>{
    const repo=new FakeNotificationRepository(),service=new NotificationService(repo,()=>now);
    const owner=randomUUID(),player=randomUUID(),bookingId=randomUUID(),venueId=randomUUID();
    const input={ownerUserId:owner,bookingId,venueId,venueName:"Mina Arena",startsAt:now.toISOString()};
    await service.bookingRequest(input);
    await service.bookingRequest(input);
    const ownerFeed=await service.list(owner,"BOOKINGS");
    expect(ownerFeed.notifications).toHaveLength(1);
    expect(ownerFeed.notifications[0]).toMatchObject({
      type:"BOOKING_REQUEST",deepLink:`/owner/schedule?bookingId=${bookingId}`,
      data:{venueId,bookingId},
    });
    expect((await service.list(player)).notifications).toHaveLength(0);
  });
  it("delivers one team join request to manager and one acceptance/decline to requester",async()=>{
    const repo=new FakeNotificationRepository(),service=new NotificationService(repo,()=>now);
    const requester=randomUUID(),manager=randomUUID(),teamId=randomUUID(),requestId=randomUUID();
    await service.teamJoinRequest({managerUserId:manager,teamId,teamName:"Golden FC",requestId,requesterDisplayName:"Player"});
    await service.teamJoinRequest({managerUserId:manager,teamId,teamName:"Golden FC",requestId,requesterDisplayName:"Player"});
    const mine=(await service.list(manager,"TEAMS")).notifications;
    expect(mine).toHaveLength(1);
    expect(mine[0]?.data).toMatchObject({teamId,requestId});
    expect(mine[0]?.deepLink).toBe(`/teams/${teamId}/manage?requestId=${requestId}`);
    await service.teamJoinDecision({requesterUserId:requester,teamId,teamName:"Golden FC",requestId,accepted:false});
    await service.teamJoinDecision({requesterUserId:requester,teamId,teamName:"Golden FC",requestId,accepted:false});
    const result=(await service.list(requester,"TEAMS")).notifications;
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({type:"TEAM_JOIN_DECISION",data:{accepted:false}});
    expect(result[0]?.deepLink).toBe(`/teams/${teamId}`);
    expect((await service.list(manager)).notifications.some(x=>x.type==="TEAM_JOIN_DECISION")).toBe(false);
  });
  it("respects do-not-disturb content preferences and does not create undeliverable records",async()=>{
    const repo=new FakeNotificationRepository(),service=new NotificationService(repo,()=>now);
    const owner=randomUUID();
    await service.updatePreferences(owner,{inAppEnabled:false,pushEnabled:false});
    await service.bookingRequest({ownerUserId:owner,bookingId:randomUUID(),venueId:randomUUID(),
      venueName:"Closed arena",startsAt:now.toISOString()});
    expect((await service.list(owner)).notifications).toHaveLength(0);
    expect(repo.deliveries).toHaveLength(0);
  });
});

describe("Notifications Phase 1 — online approval booking integration",()=>{
  it("alerts the venue owner only after a PENDING booking is committed",async()=>{
    const repo=new FakeNotificationRepository(),notifications=new NotificationService(repo,
      ()=>new Date("2026-10-04T00:00:00.000Z"));
    const bookings=new FakeBookingRepository();
    const venueOwner=randomUUID(),player=randomUUID();
    const {venue,areaId}=bookings.seedVenue(venueOwner);
    venue.bookingMode="APPROVAL";
    const booking=new BookingService(bookings,()=>new Date("2026-10-04T00:00:00.000Z"),notifications);
    const availability=await booking.getAvailability(venue.id,"2026-10-05");
    const slot=availability.slots.find(x=>x.areaId===areaId)!;
    expect(slot).toBeDefined();
    const created=await booking.createOnlineBooking(player,{
      areaId,startsAt:slot.startsAt,idempotencyKey:"phase1-owner-alert",note:"",
    });
    expect(created.status).toBe("PENDING");
    const owner=await notifications.list(venueOwner,"BOOKINGS");
    expect(owner.notifications).toMatchObject([{type:"BOOKING_REQUEST",
      data:{bookingId:created.id,venueId:venue.id}}]);
    expect((await notifications.list(player)).notifications).toHaveLength(0);
    await booking.createOnlineBooking(player,{
      areaId,startsAt:slot.startsAt,idempotencyKey:"phase1-owner-alert",note:"",
    });
    expect((await notifications.list(venueOwner)).notifications).toHaveLength(1);
  });
});

class FakeStore implements PushDeliveryStore{
  jobs:PendingPush[]=[];
  tokens=new Map<string,string[]>();
  results:Array<{id:string;status:string;error:string|null}>=[];
  disabled:string[]=[];
  async claim(_at:Date,limit:number){return this.jobs.splice(0,limit);}
  async eligibleTokens(userId:string){return this.tokens.get(userId)??[];}
  async settle(id:string,status:"PENDING"|"SENT"|"FAILED"|"SKIPPED",error:string|null){
    this.results.push({id,status,error});
  }
  async disableToken(token:string){this.disabled.push(token);}
}
describe("Notifications Phase 1 — Expo push dispatcher",()=>{
  function job(attempts=1):PendingPush{
    return {notificationId:randomUUID(),userId:randomUUID(),
      title:"New request",body:"Review your booking",deepLink:"/dashboard",attempts};
  }
  it("sends a typed deep link, records accepted gateway tickets and handles missing devices",async()=>{
    const repo=new FakeStore(),event=job(),empty=job();
    repo.jobs.push(event,empty);
    repo.tokens.set(event.userId,["ExponentPushToken[DEMO]"]);
    const deliveries:unknown[]=[];
    const d=new PushDispatcher(repo,async payload=>{
      deliveries.push(payload[0]);
      return [{status:"ok",id:"ticket-1"}];
    },()=>now);
    expect(await d.run()).toBe(2);
    expect(deliveries[0]).toMatchObject({title:event.title,
      data:{url:"/dashboard",notificationId:event.notificationId}});
    expect(repo.results).toMatchObject([
      {id:event.notificationId,status:"SENT"},
      {id:empty.notificationId,status:"SKIPPED"},
    ]);
  });
  it("retries transient transport failures but caps errors after three attempts",async()=>{
    const repo=new FakeStore(),first=job(1),last=job(3);
    repo.jobs.push(first,last);
    repo.tokens.set(first.userId,["ExpoPushToken[OK]"]);
    repo.tokens.set(last.userId,["ExpoPushToken[OK]"]);
    const d=new PushDispatcher(repo,async()=>{throw Error("Expo timeout");});
    await d.run();
    expect(repo.results.map(r=>r.status)).toEqual(["PENDING","FAILED"]);
    expect(repo.results.every(r=>r.error?.includes("Expo timeout"))).toBe(true);
  });
  it("disables invalid device tokens while allowing other devices through",async()=>{
    const repo=new FakeStore(),event=job();
    repo.jobs.push(event);
    repo.tokens.set(event.userId,["ExpoPushToken[OLD]","ExpoPushToken[GOOD]"]);
    const d=new PushDispatcher(repo,async()=>[
      {status:"error",details:{error:"DeviceNotRegistered"}},
      {status:"ok",id:"ticket-2"},
    ]);
    await d.run();
    expect(repo.disabled).toEqual(["ExpoPushToken[OLD]"]);
    expect(repo.results).toMatchObject([{status:"SENT"}]);
  });
});
