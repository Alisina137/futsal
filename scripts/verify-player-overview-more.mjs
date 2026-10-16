import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const dash=read("apps/mobile/src/components/player/PlayerDashboard.tsx");
const lang=read("packages/localization/src/index.ts");
const main=dash.slice(dash.indexOf("const sections:"),dash.indexOf("const emptyPreferences:"));
const ids=[...main.matchAll(/\{id:"([a-z]+)",icon:/g)].map(x=>x[1]);
assert.deepEqual(ids,["overview","teams","activity","career","settings"]);
assert.ok(dash.includes('const activityTabs:')&&dash.includes('const careerTabs:'));
assert.ok(dash.includes('tab==="activity"?<SectionNavigation kind="activity"'));
assert.ok(dash.includes('tab==="career"?<SectionNavigation kind="career"'));
assert.ok(dash.includes('testID={"player-"+kind+"-subnavigation"}')&&
  dash.includes('useVisibleTab<T>(selected)')&&
  dash.includes('onPress={()=>{onSelect(item.id);nav.focus(item.id,true);}}'));
assert.ok(dash.includes('<PlayerActivityTabs tab={activityTab}'));
assert.ok(dash.includes('<PlayerCareerTabs tab={careerTab}'));
for(const label of ["activity","career","schedule","statistics","achievements","history",
  "competitions","matches","bookings"]){
  assert.equal(lang.split('"pd1.tab.'+label+'"').length-1,3);
}
assert.ok(dash.includes('testID="player-overview-content"'));
assert.ok(dash.includes('testID="player-dashboard-tab-content"')&&
  dash.includes('minHeight:viewportHeight'),
  "Tab selection must preserve page scroll when content becomes shorter.");
assert.ok(dash.includes('testID="player-overview-stats"'));
assert.ok(dash.includes('styles.overviewHero')&&dash.includes('styles.overviewSection'));
assert.ok(dash.includes('styles.matchBanner')&&dash.includes('data.stats.matches'));
assert.ok(dash.includes('pendingInvites.length>0')&&dash.includes('pendingRequests.length>0'));
assert.ok(dash.includes('data.activities.slice(0,3)')&&dash.includes('matches.map(match=>'));
assert.ok(dash.includes('data.whatsappGroups?.[selected.id]'));
const choose=dash.slice(dash.indexOf("const choose=(id:Section)"),dash.indexOf("useFocusEffect(useCallback",dash.indexOf("const choose=(id:Section)")));
assert.ok(!choose.includes("scrollTo({y")&&!choose.includes("router.push("));
console.log("Player Overview and five-tab nested Activity/Career navigation verified: data-backed cards, RTL-focused subtabs and intact routes.");
