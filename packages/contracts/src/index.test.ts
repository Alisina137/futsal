import { describe, expect, it } from "vitest";
import {
  manualBookingRequestSchema,
  normalizeAfghanistanPhone,
  onlineBookingRequestSchema,
  ownerVenueSetupRequestSchema,
  registerRequestSchema,
  venueBlockRequestSchema,
  promotionCreateRequestSchema,
  venuePostCreateRequestSchema,
  pushDeviceRegisterRequestSchema,
  playerProfileUpdateRequestSchema,
  teamCreateRequestSchema,
  teamInviteRequestSchema,
  competitionCreateRequestSchema,
  competitionUpdateRequestSchema,
} from "./index";

describe("shared auth contracts", () => {
  it("normalizes common Afghanistan mobile forms", () => {
    expect(normalizeAfghanistanPhone("0791234567")).toBe("+93791234567");
    expect(normalizeAfghanistanPhone("+93 79 123 4567")).toBe("+93791234567");
  });

  it("accepts player registration input", () => {
    expect(registerRequestSchema.safeParse({
      displayName: "Ahmad",
      phone: "0791234567",
      username: "ahmad_7",
      password: "strong-pass-1",
      preferredLanguage: "fa-AF",
      accountType: "PLAYER",
    }).success).toBe(true);
  });

  it("accepts an 8-character new password with a special character", () => {
    expect(registerRequestSchema.safeParse({
      displayName: "Ahmad",
      phone: "0791234567",
      username: "ahmad_8",
      password: "Abcdefg!",
      preferredLanguage: "fa-AF",
      accountType: "PLAYER",
    }).success).toBe(true);
  });

  it("rejects a new password without a special character", () => {
    expect(registerRequestSchema.safeParse({
      displayName: "Ahmad",
      phone: "0791234567",
      username: "ahmad_9",
      password: "abcdefgh",
      preferredLanguage: "fa-AF",
      accountType: "PLAYER",
    }).success).toBe(false);
  });
});

describe("Phase 2 owner onboarding contracts", () => {
  const setup = {
    venue: {
      name: "Kabul Futsal Center",
      publicPhone: "0791234567",
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
  };

  it("accepts a complete venue setup", () => {
    expect(ownerVenueSetupRequestSchema.safeParse(setup).success).toBe(true);
  });

  it("requires all seven unique weekdays", () => {
    const invalid = { ...setup, openingHours: setup.openingHours.map((hour) => ({ ...hour, dayOfWeek: 0 })) };
    expect(ownerVenueSetupRequestSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects closing time before opening time", () => {
    const invalid = {
      ...setup,
      openingHours: setup.openingHours.map((hour, index) => index === 0 ? { ...hour, opensAt: "20:00", closesAt: "09:00" } : hour),
    };
    expect(ownerVenueSetupRequestSchema.safeParse(invalid).success).toBe(false);
  });
});


describe("Phase 3 booking contracts", () => {
  it("accepts a timezone-qualified online booking request", () => {
    expect(onlineBookingRequestSchema.safeParse({
      areaId: "11111111-1111-4111-8111-111111111111",
      startsAt: "2026-10-05T14:00:00+04:30",
      idempotencyKey: "booking-abc-123",
      note: "",
    }).success).toBe(true);
  });

  it("rejects manual bookings and blocks with reversed time ranges", () => {
    expect(manualBookingRequestSchema.safeParse({
      areaId: "11111111-1111-4111-8111-111111111111",
      startsAt: "2026-10-05T15:30:00+04:30",
      endsAt: "2026-10-05T14:00:00+04:30",
      customerName: "Walk-in customer",
      customerPhone: "",
    }).success).toBe(false);

    expect(venueBlockRequestSchema.safeParse({
      areaId: "11111111-1111-4111-8111-111111111111",
      startsAt: "2026-10-05T15:30:00+04:30",
      endsAt: "2026-10-05T14:00:00+04:30",
      reason: "Maintenance",
    }).success).toBe(false);
  });
});


describe("Phase 4 marketing contracts", () => {
  it("accepts a discounted future-slot promotion request", () => {
    expect(promotionCreateRequestSchema.safeParse({
      areaId: "11111111-1111-4111-8111-111111111111",
      startsAt: "2026-10-05T18:00:00+04:30",
      discountedPriceAfn: 1400,
      title: "Tonight discount",
      note: "Limited empty slot",
      notifyFollowers: true,
    }).success).toBe(true);
  });

  it("requires structured CTA targets when needed", () => {
    expect(venuePostCreateRequestSchema.safeParse({
      body: "Tournament registration is open.",
      ctaType: "PROMOTION",
      ctaTargetId: null,
    }).success).toBe(false);

    expect(venuePostCreateRequestSchema.safeParse({
      body: "Book tonight's discounted slot.",
      imageUrl: "https://cdn.example.com/post.jpg",
      ctaType: "PROMOTION",
      ctaTargetId: "11111111-1111-4111-8111-111111111111",
      notifyFollowers: true,
    }).success).toBe(true);
  });

  it("validates push-device registration", () => {
    expect(pushDeviceRegisterRequestSchema.safeParse({
      expoPushToken: "ExponentPushToken[abcdefghijklmnopqrstuvwxyz]",
      platform: "ANDROID",
    }).success).toBe(true);
  });
});


describe("Phase 5 team and player identity contracts", () => {
  it("accepts a public player profile update", () => {
    expect(playerProfileUpdateRequestSchema.safeParse({
      publicDisplayName: "Ahmad Rahimi",
      imageUrl: "https://cdn.example.com/player.jpg",
      position: "ALA",
      visibility: "PUBLIC",
    }).success).toBe(true);
  });

  it("accepts team creation without private contact data", () => {
    expect(teamCreateRequestSchema.safeParse({
      name: "Kabul Stars",
      city: "Kabul",
      logoUrl: "https://cdn.example.com/team.png",
      privacy: "PUBLIC",
    }).success).toBe(true);
  });

  it("validates invitation shirt numbers and roles", () => {
    expect(teamInviteRequestSchema.safeParse({
      identifier: "ahmad_7",
      role: "CAPTAIN",
      shirtNumber: 10,
    }).success).toBe(true);

    expect(teamInviteRequestSchema.safeParse({
      identifier: "ahmad_7",
      role: "MANAGER",
      shirtNumber: 101,
    }).success).toBe(false);
  });
});


describe("Phase 6 competition contracts", () => {
  it("accepts a partial competition update without requiring create-only fields", () => {
    expect(competitionUpdateRequestSchema.safeParse({
      maxTeams: 12,
    }).success).toBe(true);
  });

  it("still requires the full competition configuration on create", () => {
    expect(competitionCreateRequestSchema.safeParse({
      maxTeams: 12,
    }).success).toBe(false);
  });
});
