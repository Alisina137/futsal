import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { AuthService } from "../src/modules/auth/auth.service.js";
import { TokenService } from "../src/modules/auth/token.service.js";
import { BookingService } from "../src/modules/booking/booking.service.js";
import { MarketingService } from "../src/modules/marketing/marketing.service.js";
import { FakeAuthRepository } from "./fake-auth-repository.js";
import { FakeBookingRepository } from "./fake-booking-repository.js";
import { FakeMarketingRepository } from "./fake-marketing-repository.js";

function setup() {
  const authRepository = new FakeAuthRepository();
  const bookingRepository = new FakeBookingRepository();
  const marketingRepository = new FakeMarketingRepository();
  const tokens = new TokenService("test-secret-that-is-longer-than-thirty-two-characters", "test", "test-mobile");
  const auth = new AuthService(authRepository, tokens);
  const clock = { now: new Date("2026-10-04T00:00:00.000Z") };
  const booking = new BookingService(bookingRepository, () => clock.now);
  marketingRepository.onPromotionCreated = (promotion) => {
    bookingRepository.promotionPrices.push({
      id: promotion.id,
      areaId: promotion.areaId,
      startsAt: new Date(promotion.startsAt),
      endsAt: new Date(promotion.endsAt),
      discountedPriceAfn: promotion.discountedPriceAfn,
    });
  };
  const marketing = new MarketingService(marketingRepository, booking, () => clock.now);
  const app = createApp({ authService: auth, tokenService: tokens, bookingService: booking, marketingService: marketing });
  return { app, bookingRepository, marketingRepository, clock };
}

async function register(app: ReturnType<typeof createApp>, accountType: "PLAYER" | "VENUE_OWNER", phone: string) {
  return request(app).post("/api/v1/auth/register").send({
    displayName: accountType === "PLAYER" ? "Player" : "Owner",
    phone,
    password: "strong-pass-4",
    preferredLanguage: "fa-AF",
    accountType,
  });
}

function seedMarketingFromBooking(marketingRepository: FakeMarketingRepository, venue: ReturnType<FakeBookingRepository["seedVenue"]>["venue"]) {
  marketingRepository.seedVenue({
    id: venue.id,
    ownerUserId: venue.ownerUserId,
    name: venue.name,
    timezone: venue.timezone,
    status: venue.status,
    subscription: venue.subscription,
  });
}

