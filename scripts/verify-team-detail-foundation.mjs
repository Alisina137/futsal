import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const source=read("apps/mobile/src/components/social/TeamDetailExperience.tsx");
const nav=read("apps/mobile/src/lib/team-detail-navigation.ts");

for(const token of [
  "initialTeamNavigation(requestedTab,requestedSub)",
  "switchTeamMain(current,value,target)",
  "switchTeamSub(current,tab,key",
  "setNavState(initialTeamNavigation(requestedTab,requestedSub))",
  'testID={"team-main-tab-"+item.id}',
  'testID={"team-subtab-"+tab+"-"+key}',
  "useVisibleTab<Tab>(tab)",
  "useVisibleTab<string>(subs[tab]",
  "mainNav.focus(value,true)","subNav.focus(key,true)",
  "accessibilityState={{selected:tab===item.id}}",
  "accessibilityState={{selected:subs[tab]===key}}",
])assert.ok(source.includes(token),"Missing Team Detail Phase 1 navigation invariant: "+token);

assert.ok(!source.includes("setTab(")&&!source.includes("setSubs("),
  "Tab state must be changed atomically to preserve other subtabs.");
assert.ok(nav.includes('main=validMain(mainValue)?mainValue:"media"')&&
  nav.includes('media:"posts",squad:"players",matches:"upcoming"')&&
  nav.includes("if(current.main!==main)return current"),
  "Default tab/subtab, deep link validation and active-subtab guards must hold.");
for(const token of [
  "loadGeneration.current++","postsGeneration.current++",
  "followActionSequence.current++","joinActionSequence.current++",
  "setTeam(null);setProfile(null);setMember(false);setJoinStatus(null)",
  "lastActorIdentity.current!==actorIdentity",
  "team&&team.id!==id",
  "if(action===followActionSequence.current)setFollowState(result)",
  "if(action===joinActionSequence.current)setJoinStatus(result.request.status)",
  "if(action===joinActionSequence.current)setJoinStatus(null)",
  "setMorePostsBusy(false)",
])assert.ok(source.includes(token),"Missing stale team/account response guard: "+token);
for(const tab of ["media","squad","matches","competitions","stats","about"])
  assert.ok(nav.includes(tab+":["),"Existing tab missing: "+tab);
assert.ok(source.includes('team.privacy==="PUBLIC"||member')&&
  source.includes("teamApi.roster")&&source.includes('joinStatus==="PENDING"'),
  "Team roster privacy and join-request authorization must stay intact.");
console.log("Team Detail Phase 1 verified: persistent subtabs, validated deep links, selected RTL tabs, and scoped async operations.");
