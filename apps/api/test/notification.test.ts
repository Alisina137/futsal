import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { BookingService } from "../src/modules/booking/booking.service.js";
import { NotificationService, MARKETING_LIMIT_PER_24H } from "../src/modules/notifications/notification.service.js";
import { FakeBookingRepository } from "./fake-booking-repository.js";
import { FakeNotificationRepository } from "./fake-notification-repository.js";

describe("Phase 4 notification policy", () => {
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
