import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const hook=read("apps/mobile/src/hooks/useFocusedTabScroll.ts");

// Exercise the real alignment math without needing to mount native ScrollView.
const start=hook.indexOf("export function tabFocusOffset(");
const end=hook.indexOf("export function useFocusedTabScroll",start);
assert.ok(start>=0&&end>start,"Navigation must export tested selected-tab offset math.");
const exported=hook.slice(start,end);
const compiled=ts.transpileModule(exported,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
const scope={exports:{},Math};
vm.runInNewContext(compiled,scope);
const offset=scope.exports.tabFocusOffset;
assert.equal(offset({x:250,width:100},200,700),200,"Center selected middle tab.");
assert.equal(offset({x:0,width:95},300,950),0,"First tab starts visible.");
assert.equal(offset({x:870,width:90},250,960),710,"Last tab fully visible.");
assert.equal(offset({x:870,width:90},250,960),710,"RTL physical rightmost default is visible.");
assert.equal(offset({x:40,width:85},300,250),0,"No unnecessary movement when all tabs fit.");
assert.equal(offset({x:200,width:65},400,1000),32.5,"Keep selected tab centered.");
assert.equal(offset(undefined,320,800),null,"Do not scroll until tab is measured.");
assert.equal(offset({x:500,width:0},320,800),null,"Skip invalid layout.");
assert.equal(offset({x:500,width:80},0,800),null,"Wait for viewport measurement.");
assert.ok(hook.includes("requestAnimationFrame(()=>focus(selectedKey,false))"),
  "Initial/changed selected tab must auto-focus.");
assert.ok(hook.includes("onContentSizeChange"),"Delayed/RTL content measuring must refocus active tab.");

const focused=[
  ["apps/mobile/app/(app)/venues/[venueId].tsx",["mainRail","subRail","key={main}"]],
  ["apps/mobile/src/components/social/TeamDetailExperience.tsx",["mainRail","subRail","key={tab}"]],
  ["apps/mobile/src/components/referee/RefereeDashboard.tsx",["subRail","key={main}"]],
  ["apps/mobile/src/components/competition/CompetitionMatchList.tsx",["filterRail","match-filter-rail"]],
  ["apps/mobile/app/(app)/owner/competitions/index.tsx",["rail","setFilter(value)"]],
  ["apps/mobile/app/(app)/owner/analytics.tsx",["rangeRail","sectionRail"]],
  ["apps/mobile/src/components/player/PlayerDashboard.tsx",["optionRail"]],
  ["apps/mobile/src/components/player/PlayerActivityTabs.tsx",["optionRail"]],
  ["apps/mobile/src/components/player/PlayerCareerTabs.tsx",["optionRail"]],
  ["apps/mobile/src/components/team-manager/TeamManagerDashboard.tsx",["optionRail"]],
  ["apps/mobile/src/components/team-manager/TeamCompetitionOps.tsx",["optionRail"]],
];
for(const [path,markers] of focused){
  const source=read(path);
  assert.ok(source.includes("useFocusedTabScroll("),"Missing focus hook: "+path);
  for(const marker of markers)assert.ok(source.includes(marker),"Missing "+marker+" in "+path);
  assert.ok(source.includes(".onTabLayout("),"Tabs must report actual layout: "+path);
  assert.ok(source.includes(".onContentSizeChange"),
    "Tab focus must work after dynamic text layout: "+path);
}
const venue=read("apps/mobile/app/(app)/venues/[venueId].tsx");
assert.ok(venue.includes('bookingDeepLink?"reserve":"media"'),
  "Deep linked reservations must override first-tab default.");
assert.ok(venue.includes('media:"posts",reserve:"slots"'),
  "Venue main/subtab defaults should be their first items.");
const team=read("apps/mobile/src/components/social/TeamDetailExperience.tsx");
assert.ok(team.includes('useState<Tab>("media")')&&team.includes('media:"posts"'),
  "Team detail should focus first main/subtab.");
assert.ok(!team.includes("Math.max(0,index-1)*90"),"Do not guess tab width from index.");
const match=read("apps/mobile/src/components/competition/CompetitionMatchList.tsx");
assert.ok(match.includes('const FILTERS:MatchFilter[]=["ALL","UPCOMING","LIVE","FINISHED"]')&&
  match.includes('initialFilter="ALL"'),"Match filters default to first unless explicitly deep linked.");
for(const [file,first] of [
  ["apps/mobile/src/components/player/PlayerDashboard.tsx",'useState<Section>("overview")'],
  ["apps/mobile/src/components/team-manager/TeamManagerDashboard.tsx",'useState<Section>("overview")'],
  ["apps/mobile/src/components/referee/RefereeDashboard.tsx",'useState<Main>("overview")'],
]){
  assert.ok(read(file).includes(first),"Main navigation must default to first tab: "+file);
}
const admin=read("apps/mobile/src/components/admin/AdminSidebar.tsx");
assert.ok(admin.includes("selectedGroup")&&admin.includes("focusSelected")&&
  admin.includes("setCollapsed(previous=>previous.includes(selectedGroup)"),
  "Admin navigation must expand and scroll to its active entry.");
const owner=read("apps/mobile/src/components/owner/OwnerTopNav.tsx");
assert.ok(owner.includes("activeSection(pathname)??items[0]!.key"),
  "Owner top nav should default to first tab on unmapped routes.");
const publicNav=read("apps/mobile/src/components/ui/PublicTopNavigation.tsx");
assert.ok(publicNav.includes("??items[0]!.key"),
  "Main navigation must focus first visible tab when route is not selected.");
console.log("Navigation focus verified: measured/clamped offset; first/default, dynamic/RTL/deep links, owner, venue, team, referee, player, competitions, admin.");
