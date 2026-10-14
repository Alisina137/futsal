import {randomUUID} from "node:crypto";
import {describe,expect,it} from "vitest";
import type {TimetableRecord,TimetableRepository} from "../src/modules/timetable/timetable.types.js";
import {TimetableService} from "../src/modules/timetable/timetable.service.js";
import {NotificationService} from "../src/modules/notifications/notification.service.js";
import {FakeNotificationRepository} from "./fake-notification-repository.js";

describe("Venue Detail Phase 6 published schedule changes",()=>{
  it("shows only effective published schedule exceptions, without owner-only notes",async()=>{
    const venueId=randomUUID(),areaId=randomUUID(),otherArea=randomUUID();
    const published:TimetableRecord={
      id:randomUUID(),venueId,name:"Public weekly",status:"PUBLISHED",
      effectiveFrom:"2026-10-14",effectiveUntil:"2026-10-17",
      defaultSlotDurationMinutes:60,bufferMinutes:0,
      createdByUserId:randomUUID(),publishedAt:new Date("2026-10-13T07:00:00Z"),
      archivedAt:null,createdAt:new Date(),updatedAt:new Date(),periods:[],
    };
    const notes="Owner-only note: contact private employee";
    const repo={
      getVenue:async()=>({id:venueId,ownerUserId:randomUUID(),timezone:"Asia/Kabul",
        areas:[{id:areaId,name:"Main",active:true,defaultSessionDurationMinutes:60,basePriceAfn:1200}]}),
      listTimetables:async()=>[published,{...published,id:randomUUID(),status:"DRAFT"}],
      listExceptions:async()=>[
        {id:randomUUID(),venueId,areaId:null,date:"2026-10-14",isClosed:true,
          periods:[],note:notes,createdByUserId:randomUUID(),createdAt:new Date(),updatedAt:new Date()},
        {id:randomUUID(),venueId,areaId,date:"2026-10-16",isClosed:false,
          periods:[{startsAt:"10:00",endsAt:"14:00",priceAfn:500}],note:notes,
          createdByUserId:randomUUID(),createdAt:new Date(),updatedAt:new Date()},
        {id:randomUUID(),venueId,areaId:otherArea,date:"2026-10-20",isClosed:true,
          periods:[],note:notes,createdByUserId:randomUUID(),createdAt:new Date(),updatedAt:new Date()},
      ],
    } as unknown as TimetableRepository;
    const service=new TimetableService(repo);
    const result=await service.publicScheduleChanges(venueId,"2026-10-14","2026-10-20");
    expect(result.changes).toHaveLength(2);
    expect(result.changes).toEqual([
      {date:"2026-10-14",isClosed:true,areaName:null,periods:[]},
      {date:"2026-10-16",isClosed:false,areaName:"Main",
        periods:[{startsAt:"10:00",endsAt:"14:00"}]},
    ]);
    expect(JSON.stringify(result)).not.toContain(notes);
    expect(JSON.stringify(result)).not.toContain(published.createdByUserId);
    expect(JSON.stringify(result)).not.toContain("500");
    await expect(service.publicScheduleChanges(venueId,"2026-10-15","2026-10-14"))
      .rejects.toMatchObject({code:"SCHEDULE_RANGE_INVALID"});
    await expect(service.publicScheduleChanges(venueId,"2026-10-14","2026-12-01"))
      .rejects.toMatchObject({code:"SCHEDULE_RANGE_INVALID"});
    await expect(service.publicScheduleChanges(venueId,"2026-02-30","2026-03-01"))
      .rejects.toMatchObject({code:"INVALID_DATE"});
  });
});

describe("Venue Detail Phase 6 account-only venue alerts",()=>{
  it("isolates venues and accounts, pages notifications and updates read counts",async()=>{
    const store=new FakeNotificationRepository();
    const service=new NotificationService(store,()=>new Date("2026-10-14T12:00:00Z"));
    const alice=randomUUID(),bob=randomUUID(),venueA=randomUUID(),venueB=randomUUID();
    await service.venuePostPublished({venueId:venueA,postId:randomUUID(),
      venueName:"Court A",followerUserIds:[alice,bob]});
    await service.promotionPublished({venueId:venueA,promotionId:randomUUID(),
      venueName:"Court A",title:"Offer",followerUserIds:[alice]});
    await service.slotAvailable({userId:alice,watchId:randomUUID(),venueId:venueB,
      areaId:randomUUID(),venueName:"Court B",startsAt:"2026-10-20T09:00:00Z"});
    const a=await service.venueNotifications(alice,venueA,1,1);
    expect(a.total).toBe(2);
    expect(a.unreadCount).toBe(2);
    expect(a.notifications).toHaveLength(1);
    expect(a.hasMore).toBe(true);
    const next=await service.venueNotifications(alice,venueA,2,1);
    expect(next.notifications).toHaveLength(1);
    expect(next.hasMore).toBe(false);
    expect((await service.venueNotifications(alice,venueB)).total).toBe(1);
    expect((await service.venueNotifications(bob,venueA)).total).toBe(1);
    expect((await service.venueNotifications(bob,venueB)).total).toBe(0);
    await expect(service.markRead(bob,next.notifications[0]!.id)).rejects
      .toMatchObject({code:"NOTIFICATION_NOT_FOUND"});
    await service.markRead(alice,next.notifications[0]!.id);
    expect((await service.venueNotifications(alice,venueA)).unreadCount).toBe(1);
  });

  it("never shows push-only notifications or events from another account",async()=>{
    const store=new FakeNotificationRepository();
    const service=new NotificationService(store,()=>new Date("2026-10-14T12:00:00Z"));
    const userId=randomUUID(),venueId=randomUUID(),outsider=randomUUID();
    await service.updatePreferences(userId,{inAppEnabled:false,pushEnabled:true});
    await store.registerDevice(userId,{expoPushToken:"ExponentPushToken[venue-test-0123456789]",
      platform:"ANDROID"},new Date());
    await service.slotAvailable({userId,watchId:randomUUID(),venueId,
      areaId:randomUUID(),venueName:"Private",startsAt:"2026-10-20T09:00:00Z"});
    expect((await service.venueNotifications(userId,venueId)).total).toBe(0);
    expect((await service.venueNotifications(outsider,venueId)).total).toBe(0);
  });
});
