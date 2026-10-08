import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}
function assert(value, message) {
  if (!value) throw new Error(message);
}

const screen = read("apps/mobile/app/(app)/role-subscriptions/[role].tsx");
const formatter = read("apps/mobile/src/lib/date-time.ts");
const locale = read("packages/localization/src/index.ts");
const dashboard = read("apps/mobile/app/(app)/dashboard.tsx");

assert(screen.includes('const { t, isRTL, language } = useLocale()'), "Subscription screen must use selected language");
assert(screen.includes("formatLocalDateTimeParts(offer.activeUntil, language)"), "Expiry must use the shared local date/time formatter");
assert(screen.includes("Number.isFinite(Date.parse(offer.activeUntil))"), "Invalid expiry must not be shown as a raw value");
assert(screen.includes("{validUntil.date}") && screen.includes("{validUntil.time}"), "Expiry date and time must be separately readable");
assert(!screen.includes("{offer.activeUntil}</AppText>"), "Expiry must never display a raw ISO timestamp");
assert(screen.includes('active || offer?.status === "EXPIRED"'), "Current and expired subscriptions should use appropriate deadline labels");
assert(screen.includes('router.replace(role === "VENUE_OWNER" ? "/owner/competitions" : "/teams")'), "Open venue tools must navigate directly to the owner dashboard, without breaking team tools");
assert(dashboard.includes('<Redirect href="/owner/competitions" />'), "Owner dashboard entry route must point to Competitions");
assert(formatter.includes('AFGHANISTAN_TIME_ZONE = "Asia/Kabul"') && formatter.includes('timeZone,'),
  "The formatter must use Afghanistan time for date and time");

const sample = new Date("2026-10-04T06:18:00.000Z");
const kabul = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kabul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(sample);
assert(kabul === "10:48", `Kabul timestamp conversion failed: ${kabul}`);

for (const key of ["roles.accessEndsAt", "roles.accessEndedAt", "roles.accessEndsHint", "roles.accessEndedHint"]) {
  const matches = locale.split(`"${key}"`).length - 1;
  assert(matches === 3, `${key} missing localization in English, Dari, or Pashto (found ${matches})`);
}
console.log("Paid role subscription UX verified: Kabul-local deadline, explanatory labels, and direct venue dashboard navigation.");
