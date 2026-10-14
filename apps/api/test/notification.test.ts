import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { BookingService } from "../src/modules/booking/booking.service.js";
import { NotificationService, MARKETING_LIMIT_PER_24H } from "../src/modules/notifications/notification.service.js";
import { FakeBookingRepository } from "./fake-booking-repository.js";
import { FakeNotificationRepository } from "./fake-notification-repository.js";

describe("Notification Phase 2 hotfix — scoped bulk operations",()=>{
  it("does not alter push-only rows through inbox bulk read/clear",async()=>{
    const repository=new FakeNotificationRepository();
    const now=new Date("2026-10-14T09:00:00.000Z");
    const service=new NotificationService(repository,()=>now);
    const userId=randomUUID(),otherId=randomUUID();
    await repository.registerDevice(userId,{expoPushToken:"ExponentPushToken[test-0123456789]",platform:"ANDROID"},now);
    await service.updatePreferences(userId,{inAppEnabled:false,pushEnabled:true});
    const pushBooking=randomUUID();
    await service.bookingCancelled({userId,bookingId:pushBooking,venueName:"Push only"});
    const [pushOnly]=repository.notifications;
    expect(pushOnly).toBeDefined();
    expect((await service.list(userId)).notifications).toHaveLength(0);
    await service.updatePreferences(userId,{inAppEnabled:true,pushEnabled:false});
    await service.bookingCancelled({userId,bookingId:randomUUID(),venueName:"In app"});
    await service.bookingCancelled({userId:otherId,bookingId:randomUUID(),venueName:"Other account"});
    expect(await service.unreadCount(userId)).toEqual({unreadCount:1});
    expect(await service.markAllRead(userId)).toEqual({updated:1,unreadCount:0});
    expect(repository.notifications.find(item=>item.id===pushOnly!.id)?.readAt).toBeNull();
    // Directly make the inaccessible PUSH-only record read to prove Clear read
    // only operates on records with an IN_APP delivery.
    const stored=repository.notifications.find(item=>item.id===pushOnly!.id)!;
    stored.readAt=now.toISOString();
    await expect(service.markRead(userId,pushOnly!.id)).rejects.toMatchObject({code:"NOTIFICATION_NOT_FOUND"});
    await expect(service.deleteNotification(userId,pushOnly!.id)).rejects.toMatchObject({code:"NOTIFICATION_NOT_FOUND"});
    expect(await service.clearRead(userId)).toEqual({deleted:1,unreadCount:0});
    expect(repository.notifications.some(item=>item.id===pushOnly!.id)).toBe(true);
    expect((await service.list(otherId)).notifications).toHaveLength(1);
  });
});

describe("Notifications Phase 3 — safe and idempotent access",()=>{
  it("preserves the first read timestamp and does not mutate another account",async()=>{
    const repository=new FakeNotificationRepository();
    const now=new Date("2026-10-14T12:00:00.000Z");
    const service=new NotificationService(repository,()=>now);
    const own=randomUUID(),other=randomUUID(),bookingId=randomUUID();
    await service.bookingCancelled({userId:own,bookingId,venueName:"Kabul"});
    const item=(await service.list(own)).notifications[0]!;
    await expect(service.markRead(other,item.id)).rejects.toMatchObject({code:"NOTIFICATION_NOT_FOUND"});
    const first=await service.markRead(own,item.id);
    expect(first.readAt).toBe(now.toISOString());
    now.setTime(now.getTime()+60000);
    const replay=await service.markRead(own,item.id);
    expect(replay.readAt).toBe(first.readAt);
    expect((await service.unreadCount(own)).unreadCount).toBe(0);
    expect((await service.list(other)).total).toBe(0);
  });
});

