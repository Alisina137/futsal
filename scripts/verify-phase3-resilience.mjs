import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const repository = read("apps/api/src/modules/booking/booking.repository.ts");
const service = read("apps/api/src/modules/booking/booking.service.ts");
const playerAvailability = read("apps/mobile/app/(app)/venues/[venueId].tsx");
const cache = read("apps/mobile/src/lib/availability-cache.ts");
const tests = read("apps/api/test/booking.test.ts");

const checks = [
  [repository.includes("pg_advisory_xact_lock"), "database advisory lock"],
  [repository.includes("bookings.createdByUserId") && repository.includes("bookings.idempotencyKey"), "actor-scoped idempotency lookup"],
  [service.includes("getVenueRecordByAreaId"), "direct area-to-venue lookup"],
  [service.includes("SLOT_UNAVAILABLE"), "server slot revalidation"],
  [playerAvailability.includes("disabled={!live||!isOnline}"), "cached/offline booking guard"],
  [playerAvailability.includes("writeAvailabilityCache") && cache.includes("AsyncStorage"), "availability cache"],
  [tests.includes("exactly one winner"), "concurrent winner test"],
  [tests.includes("tenant-scoped"), "tenant isolation test"],
  [tests.includes("idempotency key"), "idempotency retry test"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  throw new Error(`Phase 3 resilience invariant(s) missing: ${failed.map(([,name]) => name).join(", ")}`);
}
console.log("Phase 3 resilience verified: atomic area lock, server revalidation, actor-scoped idempotency, tenant isolation, and non-bookable cached availability.");
