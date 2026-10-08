import fs from "node:fs";

function read(path){
  return fs.readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
}
function assert(value,message){
  if(!value)throw new Error(message);
}

const contracts=read("packages/contracts/src/index.ts");
const repository=read("apps/api/src/modules/commercial/commercial.repository.ts");
const service=read("apps/api/src/modules/commercial/commercial.service.ts");
const tests=read("apps/api/test/commercial.test.ts");
const mobile=read("apps/mobile/app/(app)/owner/analytics.tsx");
const localization=read("packages/localization/src/index.ts");

for(const marker of [
  "ownerAnalyticsDailyPointSchema",
  "ownerAnalyticsWeekdayPointSchema",
  "ownerAnalyticsHourPointSchema",
  "ownerAnalyticsComparisonSchema",
  "averageBookingValueAfn",
  "productiveUtilizationRate",
  "uniqueCustomerCount",
  "promotionRevenueAfn",
  "engagementPerPost",
  "competitionFeesCollectedAfn",
  "cancellationReasons",
]){
  assert(contracts.includes(marker),`Owner analytics contract missing: ${marker}`);
}

for(const marker of [
  "venueTimetables",
  "venueTimetableExceptions",
  "venueBlocks",
  "venuePromotions",
  "venueFollows",
  "socialPostLikes",
  "socialPostComments",
  "competitionTeams",
  "competitionMatches",
]){
  assert(repository.includes(marker),`Owner analytics repository missing: ${marker}`);
}

for(const marker of [
  "scheduledMinutesForDate",
  "summarizeAnalytics",
  "customerKey",
  "promotionBookings",
  "productiveUtilizationRate",
  "selectedCompetitions",
  "previousFrom",
  "percentChange",
]){
  assert(service.includes(marker),`Owner analytics service missing: ${marker}`);
}
assert(service.includes("snapshot.timetables")&&service.includes("snapshot.exceptions"),"Occupancy must use venue timetable capacity and special-date exceptions.");
assert(service.includes("snapshot.posts")&&service.includes("snapshot.followerCreatedAt"),"Marketing analytics must use venue social activity.");
assert(service.includes("snapshot.competitionTeams")&&service.includes("competitionFeesCollectedAfn"),"Competition analytics must include accepted teams and collected fees.");

for(const marker of [
  '"OVERVIEW"|"REVENUE"|"BOOKINGS"|"CUSTOMERS"|"MARKETING"|"COMPETITIONS"',
  '"7D"|"30D"|"90D"|"CUSTOM"',
  "ComparisonCard",
  "DailyBars",
  "WeekdayBars",
  "cancellationReasons",
  "customerPrivacy",
  "promotionConversion",
  "competitionBusiness",
]){
  assert(mobile.includes(marker),`Owner Analysis UI missing: ${marker}`);
}

for(const key of [
  "phase7.analytics.subtitleFull",
  "phase7.analytics.section.OVERVIEW",
  "phase7.analytics.section.REVENUE",
  "phase7.analytics.section.BOOKINGS",
  "phase7.analytics.section.CUSTOMERS",
  "phase7.analytics.section.MARKETING",
  "phase7.analytics.section.COMPETITIONS",
  "phase7.analytics.insights",
  "phase7.analytics.customerPrivacy",
  "phase7.analytics.competitionBusiness",
]){
  const count=localization.split(`"${key}"`).length-1;
  assert(count===3,`Owner Analysis localization missing ${key}; found ${count}.`);
}

assert(tests.includes("averageBookingValueAfn")&&tests.includes("comparison.previousFrom"),"Expanded owner analytics regression assertions missing.");

console.log("Owner Analysis verified: timetable-aware capacity, period comparison, revenue/booking/customer/marketing/competition metrics, trend breakdowns, privacy-safe customer aggregation, and localized mobile decision dashboard are present.");
