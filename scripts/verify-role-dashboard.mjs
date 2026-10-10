import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}
function assert(value, message) {
  if (!value) throw new Error(message);
}

const dashboard = read("apps/mobile/app/(app)/dashboard.tsx");
const ownerTopNav = read("apps/mobile/src/components/owner/OwnerTopNav.tsx");
const ownerLayout = read("apps/mobile/app/(app)/owner/_layout.tsx");
const ownerCompetition = read("apps/mobile/app/(app)/owner/competitions/index.tsx");
const ownerSchedulePage = read("apps/mobile/app/(app)/owner/schedule.tsx");
const legacySchedulePage = read("apps/mobile/app/(app)/(tabs)/schedule.tsx");
const ownerMediaPage = read("apps/mobile/app/(app)/owner/posts/index.tsx");
const ownerAnalyticsPage = read("apps/mobile/app/(app)/owner/analytics.tsx");
const ownerSettingsPage = read("apps/mobile/app/(app)/owner/settings.tsx");
const home = read("apps/mobile/app/(app)/(tabs)/home.tsx");
const header = read("apps/mobile/src/components/ui/AppHeader.tsx");
const localization = read("packages/localization/src/index.ts");
const rootLayout = read("apps/mobile/app/_layout.tsx");
const protectedLayout = read("apps/mobile/app/(app)/_layout.tsx");
const authLayout = read("apps/mobile/app/(auth)/_layout.tsx");
const tabsLayout = read("apps/mobile/app/(app)/(tabs)/_layout.tsx");
const screen = read("apps/mobile/src/components/ui/Screen.tsx");

for (const role of ["PLAYER","VENUE_OWNER","TEAM_MANAGER","REFEREE"]) {
  assert(dashboard.includes(role), `Dashboard route does not support role: ${role}`);
}
assert(header.includes("isPlatformAdmin")&&header.includes('href:"/admin"'),
  "Platform Admin must have its own navigation.");
assert(header.includes('href:"/dashboard/player"')&&header.includes("const hasDashboard=true;"),
  "All normal and paid-role accounts must be able to reach their free Player Dashboard.");
assert(dashboard.includes("roles.includes"),"Role-aware dashboard resolver missing.");
assert(dashboard.includes('roles.includes("VENUE_OWNER")')&&dashboard.includes('<Redirect href="/owner/competitions"/>'),
  "Venue Owner dashboard must enter the persistent owner shell at Competitions.");
assert(dashboard.includes('roles.includes("TEAM_MANAGER")'),"Team Owner dashboard shell missing.");
assert(dashboard.includes('return <PlayerDashboard/>'),"Player dashboard shell missing for normal users.");
assert(dashboard.includes('roles.includes("REFEREE")'),"Referee dashboard shell missing.");
assert(dashboard.includes("PLATFORM_ADMIN"),"Platform Admin dashboard shell missing.");
assert(dashboard.includes('"/dashboard/player"'),"Normal-user direct player dashboard must be reachable.");

assert(ownerLayout.includes("<AppHeader/>"), "Venue Owner shell must render the app header once.");
assert(ownerLayout.includes("<OwnerTopNav/>"), "Venue Owner shell must render the owner navigation once.");
assert(ownerLayout.includes("<Slot/>"), "Venue Owner shell must render only the active child content below the persistent chrome.");
assert(screen.includes("embedded?: boolean"), "Screen must support embedded owner content without another safe-area/header shell.");

assert(ownerTopNav.includes("<ScrollView") && ownerTopNav.includes("horizontal"), "Venue Owner top navigation must scroll horizontally.");
assert(ownerTopNav.includes('flexWrap:"nowrap"'), "Venue Owner top navigation must stay on one line.");
assert(
  ownerTopNav.includes("borderTopWidth:1")
    && ownerTopNav.includes("borderBottomWidth:1")
    && ownerTopNav.includes("borderTopColor:colors.border")
    && ownerTopNav.includes("borderBottomColor:colors.border"),
  "Venue Owner navigation must keep top and bottom divider lines.",
);
assert(ownerTopNav.includes("usePathname"), "Venue Owner navigation must derive the current section from the route.");
assert(ownerTopNav.includes('pathname==="/dashboard"||pathname.startsWith("/owner/competitions")'), "Venue Owner dashboard must focus the Competitions tab by default.");
assert(ownerTopNav.includes("itemActive") && ownerTopNav.includes("accessibilityState={{selected}}"), "Venue Owner navigation must visibly and accessibly highlight the active tab.");
assert(ownerTopNav.includes("router.replace(item.href)"), "Venue Owner navigation must switch sections as tab-like navigation.");
assert(ownerTopNav.includes("focusActive") && ownerTopNav.includes("scrollTo({x,y:0,animated})"), "Venue Owner navigation must keep the active tab scrolled into view after route changes.");
assert(ownerTopNav.includes("onContentSizeChange") && ownerTopNav.includes("handleItemLayout"), "Venue Owner navigation must measure its scroll content and tabs before restoring active-tab focus.");

