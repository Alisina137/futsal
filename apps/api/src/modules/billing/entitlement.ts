export type EntitlementSubscription = {
  status: "TRIAL" | "ACTIVE" | "EXPIRED" | "CANCELLED";
  trialEndsAt: Date | null;
  activeUntil: Date | null;
};

export type VenueEntitlementState =
  | "NOT_STARTED"
  | "TRIAL"
  | "ACTIVE"
  | "EXPIRED"
  | "CANCELLED";

export type VenueSubscriptionAccessMode = "NONE" | "FULL" | "CONTINUITY";

export type VenueEntitlement = {
  state: VenueEntitlementState;
  accessMode: VenueSubscriptionAccessMode;
  canCreateBookableInventory: boolean;
  canServiceExistingBookings: boolean;
};

export function evaluateVenueEntitlement(
  subscription: EntitlementSubscription | null | undefined,
  now: Date,
): VenueEntitlement {
  if (!subscription) {
    return {
      state: "NOT_STARTED",
      accessMode: "NONE",
      canCreateBookableInventory: false,
      canServiceExistingBookings: false,
    };
  }

  if (subscription.status === "TRIAL") {
    const active = Boolean(
      subscription.trialEndsAt &&
      subscription.trialEndsAt.getTime() > now.getTime(),
    );
    return active
      ? {
          state: "TRIAL",
          accessMode: "FULL",
          canCreateBookableInventory: true,
          canServiceExistingBookings: true,
        }
      : {
          state: "EXPIRED",
          accessMode: "CONTINUITY",
          canCreateBookableInventory: false,
          canServiceExistingBookings: true,
        };
  }

  if (subscription.status === "ACTIVE") {
    const active =
      !subscription.activeUntil ||
      subscription.activeUntil.getTime() > now.getTime();
    return active
      ? {
          state: "ACTIVE",
          accessMode: "FULL",
          canCreateBookableInventory: true,
          canServiceExistingBookings: true,
        }
      : {
          state: "EXPIRED",
          accessMode: "CONTINUITY",
          canCreateBookableInventory: false,
          canServiceExistingBookings: true,
        };
  }

  return {
    state: subscription.status,
    accessMode: "CONTINUITY",
    canCreateBookableInventory: false,
    canServiceExistingBookings: true,
  };
}

export function hasPremiumWriteAccess(
  subscription: EntitlementSubscription | null | undefined,
  now: Date,
): boolean {
  return evaluateVenueEntitlement(subscription, now).canCreateBookableInventory;
}
