import { describe, expect, it } from "vitest";
import { evaluateVenueEntitlement, hasPremiumWriteAccess } from "../src/modules/billing/entitlement.js";

const now = new Date("2026-10-05T00:00:00.000Z");

describe("Phase 7 subscription entitlement", () => {
  it("grants full access to a live trial", () => {
    const entitlement = evaluateVenueEntitlement({
      status: "TRIAL",
      trialEndsAt: new Date("2026-10-05T00:00:01.000Z"),
      activeUntil: null,
    }, now);

    expect(entitlement).toEqual({
      state: "TRIAL",
      accessMode: "FULL",
      canCreateBookableInventory: true,
      canServiceExistingBookings: true,
    });
  });

  it("moves an expired trial into continuity mode", () => {
    const subscription = {
      status: "TRIAL" as const,
      trialEndsAt: new Date("2026-10-04T23:59:59.000Z"),
      activeUntil: null,
    };

    expect(evaluateVenueEntitlement(subscription, now)).toEqual({
      state: "EXPIRED",
      accessMode: "CONTINUITY",
      canCreateBookableInventory: false,
      canServiceExistingBookings: true,
    });
    expect(hasPremiumWriteAccess(subscription, now)).toBe(false);
  });

  it("expires a paid subscription by its server timestamp", () => {
    const entitlement = evaluateVenueEntitlement({
      status: "ACTIVE",
      trialEndsAt: null,
      activeUntil: new Date("2026-10-04T23:59:59.000Z"),
    }, now);

    expect(entitlement.state).toBe("EXPIRED");
    expect(entitlement.accessMode).toBe("CONTINUITY");
  });

  it("keeps a paid subscription active when it has no end timestamp", () => {
    expect(hasPremiumWriteAccess({
      status: "ACTIVE",
      trialEndsAt: null,
      activeUntil: null,
    }, now)).toBe(true);
  });

  it("uses NONE before any entitlement has started", () => {
    expect(evaluateVenueEntitlement(null, now)).toEqual({
      state: "NOT_STARTED",
      accessMode: "NONE",
      canCreateBookableInventory: false,
      canServiceExistingBookings: false,
    });
  });
});
