import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}
function assert(value, message) {
  if (!value) throw new Error(message);
}

const dashboard = read("apps/mobile/app/(app)/dashboard.tsx");
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

assert(home.includes("marketingApi.socialFeed"), "Home must remain the shared social feed.");
assert(!home.includes("OwnerDashboard"), "Venue Owner dashboard must no longer replace Home.");
assert(!header.includes('href:"/schedule"'), "Role-specific Schedule must not be in the shared hamburger.");
assert(header.includes('...(hasDashboard?['), "Dashboard must remain conditional for role users.");

assert((localization.match(/"dashboard\.title"/g) ?? []).length === 3, "Dashboard title must exist in all three languages.");
assert((localization.match(/"dashboard\.teamOwnerTitle"/g) ?? []).length === 3, "Team Owner dashboard copy missing in one or more languages.");
assert((localization.match(/"dashboard\.playerTitle"/g) ?? []).length === 3, "Player dashboard copy missing in one or more languages.");
assert((localization.match(/"dashboard\.refereeTitle"/g) ?? []).length === 3, "Referee dashboard copy missing in one or more languages.");
assert((localization.match(/"dashboard\.adminTitle"/g) ?? []).length === 3, "Admin dashboard copy missing in one or more languages.");

console.log("Role dashboards verified: Normal User has no menu Dashboard; five role types share /dashboard with role-aware content.");