describe("Phase 4 notification policy", () => {
  it("paginates and category-filters account-specific notifications with an accurate global unread count",async()=>{
    const repo=new FakeNotificationRepository();
    const now=new Date("2026-10-04T11:00:00.000Z");
    const service=new NotificationService(repo,()=>now);
    const userId=randomUUID(),otherId=randomUUID();
    await service.bookingConfirmed({userId,bookingId:randomUUID(),venueName:"Kabul",startsAt:now.toISOString()});
    await service.bookingCancelled({userId,bookingId:randomUUID(),venueName:"Herat"});
    await service.teamInvitation({userId,invitationId:randomUUID(),teamId:randomUUID(),teamName:"City FC"});
    await service.competitionUpdate({competitionId:randomUUID(),title:"Final",body:"Fixture update",userIds:[userId],dedupeKey:"final"});
    await service.bookingConfirmed({userId:otherId,bookingId:randomUUID(),venueName:"Private",startsAt:now.toISOString()});
    const all=await service.list(userId,"ALL",2,0);
    expect(all.notifications).toHaveLength(2);
    expect(all.total).toBe(4);
    expect(all.unreadCount).toBe(4);
    expect(all.hasMore).toBe(true);
    const second=await service.list(userId,"ALL",2,2);
    expect(second.notifications).toHaveLength(2);
    expect(new Set([...all.notifications,...second.notifications].map(x=>x.id)).size).toBe(4);
    expect(second.hasMore).toBe(false);
    const bookings=await service.list(userId,"BOOKINGS",30);
    expect(bookings.total).toBe(2);
    expect(bookings.notifications.every(x=>x.type.startsWith("BOOKING_"))).toBe(true);
    const competitions=await service.list(userId,"COMPETITIONS",30);
    expect(competitions.notifications).toHaveLength(1);
    const other=await service.list(otherId);
    expect(other.total).toBe(1);
  });

  it("keeps bulk read, single deletion, and clearing read isolated and idempotent",async()=>{
    const repository=new FakeNotificationRepository();
    const now=new Date("2026-10-04T12:00:00.000Z");
    const service=new NotificationService(repository,()=>now);
    const first=randomUUID(),second=randomUUID();
    await service.teamInvitation({userId:first,invitationId:randomUUID(),teamId:randomUUID(),teamName:"Blue FC"});
    await service.bookingCancelled({userId:first,bookingId:randomUUID(),venueName:"Arena"});
    await service.bookingCancelled({userId:second,bookingId:randomUUID(),venueName:"Other"});
    const ids=(await service.list(first)).notifications.map(x=>x.id);
    expect(await service.markAllRead(first)).toEqual({updated:2,unreadCount:0});
    expect(await service.markAllRead(first)).toEqual({updated:0,unreadCount:0});
    expect((await service.list(first,"UNREAD")).notifications).toHaveLength(0);
    await expect(service.deleteNotification(second,ids[0]!)).rejects.toMatchObject({code:"NOTIFICATION_NOT_FOUND"});
    expect((await service.deleteNotification(first,ids[0]!)).deleted).toBe(true);
    await expect(service.deleteNotification(first,ids[0]!)).rejects.toMatchObject({code:"NOTIFICATION_NOT_FOUND"});
    expect(await service.clearRead(first)).toEqual({deleted:1,unreadCount:0});
    expect(await service.clearRead(first)).toEqual({deleted:0,unreadCount:0});
    expect((await service.list(second)).notifications).toHaveLength(1);
    expect((await service.list(second)).unreadCount).toBe(1);
  });

  it("supports stable cursors when new events arrive between pages",async()=>{
    const repo=new FakeNotificationRepository();
    let tick=0;
    const svc=new NotificationService(repo,()=>new Date(1791960000000+(tick++)*1000));
    const userId=randomUUID();
    for(let i=0;i<4;i++)await svc.bookingCancelled({userId,bookingId:randomUUID(),venueName:"Arena"});
    const first=await svc.list(userId,"ALL",2);
    expect(first.notifications).toHaveLength(2);
    expect(first.nextCursor).toBeTruthy();
    await svc.bookingCancelled({userId,bookingId:randomUUID(),venueName:"Newer"});
    const second=await svc.list(userId,"ALL",2,0,first.nextCursor!);
    expect(second.notifications).toHaveLength(2);
    expect(new Set([...first.notifications,...second.notifications].map(v=>v.id)).size).toBe(4);
    expect(second.notifications.find(v=>v.body.includes("Newer"))).toBeUndefined();
    await expect(svc.list(userId,"ALL",2,0,"garbage")).rejects.toMatchObject({code:"NOTIFICATION_CURSOR_INVALID"});
  });

  it("separates push-only alerts from the in-app feed and unread badge",async()=>{
    const repo=new FakeNotificationRepository();
    const svc=new NotificationService(repo,()=>new Date("2026-10-14T06:00:00.000Z"));
    const userId=randomUUID();
    await repo.registerDevice(userId,{expoPushToken:"ExponentPushToken[test-device-test]",platform:"ANDROID"},new Date());
    await svc.updatePreferences(userId,{inAppEnabled:false,pushEnabled:true});
    await svc.bookingCancelled({userId,bookingId:randomUUID(),venueName:"Venue"});
    expect(repo.deliveries.map(x=>x.channel)).toEqual(["PUSH"]);
    const list=await svc.list(userId);
    expect(list.notifications).toHaveLength(0);
    expect(list.unreadCount).toBe(0);
  });

  it("merges partial preference updates into a complete preference object", async () => {
    const repository = new FakeNotificationRepository();
    const service = new NotificationService(repository, () => new Date("2026-10-04T00:00:00.000Z"));
    const userId = randomUUID();

    const updated = await service.updatePreferences(userId, { promotionsEnabled: false });

    expect(updated).toEqual({
      inAppEnabled: true,
      pushEnabled: true,
      promotionsEnabled: false,
      venuePostsEnabled: true,
      teamInvitesEnabled: true,
    });
  });

  it("deduplicates the same event for the same user", async () => {
    const repository = new FakeNotificationRepository();
    const service = new NotificationService(repository, () => new Date("2026-10-04T00:00:00.000Z"));
    const input = {
      userId: randomUUID(),
      bookingId: randomUUID(),
      venueName: "Kabul Arena",
      startsAt: "2026-10-05T14:00:00.000Z",
    };

    await service.bookingConfirmed(input);
    await service.bookingConfirmed(input);

    expect(repository.notifications).toHaveLength(1);
    expect(repository.deliveries.filter((item) => item.channel === "IN_APP")).toHaveLength(1);
  });

  it("limits marketing notifications to three per rolling 24 hours", async () => {
    const repository = new FakeNotificationRepository();
    const service = new NotificationService(repository, () => new Date("2026-10-04T12:00:00.000Z"));
    const userId = randomUUID();

    for (let index = 0; index < MARKETING_LIMIT_PER_24H + 2; index += 1) {
      await service.promotionPublished({
        venueId: randomUUID(),
        promotionId: randomUUID(),
        venueName: "Venue",
        title: `Offer ${index}`,
        followerUserIds: [userId],
      });
    }

    expect(repository.notifications.filter((item) => item.type === "SLOT_PROMOTION")).toHaveLength(MARKETING_LIMIT_PER_24H);
  });

  it("creates an in-app notification when an online booking is confirmed", async () => {
    const bookingRepository = new FakeBookingRepository();
    const notificationRepository = new FakeNotificationRepository();
    const notifications = new NotificationService(notificationRepository, () => new Date("2026-10-04T00:00:00.000Z"));
    const booking = new BookingService(bookingRepository, () => new Date("2026-10-04T00:00:00.000Z"), notifications);
    const playerUserId = randomUUID();
    const { venue, areaId } = bookingRepository.seedVenue(randomUUID());

    const availability = await booking.getAvailability(venue.id, "2026-10-05");
    const slot = availability.slots.find((item) => item.areaId === areaId)!;

    const created = await booking.createOnlineBooking(playerUserId, {
      areaId,
      startsAt: slot.startsAt,
      idempotencyKey: "notify-booking-123",
      note: "",
    });

    expect(created.status).toBe("CONFIRMED");
    expect(notificationRepository.notifications).toHaveLength(1);
    expect(notificationRepository.notifications[0]?.type).toBe("BOOKING_CONFIRMED");
  });
});
