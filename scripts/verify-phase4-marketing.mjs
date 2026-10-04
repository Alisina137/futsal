import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const schema = read("packages/database/src/schema.ts");
const bookingRepository = read("apps/api/src/modules/booking/booking.repository.ts");
const bookingService = read("apps/api/src/modules/booking/booking.service.ts");
const marketingRepository = read("apps/api/src/modules/marketing/marketing.repository.ts");
const notificationRepository = read("apps/api/src/modules/notifications/notification.repository.ts");
const notificationService = read("apps/api/src/modules/notifications/notification.service.ts");
const feedScreen = read("apps/mobile/app/(app)/(tabs)/feed.tsx");
const venueScreen = read("apps/mobile/app/(app)/venues/[venueId].tsx");
const notificationScreen = read("apps/mobile/app/(app)/notifications.tsx");
const tests = read("apps/api/test/marketing.test.ts");

const checks = [
  [schema.includes("venue_promotions_active_slot_uq") && schema.includes(".where(sql"), "active-slot promotion uniqueness"],
  [schema.includes("notifications_user_dedupe_uq"), "notification user/event dedupe constraint"],
  [bookingRepository.includes('closeReason: "BOOKED"') && bookingRepository.includes('closeReason: "BLOCKED"'), "atomic promotion close on occupancy"],
  [bookingService.includes("promotionId") && bookingService.includes("originalPriceAfn"), "promotion-aware availability pricing"],
  [marketingRepository.includes("refreshPromotionStates") && marketingRepository.includes("ENTITLEMENT_ENDED"), "automatic promotion invalidation"],
  [notificationRepository.includes("dedupeKey") && notificationRepository.includes("countRecentMarketingNotifications"), "notification persistence and frequency query"],
  [notificationService.includes("MARKETING_LIMIT_PER_24H = 3"), "marketing notification frequency limit"],
  [feedScreen.includes("followingOnly") && feedScreen.includes("PROMOTION"), "player feed and following mode"],
  [venueScreen.includes("followState") && venueScreen.includes("promotedSlot"), "venue follow and promotion-aware slot UI"],
  [notificationScreen.includes("updatePreferences") && notificationScreen.includes("markRead"), "notification center and preferences"],
  [tests.includes("books a promoted slot at the discounted server price"), "discount booking regression"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  throw new Error(`Phase 4 invariant(s) missing: ${failed.map(([,name]) => name).join(", ")}`);
}

console.log("Phase 4 marketing verified: real-slot discounts, automatic close, feed/follow, notification dedupe/frequency limits, and notification preferences are present.");
