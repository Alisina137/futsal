import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}
function assert(value, message) {
  if (!value) throw new Error(message);
}

const dashboard = read("apps/mobile/app/(app)/dashboard.tsx");
const ownerDashboard = read("apps/mobile/src/components/owner/OwnerDashboard.tsx");
const ownerTopNav = read("apps/mobile/src/components/owner/OwnerTopNav.tsx");
const ownerCompetition = read("apps/mobile/app/(app)/owner/competitions/index.tsx");
const ownerSchedulePage = read("apps/mobile/app/(app)/(tabs)/schedule.tsx");
const ownerMediaPage = read("apps/mobile/app/(app)/owner/posts/index.tsx");
const ownerAnalyticsPage = read("apps/mobile/app/(app)/owner/analytics.tsx");
const ownerSettingsPage = read("apps/mobile/app/(app)/owner/onboarding.tsx");
const home = read("apps/mobile/app/(app)/(tabs)/home.tsx");
const header = read("apps/mobile/src/components/ui/AppHeader.tsx");
const localization = read("packages/localization/src/index.ts");

for (const role of ["PLAYER","VENUE_OWNER","TEAM_MANAGER","REFEREE","PLATFORM_ADMIN"]) {
  assert(header.includes(role), `Dashboard hamburger eligibility missing role: ${role}`);
  assert(dashboard.includes(role), `Dashboard route does not resolve role: ${role}`);
}

assert(dashboard.includes("resolveDashboardRole"), "Role-aware dashboard resolver missing.");
assert(dashboard.includes('role === "VENUE_OWNER"') && dashboard.includes("<OwnerDashboard />"), "Venue Owner must use the existing owner dashboard.");
assert(dashboard.includes('role === "TEAM_MANAGER"'), "Team Owner dashboard shell missing.");
assert(dashboard.includes('role === "PLAYER"'), "Player dashboard shell missing.");
assert(dashboard.includes('role === "REFEREE"'), "Referee dashboard shell missing.");
assert(dashboard.includes('PLATFORM_ADMIN'), "Platform Admin dashboard shell missing.");
assert(dashboard.includes("dashboard.normalUnavailableTitle"), "Normal-user direct dashboard fallback missing.");

assert(!ownerDashboard.includes('t("owner.dashboardTitle")'), "Venue Owner dashboard must not render the dashboard title.");
assert(!ownerDashboard.includes('t("owner.dashboardSubtitle")'), "Venue Owner dashboard must not render the old dashboard subtitle.");
assert(ownerDashboard.includes("<OwnerTopNav"), "Venue Owner dashboard must render the shared top navigation.");
assert(!ownerDashboard.includes('t("home.discoveryTitle")'), "Venue Owner dashboard must not show the futsal discovery card.");
assert(!ownerDashboard.includes('t("home.discoveryBody")'), "Venue Owner dashboard must not show the discovery subtitle.");
assert(!ownerDashboard.includes('t("owner.setupStatus")'), "Venue Owner dashboard must not show the venue settings/status card.");
assert(!ownerDashboard.includes('t("competition.ownerQuickAccessBody")'), "Venue Owner dashboard must not show the competition management shortcut card.");
assert(!ownerDashboard.includes('t("ownerMarketing.marketingTitle")'), "Venue Owner dashboard must not show the marketing shortcut card.");

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
const ownerScheduleRoute = ownerTopNav.indexOf('href:"/schedule"');
const ownerPostsRoute = ownerTopNav.indexOf('href:"/owner/posts"');
const ownerAnalysisRoute = ownerTopNav.indexOf('href:"/owner/analytics"');
const ownerSettingsRoute = ownerTopNav.indexOf('href:"/owner/onboarding"');
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
  assert(source.includes("<OwnerTopNav"), `Venue Owner ${name} page must keep the shared top navigation visible.`);
}

assert(!ownerCompetition.includes('t("competition.ownerTitle")'), "Venue Owner competition page title must be removed.");
assert(!ownerCompetition.includes('t("competition.control.listSubtitle")'), "Venue Owner competition page subtitle must be removed.");
assert(
  ownerCompetition.includes('["ALL","IN_PROGRESS","REGISTRATION_OPEN","REGISTRATION_CLOSED","COMPLETED","DRAFT","SCHEDULED","ARCHIVED","CANCELLED"]'),
  "Competition filters must be ordered All → In Progress → Registration Open → Registration Closed → Completed → Draft → Scheduled → Archived → Cancelled.",
);

assert(home.includes("marketingApi.socialFeed"), "Home must remain the shared social feed.");
assert(!home.includes("OwnerDashboard"), "Venue Owner dashboard must no longer replace Home.");
assert(!header.includes('href:"/schedule"'), "Role-specific Schedule must not be in the shared hamburger.");
assert(header.includes('...(hasDashboard?['), "Dashboard must remain conditional for role users.");

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

console.log("Role dashboards verified: shared role routing plus persistent, active Venue Owner top navigation and competition filter order.");
