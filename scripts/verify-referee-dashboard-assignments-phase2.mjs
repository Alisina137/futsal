import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const dashboard=read("apps/mobile/src/components/referee/RefereeDashboard.tsx");
const panel=read("apps/mobile/src/components/referee/RefereeAssignmentsPanel.tsx");
const helper=read("apps/mobile/src/lib/referee-assignments.ts");
const backend=read("apps/api/src/modules/referee/referee.routes.ts");
const locale=read("packages/localization/src/index.ts");
const pkg=JSON.parse(read("package.json"));
for(const marker of [
  'assignments:["pending","confirmed","calendar","history"]',
  '["pending","confirmed","history"].includes(selectedSub)',
  '<RefereeAssignmentsPanel key={userId}',
  'onChanged={()=>setRefresh(value=>value+1)}',
  'onOpenMatch={match=>',
])assert.ok(dashboard.includes(marker),"Dashboard assignments navigation: "+marker);
for(const marker of [
  'testID="referee-assignments-filters"','testID="referee-assignment-confirmation"',
  'testID="referee-assignments-empty"','testID="referee-assignments-more"',
  'refereeVisibleAssignments(assignments,section,query,venue,',
  'refereeAssignmentTimeConflict(match,assignments)',
  'refereeAssignmentHistoryStatus(match,now)',
  'availableHistoryStatuses.has(status)',
  'section==="pending"&&future&&!!match.endsAt&&!conflict',
  'action==="WITHDRAW_REQUESTED"&&reason.trim().length<3',
  'await refereeApi.respond(capturedToken,match.id,decision,reason.trim()||undefined)',
  'if(!mountedRef.current||tokenRef.current!==capturedToken)return',
])assert.ok(panel.includes(marker),"Referee assignments UX or safety: "+marker);
for(const marker of [
  'export function refereeAssignmentSection(',
  'export function refereeAssignmentHistoryStatus(',
  'export function refereeAssignmentTimeConflict(',
  'export function refereeVisibleAssignments(',
  'if(!target)return null',
  'other.responseStatus!=="ACCEPTED"',
  'target.start<booked.end&&booked.start<target.end',
])assert.ok(helper.includes(marker),"Assignments logic: "+marker);
for(const marker of [
  'eq(refereeMatchResponses.refereeUserId,userId)',
  'const previousIds=[...new Set(responses.map(r=>r.matchId))]',
  'inArray(competitionMatches.id,previousIds)',
  'match.refereeUserId===userId&&allowedVenues.has(match.venueId??"")',
  'const confirmed=matches.filter(m=>m.responseStatus==="ACCEPTED"&&m.authorized)',
  'pg_advisory_xact_lock(hashtext(',
  '"REFEREE_TIME_CONFLICT"',
  '"REFEREE_CONFLICT_OF_INTEREST"',
])assert.ok(backend.includes(marker),"Backend preserved invitations/permissions: "+marker);
for(const key of [
  "rf1.assignments.history","rf1.assignments.search",
  "rf1.assignments.searchPlaceholder","rf1.assignments.venueFilter",
  "rf1.assignments.allVenues","rf1.assignments.historyFilter",
  "rf1.assignments.results","rf1.assignments.clear",
  "rf1.assignments.empty","rf1.assignments.saved",
  "rf1.assignments.reason","rf1.assignments.conflict",
  "rf1.assignments.kickoffSoon","rf1.assignments.missingEndTime",
  "rf1.assignments.confirmTitle","rf1.assignments.confirmAccept",
  "rf1.assignments.confirmDecline","rf1.assignments.confirmWithdraw",
  "rf1.assignments.confirmAction","rf1.assignments.cancelAction",
  "rf1.assignments.showMore",
  ...["ALL","DECLINED","WITHDRAW_REQUESTED","EXPIRED","CANCELLED",
    "COMPLETED","POSTPONED","REVOKED","OTHER"].map(status=>
      "rf1.assignments.status."+status),
])assert.equal(locale.split('"'+key+'"').length-1,3,"Missing three-language "+key);
assert.ok(pkg.scripts["verify:referee-dashboard-assignments-phase2"]
  .includes("scripts/tests/referee-dashboard-assignments-phase2.test.mjs"));
assert.ok(pkg.scripts.verify.includes("pnpm verify:referee-dashboard-assignments-phase2"));
console.log("Referee Dashboard Phase 2: history, safe decisions, conflict filters and locale audit passed.");
