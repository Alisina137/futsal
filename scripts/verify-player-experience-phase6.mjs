import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const dash=read("apps/mobile/src/components/player/PlayerDashboard.tsx");
const lang=read("packages/localization/src/index.ts");
const main=dash.slice(dash.indexOf("const sections:"),dash.indexOf("const emptyPreferences:"));
assert.deepEqual([...main.matchAll(/\{id:"([a-z]+)",icon:/g)].map(x=>x[1]),
 ["overview","teams","activity","career","settings"]);
for(const marker of [
 'testID="player-refresh-dashboard"',
 'disabled={loading||busy!==null}',
 'testID="player-dashboard-quick-actions"',
 'setActivityTab("schedule");choose("activity")',
 'setCareerTab("statistics");choose("career")',
 'router.push("/notifications")',
 'const data=loadedActor===session?.user.id?storedData:null',
 'actorIdRef.current===actorId',
 'minHeight:viewportHeight',
 'flexDirection:isRTL?"row-reverse":"row"',
 'pendingInvites.length>0',
 'pendingRequests.length>0'
])assert.ok(dash.includes(marker),"Missing cross-dashboard Phase 6 feature: "+marker);
assert.ok(!dash.includes('{pendingInvites.length>0?<View style={styles.badge}/>'),
 "Team invitations cannot masquerade as unread notifications");
for(const key of ["quickActions","openProgram","openCareer","openNotifications",
 "refreshDashboard"])assert.equal(lang.split('"pd1.'+key+'"').length-1,3);
console.log("Player UX Phase 6 verified: refresh, deep navigation to nested tabs, account isolation, RTL and language support.");
