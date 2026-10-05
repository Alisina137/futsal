import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { AuthService } from "../src/modules/auth/auth.service.js";
import { TokenService } from "../src/modules/auth/token.service.js";
import { BookingService } from "../src/modules/booking/booking.service.js";
import { FakeAuthRepository } from "./fake-auth-repository.js";
import { FakeBookingRepository } from "./fake-booking-repository.js";

function setup() {
  const authRepository = new FakeAuthRepository();
  const bookingRepository = new FakeBookingRepository();
  const tokens = new TokenService("test-secret-that-is-longer-than-thirty-two-characters", "test", "test-mobile");
  const auth = new AuthService(authRepository, tokens);
  const clock = { now: new Date("2026-10-04T00:00:00.000Z") };
  const booking = new BookingService(bookingRepository, () => clock.now);
  const app = createApp({ authService: auth, tokenService: tokens, bookingService: booking });
  return { app, bookingRepository, clock };
}

async function register(app: ReturnType<typeof createApp>, accountType: "PLAYER" | "VENUE_OWNER", phone: string) {
  return request(app).post("/api/v1/auth/register").send({
    displayName: accountType === "PLAYER" ? "Player" : "Owner",
    phone,
    password: "strong-pass-3",
    preferredLanguage: "fa-AF",
    accountType,
  });
}

