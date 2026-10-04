import type {
  NotificationPreferencesUpdate,
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

  async list(userId: string) {
    return {
      notifications: await this.repository.listNotifications(userId, 100),
      generatedAt: this.now().toISOString(),
    };
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.repository.markRead(userId, notificationId, this.now());
    if (!notification) throw errors.badRequest("NOTIFICATION_NOT_FOUND", "Notification not found.");
    return notification;
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
      data: { bookingId: input.bookingId, startsAt: input.startsAt },
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
      data: { bookingId: input.bookingId },
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
    await Promise.all(input.followerUserIds.map((userId) => this.publish({
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
    await Promise.all(input.followerUserIds.map((userId) => this.publish({
      userId,
      type: "VENUE_POST",
      title: input.venueName,
      body: "A venue you follow published a new update.",
      deepLink: `/posts/${input.postId}`,
      data: { venueId: input.venueId, postId: input.postId },
      dedupeKey: `venue-post:${input.postId}`,
      marketing: true,
    })));
  }
}

export { MARKETING_LIMIT_PER_24H };
