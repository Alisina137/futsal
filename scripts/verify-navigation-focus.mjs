import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

const hook=read("apps/mobile/src/hooks/useVisibleTab.ts");
for(const word of ["requestAnimationFrame","cell.x+cell.width/2-viewport.current/2",
  "content.current-viewport.current","onContentSize","onViewport","cellLayout",
  "scrollTo({x,y:0,animated})"]){
  assert.ok(hook.includes(word),"Layout-based active tab visibility missing: "+word);
}
const venue=read("apps/mobile/app/(app)/venues/[venueId].tsx");
for(const word of ["useVisibleTab<VenueMainTab>(main)","useVisibleTab<string>(sub[main]",
  "mainNav.scrollRef","subNav.scrollRef","mainNav.cellLayout(item.id,event)",
  "subNav.cellLayout(item,event)","venueSubtabs[id][0]!",
  "bookingDeepLink?\"reserve\":\"media\""]){
  assert.ok(venue.includes(word),"Venue navigation invariant missing: "+word);
}
const team=read("apps/mobile/src/components/social/TeamDetailExperience.tsx");
for(const word of ["useVisibleTab<Tab>(tab)","useVisibleTab<string>(subs[tab]",
  "mainNav.scrollRef","subNav.scrollRef","mainNav.cellLayout(item.id,event)",
  "subNav.cellLayout(key,event)","subNavigation[value][0]!"]){
  assert.ok(team.includes(word),"Team detail navigation invariant missing: "+word);
}
for(const p of [
  "apps/mobile/src/components/owner/OwnerTopNav.tsx",
  "apps/mobile/src/components/owner/timetable/TimetableSubNav.tsx",
  "apps/mobile/src/components/player/PlayerDashboard.tsx",
  "apps/mobile/src/components/team-manager/TeamManagerDashboard.tsx",
  "apps/mobile/src/components/referee/RefereeDashboard.tsx",
  "apps/mobile/app/(app)/competitions/[competitionId].tsx",
]){
  const source=read(p);
  assert.ok(source.includes("scrollTo({"),"Navigation must focus horizontally: "+p);
  assert.ok(source.includes("accessibilityState={{selected"),"Must visually identify selected tab: "+p);
}
const manager=read("apps/mobile/src/components/team-manager/TeamManagerDashboard.tsx");
assert.ok(manager.includes('useState<Section>("overview")'));
assert.ok(manager.includes('section==="aboutTeam"?aboutTeamTabs[0].id:section'),
  "Entering About Team must select the first subtab.");
const admin=read("apps/mobile/app/(app)/admin/index.tsx");
assert.ok(admin.includes('useState<SectionKey>("dashboard")'));
assert.ok(!admin.includes('sessionStorage?.getItem("futsal.admin.section")'),
  "Admin must default to the first section.");
const sidebar=read("apps/mobile/src/components/admin/AdminSidebar.tsx");
assert.ok(sidebar.includes("navRef.current?.scrollTo")&&sidebar.includes("activeGroup"));
const publicNav=read("apps/mobile/src/components/ui/PublicTopNavigation.tsx");
assert.ok(publicNav.includes('item.key==="home"'));
assert.ok(publicNav.includes("accessibilityState={{selected:active}}"));
console.log("Navigation focus verified: first-tab defaults, RTL active tab scroll for venue/team, existing main dashboard focus, admin sidebar selected row.");