describe("Phase 4 marketing API", () => {
  it("creates a promotion only for a live available slot and exposes it in feed", async () => {
    const { app, bookingRepository, marketingRepository } = setup();
    const owner = await register(app, "VENUE_OWNER", "0703334400");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);
    seedMarketingFromBooking(marketingRepository, venue);

    const availability = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    const slot = availability.body.slots[0];

    const created = await request(app).post("/api/v1/owner/promotions")
      .set("Authorization", `Bearer ${owner.body.accessToken}`)
      .send({
        areaId: slot.areaId,
        startsAt: slot.startsAt,
        discountedPriceAfn: 1400,
        title: "Tonight discount",
        note: "One empty slot",
        notifyFollowers: true,
      });

    expect(created.status).toBe(201);
    expect(created.body.promotion.originalPriceAfn).toBe(1800);
    expect(created.body.promotion.discountedPriceAfn).toBe(1400);

    const feed = await request(app).get("/api/v1/feed");
    expect(feed.status).toBe(200);
    expect(feed.body.items[0].type).toBe("PROMOTION");
    expect(feed.body.items[0].promotion.id).toBe(created.body.promotion.id);
  });

  it("books a promoted slot at the discounted server price", async () => {
    const { app, bookingRepository, marketingRepository } = setup();
    const owner = await register(app, "VENUE_OWNER", "0703334455");
    const player = await register(app, "PLAYER", "0703334466");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);
    seedMarketingFromBooking(marketingRepository, venue);

    let availability = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    const slot = availability.body.slots[0];

    const promotion = await request(app).post("/api/v1/owner/promotions")
      .set("Authorization", `Bearer ${owner.body.accessToken}`)
      .send({
        areaId: slot.areaId,
        startsAt: slot.startsAt,
        discountedPriceAfn: 1250,
        title: "Weak slot deal",
        notifyFollowers: false,
      });
    expect(promotion.status).toBe(201);

    availability = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    const promotedSlot = availability.body.slots.find((item: { promotionId: string | null }) => item.promotionId === promotion.body.promotion.id);
    expect(promotedSlot.priceAfn).toBe(1250);
    expect(promotedSlot.originalPriceAfn).toBe(1800);

    const booked = await request(app).post("/api/v1/bookings")
      .set("Authorization", `Bearer ${player.body.accessToken}`)
      .send({
        areaId: promotedSlot.areaId,
        startsAt: promotedSlot.startsAt,
        idempotencyKey: "phase4-discount-booking",
      });

    expect(booked.status).toBe(201);
    expect(booked.body.booking.priceAfn).toBe(1250);
    expect(bookingRepository.promotionPrices).toHaveLength(0);
  });

  it("rejects a promotion price that is not a discount", async () => {
    const { app, bookingRepository, marketingRepository } = setup();
    const owner = await register(app, "VENUE_OWNER", "0703334411");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);
    seedMarketingFromBooking(marketingRepository, venue);
    const availability = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    const slot = availability.body.slots[0];

    const response = await request(app).post("/api/v1/owner/promotions")
      .set("Authorization", `Bearer ${owner.body.accessToken}`)
      .send({ areaId: slot.areaId, startsAt: slot.startsAt, discountedPriceAfn: 1800, title: "Not actually discounted", notifyFollowers: false });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_DISCOUNT");
  });

  it("follows and unfollows a venue idempotently", async () => {
    const { app, bookingRepository, marketingRepository } = setup();
    const owner = await register(app, "VENUE_OWNER", "0703334422");
    const player = await register(app, "PLAYER", "0703334433");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);
    seedMarketingFromBooking(marketingRepository, venue);

    const first = await request(app).post(`/api/v1/venues/${venue.id}/follow`)
      .set("Authorization", `Bearer ${player.body.accessToken}`);
    const retry = await request(app).post(`/api/v1/venues/${venue.id}/follow`)
      .set("Authorization", `Bearer ${player.body.accessToken}`);

    expect(first.body.following).toBe(true);
    expect(retry.body.followerCount).toBe(1);

    const removed = await request(app).delete(`/api/v1/venues/${venue.id}/follow`)
      .set("Authorization", `Bearer ${player.body.accessToken}`);
    expect(removed.body.following).toBe(false);
    expect(removed.body.followerCount).toBe(0);
  });

  it("publishes and unpublishes a venue post with a structured venue CTA", async () => {
    const { app, bookingRepository, marketingRepository } = setup();
    const owner = await register(app, "VENUE_OWNER", "0703334444");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);
    seedMarketingFromBooking(marketingRepository, venue);

    const created = await request(app).post("/api/v1/owner/posts")
      .set("Authorization", `Bearer ${owner.body.accessToken}`)
      .send({ body: "Weekend futsal is open.", ctaType: "VENUE", notifyFollowers: false });

    expect(created.status).toBe(201);
    expect(created.body.post.ctaTargetId).toBe(venue.id);

    const publicPost = await request(app).get(`/api/v1/posts/${created.body.post.id}`);
    expect(publicPost.status).toBe(200);

    const hidden = await request(app).post(`/api/v1/owner/posts/${created.body.post.id}/unpublish`)
      .set("Authorization", `Bearer ${owner.body.accessToken}`);
    expect(hidden.body.post.status).toBe("UNPUBLISHED");

    const unavailable = await request(app).get(`/api/v1/posts/${created.body.post.id}`);
    expect(unavailable.status).toBe(400);
  });
});
