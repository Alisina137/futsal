import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}
function requireText(content, marker, message) {
  if (!content.includes(marker)) throw new Error(`${message}: ${marker}`);
}

const schema = read("packages/database/src/schema.ts");
const contracts = read("packages/contracts/src/index.ts");
const app = read("apps/api/src/app.ts");
const server = read("apps/api/src/server.ts");
const entitlement = read("apps/api/src/modules/billing/entitlement.ts");
const repo = read("apps/api/src/modules/commercial/commercial.repository.ts");
const service = read("apps/api/src/modules/commercial/commercial.service.ts");
const routes = read("apps/api/src/modules/commercial/commercial.routes.ts");
const ownerService = read("apps/api/src/modules/owner/owner.service.ts");
const mobileApi = read("apps/mobile/src/lib/api.ts");
const settings = read("apps/mobile/app/(app)/(tabs)/settings.tsx");
const ownerSubscription = read("apps/mobile/app/(app)/owner/subscription.tsx");
const ownerAnalytics = read("apps/mobile/app/(app)/owner/analytics.tsx");
const admin = read("apps/mobile/app/(app)/admin/index.tsx");
const localization = read("packages/localization/src/index.ts");
const journal = read("packages/database/drizzle/meta/_journal.json");
const migration = read("packages/database/drizzle/0006_phase7_commercial_core.sql");

for (const marker of [
  "venueVerificationStatusEnum",
  "subscriptionPayments",
  "platformSettings",
]) requireText(schema, marker, "Phase 7 database invariant missing");

for (const marker of [
  "ownerBillingSummarySchema",
  "ownerAnalyticsResponseSchema",
  "adminSubscriptionActivationRequestSchema",
  "adminVenueActionRequestSchema",
  "adminDashboardResponseSchema",
]) requireText(contracts, marker, "Phase 7 contract invariant missing");

for (const marker of [
  'accessMode: "CONTINUITY"',
  "canServiceExistingBookings: true",
  "canCreateBookableInventory: false",
]) requireText(entitlement, marker, "Continuity-mode invariant missing");

for (const marker of [
  "SUBSCRIPTION_ACTIVATED",
  "TRIAL_EXTENDED",
  "USER_SUSPENDED",
  "VENUE_SUSPENDED",
  "PAYMENT_VOIDED",
  "PLATFORM_SETTINGS_UPDATED",
  "SUPPORT_NOTE_ADDED",
]) requireText(repo, marker, "Admin audit invariant missing");

for (const marker of [
  "ownerBilling(",
  "requestReactivation(",
  "ownerAnalytics(",
  "duplicateVenues(",
  "activateSubscription(",
  "extendTrial(",
]) requireText(service, marker, "Commercial service invariant missing");

for (const marker of [
  'requireRole("VENUE_OWNER")',
  'requireRole("PLATFORM_ADMIN")',
  '"/subscription"',
  '"/analytics"',
  '"/venues/:venueId/subscription/activate"',
  '"/venues/:venueId/trial/extend"',
  '"/audit"',
]) requireText(routes, marker, "Phase 7 route invariant missing");

requireText(app, "createOwnerCommercialRouter", "Phase 7 app wiring missing");
requireText(app, "createAdminRouter", "Phase 7 admin wiring missing");
requireText(server, "CommercialService", "Phase 7 server wiring missing");
requireText(server, "setAccessValidator", "Immediate suspended-user access revocation missing");
requireText(ownerService, "trialDurationMs", "Configurable trial duration is not wired");

for (const marker of [
  "owner/subscription",
  "owner/analytics",
  'router.push("/admin")',
]) requireText(settings, marker, "Phase 7 navigation invariant missing");

requireText(ownerSubscription, "requestReactivation", "Owner reactivation UI missing");
requireText(ownerAnalytics, "occupancyRate", "Owner analytics UI missing");
requireText(admin, "activateSubscription", "Admin subscription activation UI missing");
requireText(admin, "extendTrial", "Admin trial extension UI missing");
requireText(admin, "venueAction", "Admin venue controls UI missing");
requireText(mobileApi, "adminApi", "Admin mobile API client missing");

for (const marker of [
  '"phase7.subscription.title"',
  '"phase7.analytics.title"',
  '"phase7.admin.title"',
]) {
  const count = localization.split(marker).length - 1;
  if (count !== 3) throw new Error(`Phase 7 localization must define ${marker} in all 3 languages; found ${count}.`);
}

requireText(journal, "0006_phase7_commercial_core", "Phase 7 migration is not registered");
requireText(migration, 'CREATE TABLE "subscription_payments"', "Phase 7 payment migration missing");
requireText(migration, 'CREATE TABLE "platform_settings"', "Phase 7 settings migration missing");

console.log("Phase 7 commercial SaaS verified: continuity enforcement, manual activation/payment history, owner analytics, platform admin controls, audit coverage, localization, and migration wiring are present.");
