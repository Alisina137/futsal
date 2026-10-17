import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const dashboard=read("apps/mobile/src/components/referee/RefereeDashboard.tsx");
const center=read("apps/mobile/src/components/referee/RefereeMatchCenter.tsx");
const utility=read("apps/mobile/src/lib/referee-match-center.ts");
const server=read("apps/api/src/modules/referee/referee-phase2.routes.ts");
const offline=read("apps/mobile/src/lib/referee-offline.ts");
const locale=read("packages/localization/src/index.ts");
const pkg=JSON.parse(read("package.json"));

for(const m of [
  'key={userId+":"+activeCenterMatch.id}',
  'initialTab={refereeWorkspaceInitialTab(selectedSub as "upcoming"|"live"|"reports")}',
  'refereeCenterSectionForMatch(m)',
  'if(tab!=="center"){setActiveCenterMatch(null);setCenterUnsafe(false);setCenterSaving(false);}',
  'if(main==="center"&&selectedSub!==id)setActiveCenterMatch(null)',
  'main!=="overview"&&!(main==="center"&&activeCenterMatch)',
])assert.ok(dashboard.includes(m),"Match Center list/detail navigation: "+m);
for(const m of [
  'testID="referee-workspace-tabs"',
  'refereeWorkspaceTabs.map(tab=><Pressable',
  'accessibilityRole="tab"',
  'accessibilityState={{selected:workspaceTab===tab}}',
  'refereeWorkspaceAllowsFinish(report,pending.length,connected,busy)',
  'testID="referee-finish-confirmation"',
  'await perform(()=>refereePhase2Api.clock(token!,match.id,"FINISH"',
  'if(saved)setWorkspaceTab("report")',
  'workspaceTab==="scoreboard"&&canStart',
  'workspaceTab==="scoreboard"&&active',
  'workspaceTab==="events"&&recording',
  'testID="referee-workspace-events"',
  'testID="referee-workspace-teams"',
  'workspaceTab==="report"&&!report?.finishedAt',
  'workspaceTab==="report"&&report?.finishedAt',
  'refereeTeamRoster(roster,data?.match.homeTeamId??null)',
  'refereeTeamRoster(roster,data?.match.awayTeamId??null)',
  'eventTotals.GOAL','eventTotals.FOUL',
  'testID="referee-workspace-more-events"',
  'visibleEvents.slice().reverse().slice(0,eventLimit)',
  'if(removed){setDeleteId(null);setDeleteReason("");}',
  'refereePhase2Api.submit(token!,match.id,report.revision)',
  'refereePhase2Api.removeEvent(',
  'refereePhase2Api.update(token!,match.id,',
  'pending.length>0||!connected',
  'syncRefereeOffline(userId,match.id,token)',
  'enqueueRefereeEvent(userId,match.id,event)',
])assert.ok(center.includes(m),"Referee match workspace: "+m);
for(const m of [
  'export const refereeWorkspaceTabs',
  'export function refereeWorkspaceInitialTab(',
  'export function refereeCenterSectionForMatch(',
  'export function refereeWorkspaceAllowsFinish(',
  'report.status==="DRAFT"',
  '(report.clock?.period??0)===2',
  'export function refereeTeamRoster(',
  'export function refereeMatchEventTotals(',
])assert.ok(utility.includes(m),"Shared match-center logic: "+m);
for(const m of [
  'function canEdit(status:string)',
  'REFEREE_NOT_CONFIRMED',
  'CHECKLIST_INCOMPLETE',
  'MATCH_FINISHED',
  'reportScore(',
  'this.competitionsService.enterResult(',
])assert.ok(server.includes(m),"Server-side officiating guard: "+m);
for(const m of [
  'await store(next)','syncRefereeOffline','partitionRefereeReplay([queued],report.events)',
])assert.ok(offline.includes(m),"Offline event durability: "+m);
for(const key of [
  "rf2.workspace.scoreboard","rf2.workspace.events","rf2.workspace.teams",
  "rf2.workspace.report","rf2.teamsTitle","rf2.teamsHint",
  "rf2.rosterCount","rf2.rosterEmpty","rf2.eventCount","rf2.reportNotReady",
  "rf2.confirmFinishTitle","rf2.confirmFinishBody","rf2.confirmFinish",
  "rf2.finishAfterSecondPeriod","rf2.showMoreEvents",
])assert.equal(locale.split('"'+key+'"').length-1,3,"Missing English/Dari/Pashto: "+key);
assert.ok(pkg.scripts["verify:referee-dashboard-match-center-phase4"]
  .includes("scripts/tests/referee-dashboard-match-center-phase4.test.mjs"));
assert.ok(pkg.scripts.verify.includes("pnpm verify:referee-dashboard-match-center-phase4"));
console.log("Referee dashboard Phase 4 audit passed: navigation, clock, events, rosters, reports, offline and localization.");