describe("Phase 3 availability and booking API", () => {
  it("publishes live slots from opening hours and area price", async () => {
    const { app, bookingRepository } = setup();
    const owner = await register(app, "VENUE_OWNER", "0702223300");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);

    const response = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    expect(response.status).toBe(200);
    expect(response.body.live).toBe(true);
    expect(response.body.slots.length).toBeGreaterThan(0);
    expect(response.body.slots[0].priceAfn).toBe(1800);
    expect(response.body.generatedAt).toBe("2026-10-04T00:00:00.000Z");
  });

  it("allows exactly one winner when two players race for the same slot", async () => {
    const { app, bookingRepository } = setup();
    const owner = await register(app, "VENUE_OWNER", "0702223311");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);
    const first = await register(app, "PLAYER", "0702223322");
    const second = await register(app, "PLAYER", "0702223333");
    const availability = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    const slot = availability.body.slots[0];

    const [a, b] = await Promise.all([
      request(app).post("/api/v1/bookings").set("Authorization", `Bearer ${first.body.accessToken}`).send({
        areaId: slot.areaId, startsAt: slot.startsAt, idempotencyKey: "race-player-a",
      }),
      request(app).post("/api/v1/bookings").set("Authorization", `Bearer ${second.body.accessToken}`).send({
        areaId: slot.areaId, startsAt: slot.startsAt, idempotencyKey: "race-player-b",
      }),
    ]);

    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect([...bookingRepository.bookings.values()].filter((booking) => booking.status !== "CANCELLED")).toHaveLength(1);
  });

  it("prevents manual and online occupancy from overlapping", async () => {
    const { app, bookingRepository } = setup();
    const owner = await register(app, "VENUE_OWNER", "0702223344");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);
    const player = await register(app, "PLAYER", "0702223355");
    const availability = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    const slot = availability.body.slots[0];

    const manual = await request(app).post("/api/v1/owner/bookings/manual")
      .set("Authorization", `Bearer ${owner.body.accessToken}`)
      .send({
        areaId: slot.areaId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        customerName: "Phone customer",
        customerPhone: "0791112233",
      });
    expect(manual.status).toBe(201);

    const online = await request(app).post("/api/v1/bookings")
      .set("Authorization", `Bearer ${player.body.accessToken}`)
      .send({ areaId: slot.areaId, startsAt: slot.startsAt, idempotencyKey: "manual-online-conflict" });
    expect(online.status).toBe(409);
    expect(online.body.error.code).toBe("SLOT_UNAVAILABLE");
  });

  it("owner blocks remove capacity and cancellation makes capacity available again", async () => {
    const { app, bookingRepository } = setup();
    const owner = await register(app, "VENUE_OWNER", "0702223366");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);
    const player = await register(app, "PLAYER", "0702223377");

    let availability = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    const blockedSlot = availability.body.slots[0];
    const block = await request(app).post("/api/v1/owner/blocks")
      .set("Authorization", `Bearer ${owner.body.accessToken}`)
      .send({ areaId: blockedSlot.areaId, startsAt: blockedSlot.startsAt, endsAt: blockedSlot.endsAt, reason: "Maintenance" });
    expect(block.status).toBe(201);

    availability = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    expect(availability.body.slots.some((slot: { startsAt: string }) => slot.startsAt === blockedSlot.startsAt)).toBe(false);

    const bookableSlot = availability.body.slots[0];
    const booked = await request(app).post("/api/v1/bookings")
      .set("Authorization", `Bearer ${player.body.accessToken}`)
      .send({ areaId: bookableSlot.areaId, startsAt: bookableSlot.startsAt, idempotencyKey: "cancel-frees-capacity" });
    expect(booked.status).toBe(201);

    const cancelled = await request(app).post(`/api/v1/bookings/${booked.body.booking.id}/cancel`)
      .set("Authorization", `Bearer ${player.body.accessToken}`)
      .send({ reason: "Plans changed" });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.booking.status).toBe("CANCELLED");

    availability = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    expect(availability.body.slots.some((slot: { startsAt: string }) => slot.startsAt === bookableSlot.startsAt)).toBe(true);
  });

  it("retries the same player's idempotency key without creating a duplicate booking", async () => {
    const { app, bookingRepository } = setup();
    const owner = await register(app, "VENUE_OWNER", "0702223390");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);
    const player = await register(app, "PLAYER", "0702223391");
    const availability = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    const slot = availability.body.slots[0];
    const body = { areaId: slot.areaId, startsAt: slot.startsAt, idempotencyKey: "stable-retry-key" };

    const first = await request(app).post("/api/v1/bookings").set("Authorization", `Bearer ${player.body.accessToken}`).send(body);
    const retry = await request(app).post("/api/v1/bookings").set("Authorization", `Bearer ${player.body.accessToken}`).send(body);

    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(retry.body.booking.id).toBe(first.body.booking.id);
    expect([...bookingRepository.bookings.values()]).toHaveLength(1);
  });

  it("keeps owner booking controls tenant-scoped", async () => {
    const { app, bookingRepository } = setup();
    const ownerA = await register(app, "VENUE_OWNER", "0702223392");
    const ownerB = await register(app, "VENUE_OWNER", "0702223393");
    const { venue } = bookingRepository.seedVenue(ownerA.body.user.id);
    bookingRepository.seedVenue(ownerB.body.user.id);
    const player = await register(app, "PLAYER", "0702223394");
    const availability = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    const slot = availability.body.slots[0];
    const booked = await request(app).post("/api/v1/bookings")
      .set("Authorization", `Bearer ${player.body.accessToken}`)
      .send({ areaId: slot.areaId, startsAt: slot.startsAt, idempotencyKey: "tenant-scope-booking" });

    const denied = await request(app).post(`/api/v1/owner/bookings/${booked.body.booking.id}/cancel`)
      .set("Authorization", `Bearer ${ownerB.body.accessToken}`)
      .send({ reason: "Not my venue" });

    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("BOOKING_ACCESS_DENIED");
  });

  it("rejects impossible calendar dates", async () => {
    const { app, bookingRepository } = setup();
    const owner = await register(app, "VENUE_OWNER", "0702223395");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id);
    const response = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-02-31`);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("keeps existing booking service available in continuity mode while blocking new inventory writes", async () => {
    const { app, bookingRepository, clock } = setup();
    const owner = await register(app, "VENUE_OWNER", "0702223387");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id, {
      trialEndsAt: new Date("2026-10-04T01:00:00.000Z"),
    });
    const auth = { Authorization: `Bearer ${owner.body.accessToken}` };

    clock.now = new Date("2026-10-04T00:30:00.000Z");
    const availability = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    const slot = availability.body.slots[0];

    const manual = await request(app)
      .post("/api/v1/owner/bookings/manual")
      .set(auth)
      .send({
        areaId: slot.areaId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        customerName: "Continuity customer",
      });
    expect(manual.status).toBe(201);

    clock.now = new Date("2026-10-04T02:00:00.000Z");

    const schedule = await request(app)
      .get("/api/v1/owner/schedule?date=2026-10-05")
      .set(auth);
    expect(schedule.status).toBe(200);
    expect(schedule.body.bookings.some((item: { id: string }) => item.id === manual.body.booking.id)).toBe(true);

    const deniedWrite = await request(app)
      .post("/api/v1/owner/bookings/manual")
      .set(auth)
      .send({
        areaId: slot.areaId,
        startsAt: "2026-10-05T06:00:00.000Z",
        endsAt: "2026-10-05T07:30:00.000Z",
        customerName: "Blocked after expiry",
      });
    expect(deniedWrite.status).toBe(403);
    expect(deniedWrite.body.error.code).toBe("SUBSCRIPTION_REQUIRED");

    const cancelled = await request(app)
      .post(`/api/v1/owner/bookings/${manual.body.booking.id}/cancel`)
      .set(auth)
      .send({ reason: "Customer cancelled" });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.booking.status).toBe("CANCELLED");
  });

  it("does not expose bookable inventory after the trial expires", async () => {
    const { app, bookingRepository, clock } = setup();
    const owner = await register(app, "VENUE_OWNER", "0702223388");
    const { venue } = bookingRepository.seedVenue(owner.body.user.id, { trialEndsAt: new Date("2026-10-04T01:00:00.000Z") });
    clock.now = new Date("2026-10-04T02:00:00.000Z");

    const list = await request(app).get("/api/v1/venues");
    expect(list.body.venues.some((item: { id: string }) => item.id === venue.id)).toBe(false);

    const availability = await request(app).get(`/api/v1/venues/${venue.id}/availability?date=2026-10-05`);
    expect(availability.status).toBe(400);
    expect(availability.body.error.code).toBe("VENUE_NOT_BOOKABLE");
  });
});
