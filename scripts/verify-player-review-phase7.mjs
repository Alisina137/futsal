import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const dash=read("apps/mobile/src/components/player/PlayerDashboard.tsx");
const activity=read("apps/mobile/src/components/player/PlayerActivityTabs.tsx");
const career=read("apps/mobile/src/components/player/PlayerCareerTabs.tsx");
const pkg=JSON.parse(read("package.json"));
for(const marker of ['setTab("overview")','const stillCurrent=()=>actorIdRef.current===actorId',
  'if(!stillCurrent())return','if(stillCurrent())setError(',
  'finally{if(stillCurrent())setBusy(null);}',
  'const data=loadedActor===session?.user.id?storedData:null'])
  assert.ok(dash.includes(marker),"Missing Player Dashboard Phase 7 guard: "+marker);
for(const marker of ['const activeTokenRef=useRef(token)',
  'setConfirmCancel(null);setTeamFilter("ALL")',
  'setBookingFilter("UPCOMING");setView("WEEK")',
  'const stillCurrent=()=>activeTokenRef.current===requestToken',
  'if(!stillCurrent())return','if(stillCurrent())setBusy(null)',
  'activityActor===token?storedData:null',
  'bookingActor===token?storedBookings:[]'])
  assert.ok(activity.includes(marker),"Missing Player Activity Phase 7 guard: "+marker);
for(const marker of ['const activeTokenRef=useRef(token)',
  'setTeamId("ALL");setCompetitionId("ALL");setSeason("ALL")',
  'setMetric("goals");setAchievementType("ALL");setHistoryResult("ALL")',
  'if(activeTokenRef.current===requestToken)setError(',
  'const data=loadedToken===token?storedData:null'])
  assert.ok(career.includes(marker),"Missing Player Career Phase 7 guard: "+marker);
assert.match(pkg.scripts["verify:player-review-phase7"],/verify-player-review-phase7\.mjs/);
assert.match(pkg.scripts.verify,/verify:player-review-phase7/);
console.log("Player Phase 7 static regression checks passed: account isolation, async actions, navigation and filter reset.");
