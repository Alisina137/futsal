import { randomUUID } from "node:crypto";
import type { OwnerVenueSetupRequest } from "@leaguekick/contracts";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { errors } from "../src/lib/errors.js";
import { AuthService } from "../src/modules/auth/auth.service.js";
import { TokenService } from "../src/modules/auth/token.service.js";
import { OwnerOnboardingService, TRIAL_DURATION_MS } from "../src/modules/owner/owner.service.js";
import type {
  OwnerAggregate,
  OwnerOnboardingRepository,
  OwnerSubscriptionRecord,
  OwnerVenueRecord,
} from "../src/modules/owner/owner.types.js";
import { FakeAuthRepository } from "./fake-auth-repository.js";

class FakeOwnerRepository implements OwnerOnboardingRepository {
  venues = new Map<string, OwnerAggregate>();
  claimedIdentities = new Set<string>();

  async getByOwnerId(ownerUserId: string) {
    return this.venues.get(ownerUserId) ?? null;
  }

  async saveSetup(input: {
    ownerUserId: string;
    setup: OwnerVenueSetupRequest;
    publicPhone: string;
    whatsappPhone: string | null;
    completedAt: Date;
  }) {
    const previous = this.venues.get(input.ownerUserId);
    const venue: OwnerVenueRecord = {
      id: previous?.venue.id ?? randomUUID(),
      ownerUserId: input.ownerUserId,
      name: input.setup.venue.name,
      publicPhone: input.publicPhone,
      whatsappPhone: input.whatsappPhone,
      province: input.setup.venue.province,
      city: input.setup.venue.city,
      address: input.setup.venue.address,
      latitude: input.setup.venue.latitude ?? null,
      longitude: input.setup.venue.longitude ?? null,
      status: previous?.venue.status === "ACTIVE" ? "ACTIVE" : "READY",
      setupCompletedAt: previous?.venue.setupCompletedAt ?? input.completedAt,
      areas: input.setup.areas.map((area, index) => ({
        id: previous?.venue.areas[index]?.id ?? randomUUID(),
        ...area,
      })),
      openingHours: input.setup.openingHours,
    };
    const aggregate = { venue, subscription: previous?.subscription ?? null };
    this.venues.set(input.ownerUserId, aggregate);
    return aggregate;
  }

  async startTrial(input: {
    ownerUserId: string;
    venueId: string;
    identityHash: string;
    startedAt: Date;
    endsAt: Date;
  }) {
    const current = this.venues.get(input.ownerUserId);
    if (!current) throw new Error("Venue missing.");
    if (current.subscription) return current.subscription;
    if (this.claimedIdentities.has(input.identityHash)) {
      throw errors.conflict("TRIAL_ALREADY_USED", "This physical venue has already used its Premium trial.");
    }
    this.claimedIdentities.add(input.identityHash);
    const subscription: OwnerSubscriptionRecord = {
      venueId: input.venueId,
      status: "TRIAL",
      trialStartedAt: input.startedAt,
      trialEndsAt: input.endsAt,
      activeUntil: null,
    };
    this.venues.set(input.ownerUserId, {
      venue: { ...current.venue, status: "ACTIVE" },
      subscription,
    });
    return subscription;
  }

  async expireTrial(venueId: string) {
    for (const [ownerId, aggregate] of this.venues) {
      if (aggregate.venue.id === venueId && aggregate.subscription) {
        this.venues.set(ownerId, {
          venue: aggregate.venue,
          subscription: { ...aggregate.subscription, status: "EXPIRED" },
        });
      }
    }
  }
}

const completeSetup = {
  venue: {
    name: "Kabul Futsal Center",
    publicPhone: "0795556677",
    whatsappPhone: "",
    province: "Kabul",
    city: "Kabul",
    address: "District 10, Kabul",
    latitude: null,
    longitude: null,
  },
  areas: [{ name: "Pitch 1", defaultSessionDurationMinutes: 90, basePriceAfn: 1800 }],
  openingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isClosed: false,
    opensAt: "08:00",
    closesAt: "22:00",
  })),
} satisfies OwnerVenueSetupRequest;

