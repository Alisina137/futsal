import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { AuthService } from "../src/modules/auth/auth.service.js";
import { TokenService } from "../src/modules/auth/token.service.js";
import { CommercialService } from "../src/modules/commercial/commercial.service.js";
import type {
  CommercialRepository,
  CommercialSettingsRecord,
  CommercialVenueRecord,
} from "../src/modules/commercial/commercial.types.js";
import { FakeAuthRepository } from "./fake-auth-repository.js";

class FakeCommercialRepository implements CommercialRepository {
  requested = false;
  activated = false;
  userStatus: "ACTIVE" | "SUSPENDED" = "ACTIVE";
  venue: CommercialVenueRecord = {
    id: "11111111-1111-4111-8111-111111111111",
    ownerUserId: "22222222-2222-4222-8222-222222222222",
    name: "Kabul Arena",
    province: "Kabul",
    city: "Kabul",
    address: "District 10",
    timezone: "Asia/Kabul",
    status: "ACTIVE",
    verificationStatus: "PENDING",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    subscription: {
      venueId: "11111111-1111-4111-8111-111111111111",
      status: "TRIAL",
      trialStartedAt: new Date("2026-10-01T00:00:00.000Z"),
      trialEndsAt: new Date("2026-10-04T00:00:00.000Z"),
      activeUntil: null,
    },
  };

  async getOwnerVenue(ownerUserId: string) {
    return ownerUserId === this.venue.ownerUserId ? this.venue : null;
  }
  async getVenue(venueId: string) { return venueId === this.venue.id ? this.venue : null; }
  async getSettings(): Promise<CommercialSettingsRecord | null> { return null; }
  async listPayments() { return []; }
  async requestReactivation() { this.requested = true; }
  async analyticsSnapshot(ownerUserId: string) {
    if (ownerUserId !== this.venue.ownerUserId) return null;
    return {
      venue: this.venue,
      activeAreaCount: 1,
      openingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({
        dayOfWeek,
        isClosed: false,
        opensAt: "08:00",
        closesAt: "22:00",
      })),
      bookings: [
        {
          status: "CONFIRMED" as const,
          source: "ONLINE" as const,
          startsAt: new Date("2026-10-05T04:00:00.000Z"),
          endsAt: new Date("2026-10-05T05:30:00.000Z"),
          priceAfn: 1800,
        },
        {
          status: "CANCELLED" as const,
          source: "MANUAL" as const,
          startsAt: new Date("2026-10-05T06:00:00.000Z"),
          endsAt: new Date("2026-10-05T07:30:00.000Z"),
          priceAfn: 1800,
        },
      ],
    };
  }
  async adminDashboard() {
    return {
      activeUsers: 1,
      activeVenues: 1,
      pendingVenueVerifications: 1,
      trialVenues: 0,
      paidVenues: 0,
      expiredVenues: 1,
      recordedPaymentsAfn: 0,
      bookingGmvAfn: 1800,
    };
  }
  async listUsers() { return []; }
  async listVenues() {
    return [{
      id: this.venue.id,
      ownerUserId: this.venue.ownerUserId,
      name: this.venue.name,
      province: this.venue.province,
      city: this.venue.city,
      address: this.venue.address,
      status: this.venue.status,
      verificationStatus: this.venue.verificationStatus,
      subscriptionState: "EXPIRED" as const,
      trialEndsAt: this.venue.subscription?.trialEndsAt?.toISOString() ?? null,
      activeUntil: null,
      createdAt: this.venue.createdAt.toISOString(),
    }];
  }
  async setUserStatus(_actor: string, _user: string, status: "ACTIVE" | "SUSPENDED") { this.userStatus = status; }
  async applyVenueAction(_actor: string, _venue: string, action: "VERIFY" | "REJECT" | "SUSPEND" | "RESTORE") {
    if (action === "VERIFY") this.venue.verificationStatus = "VERIFIED";
    if (action === "SUSPEND") this.venue.status = "SUSPENDED";
    if (action === "RESTORE") this.venue.status = "ACTIVE";
  }
  async activateSubscription() { this.activated = true; }
  async extendTrial() {}
  async voidPayment() {}
  async updateSettings(_actor: string, input: Omit<CommercialSettingsRecord, "updatedAt">, now: Date) {
    return { ...input, updatedAt: now };
  }
  async listAuditLogs() { return []; }
  async addSupportNote() {}
  async unpublishPost() {}
  async closePromotion() {}
}

function setup() {
  const authRepository = new FakeAuthRepository();
  const tokens = new TokenService("test-secret-that-is-longer-than-thirty-two-characters", "test", "test-mobile");
  const auth = new AuthService(authRepository, tokens);
  const repository = new FakeCommercialRepository();
  const clock = new Date("2026-10-05T00:00:00.000Z");
  const commercial = new CommercialService(repository, () => clock);
  const app = createApp({ authService: auth, tokenService: tokens, commercialService: commercial });
  return { app, tokens, repository, commercial };
}

describe("Phase 7 commercial SaaS API", () => {
  it("puts expired owners into continuity mode with payment/config visibility", async () => {
    const { app, tokens, repository } = setup();
    const access = await tokens.createAccessToken(repository.venue.ownerUserId, ["VENUE_OWNER"]);
    const response = await request(app)
      .get("/api/v1/owner/subscription")
      .set("Authorization", `Bearer ${access.token}`);

    expect(response.status).toBe(200);
    expect(response.body.subscription.state).toBe("EXPIRED");
    expect(response.body.subscription.accessMode).toBe("CONTINUITY");
    expect(response.body.subscription.canServiceExistingBookings).toBe(true);
    expect(response.body.settings.trialDurationHours).toBe(72);
  });

  it("calculates occupancy and booking-value analytics from authoritative bookings", async () => {
    const { commercial, repository } = setup();
    const result = await commercial.ownerAnalytics(repository.venue.ownerUserId, "2026-10-05", "2026-10-05");

    expect(result.bookingCount).toBe(2);
    expect(result.cancelledBookingCount).toBe(1);
    expect(result.onlineBookingCount).toBe(1);
    expect(result.grossBookingValueAfn).toBe(1800);
    expect(result.bookedMinutes).toBe(90);
    expect(result.availableMinutes).toBe(14 * 60);
  });

  it("protects platform admin routes with PLATFORM_ADMIN role", async () => {
    const { app, tokens } = setup();
    const player = await tokens.createAccessToken("33333333-3333-4333-8333-333333333333", ["PLAYER"]);
    const denied = await request(app)
      .get("/api/v1/admin/dashboard")
      .set("Authorization", `Bearer ${player.token}`);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("ROLE_REQUIRED");

    const admin = await tokens.createAccessToken("44444444-4444-4444-8444-444444444444", ["PLATFORM_ADMIN"]);
    const allowed = await request(app)
      .get("/api/v1/admin/dashboard")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(allowed.status).toBe(200);
    expect(allowed.body.pendingVenueVerifications).toBe(1);
  });

  it("allows an admin to activate a venue subscription", async () => {
    const { app, tokens, repository } = setup();
    const admin = await tokens.createAccessToken("44444444-4444-4444-8444-444444444444", ["PLATFORM_ADMIN"]);
    const response = await request(app)
      .post(`/api/v1/admin/venues/${repository.venue.id}/subscription/activate`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ months: 1, amountAfn: 1500, provider: "MANUAL", providerReference: "cash-001", note: "Paid at office" });

    expect(response.status).toBe(201);
    expect(repository.activated).toBe(true);
  });
});