const ownerCompetitionRoute = ownerTopNav.indexOf('href:"/owner/competitions"');
const ownerScheduleRoute = ownerTopNav.indexOf('href:"/owner/schedule"');
const ownerPostsRoute = ownerTopNav.indexOf('href:"/owner/posts"');
const ownerAnalysisRoute = ownerTopNav.indexOf('href:"/owner/analytics"');
const ownerSettingsRoute = ownerTopNav.indexOf('href:"/owner/settings"');
assert(
  ownerCompetitionRoute >= 0
    && ownerCompetitionRoute < ownerScheduleRoute
    && ownerScheduleRoute < ownerPostsRoute
    && ownerPostsRoute < ownerAnalysisRoute
    && ownerAnalysisRoute < ownerSettingsRoute,
  "Venue Owner navigation order must be Competitions → Venue Time Table → Media → Analysis → Venue Settings.",
);

for (const [name, source] of [
  ["Competitions", ownerCompetition],
  ["Venue Time Table", ownerSchedulePage],
  ["Media", ownerMediaPage],
  ["Analysis", ownerAnalyticsPage],
  ["Venue Settings", ownerSettingsPage],
]) {
  assert(source.includes("<Screen embedded>"), `Venue Owner ${name} page must render only embedded content.`);
  assert(!source.includes("OwnerTopNav"), `Venue Owner ${name} page must not remount the shared owner navigation.`);
  assert(!source.includes("showHeader"), `Venue Owner ${name} page must not remount the global app header.`);
}
assert(legacySchedulePage.includes('<Redirect href="/owner/schedule"/>'), "Legacy schedule route must redirect into the persistent owner shell.");

assert(!ownerCompetition.includes('t("competition.ownerTitle")'), "Venue Owner competition page title must be removed.");
assert(!ownerCompetition.includes('t("competition.control.listSubtitle")'), "Venue Owner competition page subtitle must be removed.");
assert(rootLayout.includes('animation:"none"'), "Root navigation must disable full-page slide transitions.");
assert(protectedLayout.includes('animation: "none"'), "Protected app navigation must disable full-page slide transitions.");
assert(authLayout.includes('animation: "none"'), "Auth navigation must disable full-page slide transitions.");
assert(tabsLayout.includes('animation:"none"'), "Hidden tab navigation must disable page transition animation.");
assert(
  ownerCompetition.includes('["ALL","IN_PROGRESS","REGISTRATION_OPEN","REGISTRATION_CLOSED","COMPLETED","DRAFT","SCHEDULED","ARCHIVED","CANCELLED"]'),
  "Competition filters must be ordered All → In Progress → Registration Open → Registration Closed → Completed → Draft → Scheduled → Archived → Cancelled.",
);

assert(home.includes("marketingApi.socialFeed"), "Home must remain the shared social feed.");
assert(!home.includes("OwnerDashboard"), "Venue Owner dashboard must no longer replace Home.");
assert(!header.includes('href:"/schedule"'), "Role-specific Schedule must not be in the shared hamburger.");
assert(header.includes('...(hasDashboard?[')&&header.includes("const hasDashboard=true;"),
  "Shared dashboard navigation must include normal accounts as well as paid roles.");

assert((localization.match(/"dashboard\.title"/g) ?? []).length === 3, "Dashboard title must exist in all three languages.");
assert((localization.match(/"dashboard\.teamOwnerTitle"/g) ?? []).length === 3, "Team Owner dashboard copy missing in one or more languages.");
assert((localization.match(/"dashboard\.playerTitle"/g) ?? []).length === 3, "Player dashboard copy missing in one or more languages.");
assert((localization.match(/"dashboard\.refereeTitle"/g) ?? []).length === 3, "Referee dashboard copy missing in one or more languages.");
assert((localization.match(/"dashboard\.adminTitle"/g) ?? []).length === 3, "Admin dashboard copy missing in one or more languages.");

for (const key of [
  "owner.dashboardNav.competitions",
  "owner.dashboardNav.schedule",
  "owner.dashboardNav.posts",
  "owner.dashboardNav.analysis",
  "owner.dashboardNav.settings",
]) {
  const count = localization.split(`"${key}"`).length - 1;
  assert(count === 3, `Venue Owner dashboard navigation localization missing for ${key}; found ${count}.`);
}

console.log("Role dashboards verified: persistent Venue Owner shell, embedded content-only tab changes, no slide transitions, and competition filter order.");
