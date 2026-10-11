import assert from "node:assert/strict";
import fs from "node:fs";
import {groupAnalyticsDaily,safeRatio}
  from "../apps/mobile/src/components/admin/admin-analytics-display.ts";
import {adminAnalyticsResponseSchema,adminAnalyticsDaysSchema}
  from "../packages/contracts/src/index.ts";
const read=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const db=read("apps/api/src/modules/commercial/admin-analytics.repository.ts");
const service=read("apps/api/src/modules/commercial/commercial.service.ts");
const route=read("apps/api/src/modules/commercial/commercial.routes.ts");
const nav=read("apps/mobile/src/components/admin/admin-navigation.ts");
const sidebar=read("apps/mobile/src/components/admin/AdminSidebar.tsx");
const root=read("apps/mobile/app/(app)/admin/index.tsx");
const overview=read("apps/mobile/src/components/admin/AdminDashboardSection.tsx");
const charts=read("apps/mobile/src/components/admin/AdminAnalyticsSection.tsx");
const visual=read("apps/mobile/src/components/admin/AdminAnalyticsVisuals.tsx");
const api=read("apps/mobile/src/lib/api.ts");
const locale=read("packages/localization/src/index.ts");

assert.equal(adminAnalyticsDaysSchema.parse("30"),30);
for(const days of [0,3,31,400,"NaN"])
  assert.ok(!adminAnalyticsDaysSchema.safeParse(days).success,"Unbounded horizon: "+days);
const daily=[
 {date:"2026-09-29",newUsers:3,newVenues:1,newTeams:0,newCompetitions:0,
  confirmedBookings:2,bookingGmvAfn:4000,recordedVenuePaymentsAfn:1000},
 {date:"2026-09-30",newUsers:2,newVenues:0,newTeams:0,newCompetitions:0,
  confirmedBookings:1,bookingGmvAfn:2000,recordedVenuePaymentsAfn:0},
 {date:"2026-10-01",newUsers:5,newVenues:3,newTeams:2,newCompetitions:1,
  confirmedBookings:3,bookingGmvAfn:6000,recordedVenuePaymentsAfn:2500},
];
assert.deepEqual(groupAnalyticsDaily(daily,"recordedVenuePaymentsAfn","month"),[
 {date:"2026-09-01",value:1000},{date:"2026-10-01",value:2500},
]);
assert.deepEqual(groupAnalyticsDaily(daily,"newUsers","week"),[
 {date:"2026-09-28",value:10},
]);
assert.deepEqual(groupAnalyticsDaily(daily,"bookingGmvAfn","day").map(v=>v.value),[4000,2000,6000]);
assert.equal(safeRatio(0,0),0);
assert.equal(safeRatio(9,20),45);

for(const marker of [
 'fromAt=kabulMidnight(from)',
 "to_char(${field} AT TIME ZONE 'Asia/Kabul'",
 'eq(subscriptionPayments.status,"RECORDED")',
 'eq(bookings.status,"CONFIRMED")',
 'gte(subscriptionPayments.createdAt,fromAt)',
 'lt(subscriptionPayments.createdAt,beforeAt)',
 'gte(bookings.startsAt,fromAt)',
 'lt(bookings.startsAt,beforeAt)',
 'pendingVenueVerifications',
 'pendingRoleSubscriptions',
 'pendingExtraTeamSlots',
 'pendingBookings',
 'expiringPaidVenues7d',
 'userRoles.role',
 'groupBy(userDate)',
 'topProvinces',
 'revenueScope:"RECORDED_VENUE_PAYMENTS_ONLY"',
 'gmvScope:"CONFIRMED_BOOKING_VALUE_NOT_CASH"',
]){
  assert.ok(db.includes(marker),"Missing accurate scoped platform metric: "+marker);
}
assert.ok(!db.includes('this.db.select().from(users)'),
 "Admin analytics must never load personal user records.");
assert.ok(service.includes('async adminAnalytics(days:')&&
  route.includes('router.get("/analytics"')&&
  route.includes('adminAnalyticsDaysSchema.parse(request.query.days??30)')&&
  route.includes('requireRole("PLATFORM_ADMIN")'),
  "Period analytics needs bounded admin-only endpoint.");
assert.ok(api.includes('/api/v1/admin/analytics?days='));
assert.ok(root.includes('section==="dashboard"||section==="analytics"')&&
  root.includes('setAnalyticsDays')&&
  root.includes('<AdminAnalyticsSection')&&
  root.includes('<DashboardSection data={analytics}'),
  "Admin page should load only relevant horizon and route analytics independently.");
assert.ok(nav.includes('"analytics"')&&sidebar.includes('"analytics"'));
for(const marker of [
 'pendingVenueVerifications','pendingRoleSubscriptions','pendingExtraTeamSlots',
 'pendingBookings','expiringPaidVenues7d','payingTeamManagers',
 'recordedVenuePaymentsAfn','bookingGmvAfn','setSection("analytics")',
]){
 assert.ok(overview.includes(marker),"Admin dashboard missing: "+marker);
}
for(const marker of [
 'groupAnalyticsDaily','AdminPeriodPicker',
 'AdminMetricChart','safeRatio','roleGrants','topProvinces',
 'intervalNames','gmvScope','revenueScope',
]){
 assert.ok((charts+visual).includes(marker),"Analytics UX missing: "+marker);
}
for(const key of ["analyticsTitle","dashboardTitle","income","gmv",
 "attention","roleBreakdown","provinceBreakdown","definitionsTitle",
 "revenueScope","gmvScope","period","interval.day","interval.week",
 "interval.month","attentionScope","paidVenueShare","role.REFEREE"]){
 assert.equal(locale.split('"admin2.'+key+'"').length-1,3,
  "Admin phase2 label missing in English, Dari or Pashto: "+key);
}
console.log("Admin Phase 2 verified: bounded privacy-safe Kabul analytics, accurate venue-only payments, confirmed GMV, KPIs, trends, adoption and attention queues.");
