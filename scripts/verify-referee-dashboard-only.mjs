import assert from "node:assert/strict";
import fs from "node:fs";
import {availableDashboardRoles} from "../apps/mobile/src/lib/dashboard-role-options.ts";

const read=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const profile=read("apps/mobile/app/(app)/(tabs)/settings.tsx");
const dashboard=read("apps/mobile/app/(app)/dashboard.tsx");
const playerRoute=read("apps/mobile/app/(app)/dashboard/player.tsx");
const refereeRoute=read("apps/mobile/app/(app)/dashboard/referee.tsx");

assert.deepEqual(availableDashboardRoles(["REFEREE"]),["REFEREE"]);
assert.deepEqual(availableDashboardRoles(["REFEREE","PLAYER"]),["REFEREE"]);
assert.deepEqual(availableDashboardRoles(["PLAYER","REFEREE","VENUE_OWNER","TEAM_MANAGER"]),["REFEREE"]);
assert.deepEqual(availableDashboardRoles([]),[]);
assert.deepEqual(availableDashboardRoles(["PLAYER"]),["PLAYER"]);
assert.deepEqual(availableDashboardRoles(["TEAM_MANAGER"]),["TEAM_MANAGER"]);
assert.deepEqual(availableDashboardRoles(["VENUE_OWNER"]),["VENUE_OWNER"]);
assert.deepEqual(availableDashboardRoles(["TEAM_MANAGER","VENUE_OWNER"]),
  ["TEAM_MANAGER","VENUE_OWNER"]);
assert.deepEqual(availableDashboardRoles(["PLAYER","TEAM_MANAGER"]),
  ["PLAYER","TEAM_MANAGER"]);
assert.deepEqual(availableDashboardRoles(["PLATFORM_ADMIN"]),[]);

assert.ok(profile.includes("const dashboardChoices=availableDashboardRoles(user?.roles??[]);")&&
  profile.includes("dashboardChoices.length>0?<>")&&
  profile.includes("dashboardChoices.map(choice=>"),
  "Profile must hide the entire Dashboard Role section from base normal users.");
assert.ok(profile.includes('setDashboardRole(user.id,choice)'),
  "Persisted role selection must only use one of the visible allowed options.");
assert.ok(!profile.includes('([{key:"PLAYER"'),
  "Player must not be hardcoded into every signed-in user's dashboard role choices.");

const admin=dashboard.indexOf('if(roles.includes("PLATFORM_ADMIN"))');
const referee=dashboard.indexOf('if(roles.includes("REFEREE"))return <RefereeDashboard/>;');
const player=dashboard.indexOf('if(preferred==="PLAYER"&&roles.includes("PLAYER"))return <PlayerDashboard/>;');
assert.ok(admin>=0&&referee>admin&&player>referee,
  "Dashboard must honor admin then referee eligibility BEFORE stale Player preference.");
assert.ok(playerRoute.includes('roles.includes("REFEREE")')&&
  playerRoute.includes('<Redirect href="/dashboard/referee"/>')&&
  playerRoute.includes('if(!roles.includes("PLAYER"))return <Redirect href="/dashboard"/>;'),
  "Legacy direct Player URL must not bypass exclusive referee dashboard.");
assert.ok(refereeRoute.includes('roles.includes("REFEREE")'),
  "Direct Referee URL must retain role authorization.");

console.log("Role dashboard eligibility verified: normal users see no dashboard; assigned Player/Manager/Owner roles required, Referee exclusive, cached preference/direct URL guarded.");
