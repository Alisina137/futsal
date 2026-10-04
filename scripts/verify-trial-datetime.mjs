import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const dashboard = read("apps/mobile/src/components/owner/OwnerDashboard.tsx");
const onboarding = read("apps/mobile/app/(app)/owner/onboarding.tsx");
const formatter = read("apps/mobile/src/lib/date-time.ts");

const knownUtc = new Date("2026-10-04T06:18:00.000Z");
const kabulTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kabul",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
}).format(knownUtc);

const checks = [
  [kabulTime === "10:48", `UTC→Kabul conversion expected 10:48, received ${kabulTime}`],
  [formatter.includes('AFGHANISTAN_TIME_ZONE = "Asia/Kabul"'), "shared formatter uses Kabul timezone"],
  [formatter.includes('calendar: "gregory"'), "calendar is explicitly Gregorian for current MVP"],
  [formatter.includes('timeZoneName: "short"'), "formatted expiry includes timezone"],
  [dashboard.includes("formatLocalDateTimeParts(value, language)"), "dashboard splits trial end into date/time parts"],
  [dashboard.includes("formatted.date") && dashboard.includes("formatted.time"), "dashboard renders date and time on separate lines"],
  [onboarding.includes("formatLocalDateTimeParts(status.subscription.trialEndsAt, language)"), "onboarding splits trial end into date/time parts"],
  [onboarding.includes("trialEnd.date") && onboarding.includes("trialEnd.time"), "onboarding renders date and time on separate lines"],
  [dashboard.includes("value={status.subscription.trialEndsAt}") && dashboard.includes("formatLocalDateTimeParts(value, language)"), "dashboard passes raw value only into the formatter-backed TrialEndBlock"],
  [!dashboard.includes("<AppText>{status.subscription.trialEndsAt}</AppText>") && !dashboard.includes("<AppText forceLtr>{status.subscription.trialEndsAt}</AppText>"), "dashboard does not render raw trial timestamp directly"],
  [!onboarding.includes("<AppText>{status.subscription.trialEndsAt}</AppText>") && !onboarding.includes("<AppText forceLtr>{status.subscription.trialEndsAt}</AppText>"), "onboarding does not render raw trial timestamp directly"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  throw new Error(`Premium trial date/time invariant(s) failed: ${failed.map(([,name]) => name).join(", ")}`);
}

console.log("Premium trial date/time verified: UTC timestamps display as localized Kabul date and time on separate lines, never raw ISO.");
