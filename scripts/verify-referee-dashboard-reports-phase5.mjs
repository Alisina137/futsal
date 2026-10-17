import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const ui=read("apps/mobile/src/components/referee/RefereeMatchCenter.tsx");
const dashboard=read("apps/mobile/src/components/referee/RefereeDashboard.tsx");
const offline=read("apps/mobile/src/lib/referee-offline.ts");
const workflow=read("apps/mobile/src/lib/referee-report-workflow.ts");
const owner=read("apps/mobile/src/components/referee/OwnerRefereeReports.tsx");
const backend=read("apps/api/src/modules/referee/referee-phase2.routes.ts");
const locale=read("packages/localization/src/index.ts");
const pkg=JSON.parse(read("package.json"));
const check=(source,patterns,group)=>{
  for(const pattern of patterns)assert.ok(source.includes(pattern),group+": "+pattern);
};
check(offline,["summaryDraft?:string|null","summaryDraft:null",
 "saveRefereeSummaryDraft(","clearRefereeSummaryDraftIfMatches(",
 "if(current.summaryDraft===savedSummary)","return locked(userId,matchId,async()=>",
 "partitionRefereeReplay([queued],report.events)",
 "state.pending.filter(e=>e.id!==queued.id)"],"offline");
check(workflow,["refereeReportCanEdit(","refereeReportNeedsChanges(",
 "refereeReportCanSubmit(","refereeReportNeedsExitWarning("],"rules");
check(ui,['testID="referee-report-workflow"',
 'testID="referee-submit-confirmation"','testID="referee-offline-recovery"',
 'testID="referee-safe-leave"','saveRefereeSummaryDraft(userId,match.id,value)',
 'clearRefereeSummaryDraftIfMatches(userId,match.id,saved)',
 'if(initialEditGeneration===editGeneration.current)',
 'onRiskChange?.(unsafeExit)','refereePhase2Api.submit(token!,match.id,report.revision)',
 'syncRefereeOffline(userId,match.id,token)'],"match-center");
check(dashboard,['testID="referee-dashboard-exit-guard"',
 'if(tab!=="center"&&activeCenterMatch&&centerUnsafe)',
 'onRiskChange={setCenterUnsafe}'],"navigation");
check(owner,['testID="referee-owner-report-review-confirmation"',
 'setReviewConfirmation(null)','refereePhase2Api.review('],"owner");
check(backend,['action:"REFEREE_REPORT_SUBMITTED"',
 'action:"REFEREE_REPORT_RETURNED"','action:"REFEREE_REPORT_APPROVED"',
 'REFEREE_REPORT_STALE','REPORT_REVIEW_CONFLICT'],"backend");
for(const key of ["safeLeaveTitle","safeLeaveBody","keepEditing","leaveAnyway",
 "reviewQueuedEvents","pendingPreserved","reportSubmittedAt","reportReviewedAt",
 "correctionsRequired","correctionsNoReason","correctionInstructions",
 "unsavedOfficialSummary","draftSaving","draftSavedLocally","draftSaveFailed",
 "saveBeforeSubmit","submitConfirmTitle","submitConfirmDescription","confirmSubmit",
 "reportApproved","refreshReport","offlineCacheWarning","ownerConfirmTitle",
 "ownerConfirmApprove","ownerConfirmReturn","ownerConfirmAction"])
 assert.equal(locale.split('"rf2.'+key+'"').length-1,3,"missing three-language "+key);
assert.ok(pkg.scripts["verify:referee-dashboard-reports-phase5"]
 .includes("scripts/tests/referee-dashboard-reports-phase5.test.mjs"));
assert.ok(pkg.scripts.verify.includes("pnpm verify:referee-dashboard-reports-phase5"));
console.log("Referee Dashboard Phase 5 report and offline audit passed.");
