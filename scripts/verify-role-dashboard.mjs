import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}
function assert(value, message) {
  if (!value) throw new Error(message);
}

const dashboard = read("apps/mobile/app/(app)/dashboard.tsx");
const ownerDashboard = read("apps/mobile/src/components/owner/OwnerDashboard.tsx");
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
assert(ownerDashboard.includes("<ScrollView") && ownerDashboard.includes("horizontal"), "Venue Owner dashboard top navigation must scroll horizontally.");
assert(ownerDashboard.includes('flexWrap: "nowrap"'), "Venue Owner dashboard top navigation must stay on one line.");
assert(
  ownerDashboard.includes("borderTopWidth: 1")
    && ownerDashboard.includes("borderBottomWidth: 1")
    && ownerDashboard.includes("borderTopColor: colors.border")
    && ownerDashboard.includes("borderBottomColor: colors.border"),
  "Venue Owner dashboard navigation must have top and bottom divider lines.",
);
const ownerCompetition = ownerDashboard.indexOf('router.push("/owner/competitions")');
const ownerSchedule = ownerDashboard.indexOf('router.push("/schedule")');
const ownerPosts = ownerDashboard.indexOf('router.push("/owner/posts")');
const ownerAnalysis = ownerDashboard.indexOf('router.push("/owner/analytics")');
const ownerSettings = ownerDashboard.indexOf('router.push("/owner/onboarding")');
assert(
  ownerCompetition >= 0
    && ownerCompetition < ownerSchedule
    && ownerSchedule < ownerPosts
    && ownerPosts < ownerAnalysis
    && ownerAnalysis < ownerSettings,
  "Venue Owner dashboard navigation order must be Competitions → Venue Time Table → Media → Analysis → Venue Settings.",
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

console.log("Role dashboards verified: shared role dashboard routing plus Venue Owner horizontal quick navigation.");
