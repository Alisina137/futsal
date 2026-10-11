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
assert.deepEqual(availableDashboardRoles([]),["PLAYER"]);
assert.deepEqual(availableDashboardRoles(["PLAYER"]),["PLAYER"]);
assert.deepEqual(availableDashboardRoles(["TEAM_MANAGER"]),["PLAYER","TEAM_MANAGER"]);
assert.deepEqual(availableDashboardRoles(["VENUE_OWNER"]),["PLAYER","VENUE_OWNER"]);
assert.deepEqual(availableDashboardRoles(["TEAM_MANAGER","VENUE_OWNER"]),
  ["PLAYER","TEAM_MANAGER","VENUE_OWNER"]);

assert.ok(profile.includes("availableDashboardRoles(user?.roles??[]).map(choice=>"),
  "Profile dashboard choices must derive from role eligibility, not always show Player.");
assert.ok(profile.includes('setDashboardRole(user.id,choice)'),
  "Persisted role selection must only use one of the visible allowed options.");
assert.ok(!profile.includes('([{key:"PLAYER"'),
  "Player must not be hardcoded into every signed-in user's dashboard role choices.");

const admin=dashboard.indexOf('if(roles.includes("PLATFORM_ADMIN"))');
const referee=dashboard.indexOf('if(roles.includes("REFEREE"))return <RefereeDashboard/>;');
const player=dashboard.indexOf('if(preferred==="PLAYER")return <PlayerDashboard/>;');
assert.ok(admin>=0&&referee>admin&&player>referee,
  "Dashboard must honor admin then referee eligibility BEFORE stale Player preference.");
assert.ok(playerRoute.includes('roles.includes("REFEREE")')&&
  playerRoute.includes('<Redirect href="/dashboard/referee"/>'),
  "Legacy direct Player URL must not bypass exclusive referee dashboard.");
assert.ok(refereeRoute.includes('roles.includes("REFEREE")'),
  "Direct Referee URL must retain role authorization.");

console.log("Referee-only dashboard verified: profile shows only Referee, cached Player preference ignored, direct Player route guarded; non-referee choices preserved.");
