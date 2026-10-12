import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {availableDashboardRoles} from "../apps/mobile/src/lib/dashboard-role-options.ts";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const profile=read("apps/mobile/app/(app)/(tabs)/settings.tsx");
const options=read("apps/mobile/src/lib/dashboard-role-options.ts");
const header=read("apps/mobile/src/components/ui/AppHeader.tsx");
const dashboard=read("apps/mobile/app/(app)/dashboard.tsx");
const directPlayer=read("apps/mobile/app/(app)/dashboard/player.tsx");
assert.deepEqual(availableDashboardRoles([]),[],
  "Normal accounts (e.g., shams) must not see any dashboard mode.");
assert.deepEqual(availableDashboardRoles(["NORMAL_USER"]),[]);
assert.deepEqual(availableDashboardRoles(["PLAYER"]),["PLAYER"]);
assert.deepEqual(availableDashboardRoles(["TEAM_MANAGER"]),["TEAM_MANAGER"]);
assert.deepEqual(availableDashboardRoles(["VENUE_OWNER"]),["VENUE_OWNER"]);
assert.deepEqual(availableDashboardRoles(["REFEREE"]),["REFEREE"]);
assert.deepEqual(availableDashboardRoles(["REFEREE","PLAYER"]),["REFEREE"]);
assert.deepEqual(availableDashboardRoles(["PLATFORM_ADMIN"]),[]);
assert.deepEqual(availableDashboardRoles(["PLAYER","TEAM_MANAGER"]),
  ["PLAYER","TEAM_MANAGER"]);
assert.ok(options.includes('if(assignedRoles.includes("REFEREE"))return ["REFEREE"];'));
assert.ok(!profile.includes('t("profile.title")')&&!profile.includes('t("profile.subtitle")'),
  "Remove the profile page heading and subtitle without deleting section titles.");
assert.ok(profile.includes('const dashboardChoices=availableDashboardRoles(user?.roles??[]);')&&
  profile.includes("dashboardChoices.length>0?<>")&&
  profile.includes("dashboardChoices.map(choice=>"),
  "The complete role-dashboard section must be conditional on assigned roles.");
assert.ok(header.includes('const hasDashboard=availableDashboardRoles(user?.roles??[]).length>0;')&&
  header.includes('...(hasDashboard?['),
  "Role-based hamburger Dashboard must be hidden from normal accounts.");
assert.ok(dashboard.includes('if(preferred==="PLAYER"&&roles.includes("PLAYER"))')&&
  dashboard.includes('if(roles.includes("PLAYER"))return <PlayerDashboard/>;')&&
  dashboard.includes('<Redirect href="/home"/>'),
  "Stale local dashboard preferences cannot grant access to Player UI.");
assert.ok(directPlayer.includes('if(!roles.includes("PLAYER"))return <Redirect href="/dashboard"/>;'),
  "Deep-link directly to Player cannot grant normal accounts a dashboard.");
console.log("Normal profile/dashboard regression verified: base accounts have no player dashboard link, section or direct route; Player/Manager/Owner/Referee paths stay gated.");