function setup(now = new Date("2026-10-04T00:00:00.000Z")) {
  const authRepository = new FakeAuthRepository();
  const ownerRepository = new FakeOwnerRepository();
  const tokens = new TokenService("test-secret-that-is-longer-than-thirty-two-characters", "test", "test-mobile");
  const auth = new AuthService(authRepository, tokens);
  const owner = new OwnerOnboardingService(ownerRepository, () => now);
  return {
    app: createApp({ authService: auth, tokenService: tokens, ownerService: owner }),
    authRepository,
    ownerRepository,
  };
}

async function register(app: ReturnType<typeof createApp>, accountType: "PLAYER" | "VENUE_OWNER", phone: string) {
  return request(app).post("/api/v1/auth/register").send({
    displayName: accountType === "PLAYER" ? "Player" : "Owner",
    phone,
    password: "strong-pass-2",
    preferredLanguage: "fa-AF",
    accountType,
  });
}

describe("Phase 2 owner onboarding API", () => {
  it("rejects owner routes for ordinary players", async () => {
    const { app } = setup();
    const player = await register(app, "PLAYER", "0701112233");
    const response = await request(app)
      .get("/api/v1/owner/onboarding")
      .set("Authorization", `Bearer ${player.body.accessToken}`);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("ROLE_REQUIRED");
  });

  it("does not start a trial before venue setup is complete", async () => {
    const { app } = setup();
    const owner = await register(app, "VENUE_OWNER", "0701112244");
    const response = await request(app)
      .post("/api/v1/owner/trial/start")
      .set("Authorization", `Bearer ${owner.body.accessToken}`);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("SETUP_INCOMPLETE");
  });

  it("saves one venue per owner and starts an exact 72-hour trial explicitly", async () => {
    const now = new Date("2026-10-04T03:00:00.000Z");
    const { app } = setup(now);
    const owner = await register(app, "VENUE_OWNER", "0701112255");
    const auth = { Authorization: `Bearer ${owner.body.accessToken}` };

    const before = await request(app).get("/api/v1/owner/onboarding").set(auth);
    expect(before.body.venue).toBeNull();
    expect(before.body.subscription.state).toBe("NOT_STARTED");

    const saved = await request(app).put("/api/v1/owner/onboarding").set(auth).send(completeSetup);
    expect(saved.status).toBe(200);
    expect(saved.body.setupComplete).toBe(true);
    expect(saved.body.subscription.state).toBe("NOT_STARTED");
    const firstVenueId = saved.body.venue.id;

    const resaved = await request(app).put("/api/v1/owner/onboarding").set(auth).send({
      ...completeSetup,
      venue: { ...completeSetup.venue, name: "Kabul Futsal Center Updated" },
    });
    expect(resaved.body.venue.id).toBe(firstVenueId);

    const trial = await request(app).post("/api/v1/owner/trial/start").set(auth);
    expect(trial.status).toBe(200);
    expect(trial.body.subscription.state).toBe("TRIAL");
    const started = Date.parse(trial.body.subscription.trialStartedAt);
    const ends = Date.parse(trial.body.subscription.trialEndsAt);
    expect(ends - started).toBe(TRIAL_DURATION_MS);

    const secondStart = await request(app).post("/api/v1/owner/trial/start").set(auth);
    expect(secondStart.body.subscription.trialStartedAt).toBe(trial.body.subscription.trialStartedAt);
  });

  it("prevents a second account from claiming a new trial for the same physical venue", async () => {
    const { app } = setup();
    const first = await register(app, "VENUE_OWNER", "0701112266");
    const second = await register(app, "VENUE_OWNER", "0701112277");
    const firstAuth = { Authorization: `Bearer ${first.body.accessToken}` };
    const secondAuth = { Authorization: `Bearer ${second.body.accessToken}` };

    expect((await request(app).put("/api/v1/owner/onboarding").set(firstAuth).send(completeSetup)).status).toBe(200);
    expect((await request(app).put("/api/v1/owner/onboarding").set(secondAuth).send(completeSetup)).status).toBe(200);
    expect((await request(app).post("/api/v1/owner/trial/start").set(firstAuth)).status).toBe(200);

    const duplicate = await request(app).post("/api/v1/owner/trial/start").set(secondAuth);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("TRIAL_ALREADY_USED");
  });
});
