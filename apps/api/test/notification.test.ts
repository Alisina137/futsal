import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { BookingService } from "../src/modules/booking/booking.service.js";
import { NotificationService, MARKETING_LIMIT_PER_24H } from "../src/modules/notifications/notification.service.js";
import { FakeBookingRepository } from "./fake-booking-repository.js";
import { FakeNotificationRepository } from "./fake-notification-repository.js";

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
