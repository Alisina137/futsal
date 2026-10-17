import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const server=read("apps/api/src/modules/referee/referee-career.routes.ts");
const metrics=read("apps/api/src/modules/referee/referee-career-metrics.ts");
const screen=read("apps/mobile/src/components/referee/RefereeCareerPanel.tsx");
const helper=read("apps/mobile/src/lib/referee-career-view.ts");
const client=read("apps/mobile/src/lib/api.ts");
const dash=read("apps/mobile/src/components/referee/RefereeDashboard.tsx");
const locale=read("packages/localization/src/index.ts");
const pkg=JSON.parse(read("package.json"));
const must=(source,patterns,name)=>{
  for(const pattern of patterns)assert.ok(source.includes(pattern),name+": "+pattern);
};
must(server,[
  'export function careerSummary(',
  'const metrics=refereeReportMetrics(finalized)',
  'const verified=finalized.filter(r=>r.status==="APPROVED"',
  '["COMPLETED","CORRECTED"].includes(r.matchStatus)',
  '.where(eq(refereeMatchReports.refereeUserId,userId))',
  'finishedAt:r.finishedAt?.toISOString()??null',
  'venueId:r.venueId,venueName:r.venueName',
  'if(row.report.status!=="APPROVED"',
  'this.tickets.delete(token)',
], "Verified/referee-scoped server career summary");
must(metrics,[
  'const finished=rows.filter(row=>row.finishedAt!==null)',
  'submittedRows=finished.filter(row=>row.submittedAt!==null)',
  'submissionRate:finishedReports?Math.round(100*submitted/finishedReports):0',
  'onTimeRate:submitted?Math.round(100*onTime/submitted):0',
  'averageSubmissionHours:hours.length?',
], "Report metrics");
must(screen,[
  'testID="referee-career-overview-kpis"',
  'testID="referee-career-history-filters"',
  'testID="referee-history-more"',
  'refereeHistoryFilter(history,{',
  'refereeHistoryOptions(history,language)',
  'filteredHistory.slice(0,limit).map',
  'setExpandedPicker(current=>current===id?null:id)',
  'value={result.finishedReports}',
  'value={result.correctionsRequested}',
  'value={result.averageSubmissionHours===null?',
  'value={result.onTimeRate+"%"}',
  'result.venues.map(item=>',
  'setResult(null);setLoading(true);setError(null)',
  'return()=>{active=false;}',
  'currentToken.current!==requestToken',
], "Referee performance and history UI");
must(helper,[
  'export function refereeHistoryFilter(',
  'export function refereeHistoryOptions(',
  'export function refereeHistoryOutcome(',
  'export function refereeHistoryLocalMonth(',
  'timeZone:"Asia/Kabul"',
  'calendar:language==="en"?"gregory":"persian"',
  'refereeHistoryLocalMonth(item.finishedAt,options.language)',
], "History filters");
must(client,[
  'finishedReports:number',
  'averageSubmissionHours:number|null',
  'awaitingReview:number;correctionsRequested:number;draftReports:number',
  'venues:Array<{id:string;name:string;matches:number}>',
], "API contracts");
assert.ok(dash.includes('key={userId+":"+selectedSub}')||
  dash.includes('key={userId+":"+activeCenterMatch.id}')||
  dash.includes('section={selectedSub as "overview"|"history"|"performance"}'),
  "Career dashboard route must remain scoped to the selected referee tab");
for(const name of [
  "finishedReports","reportHealth","draftReports","returnedReports","awaitingReview",
  "reportHealthHint","historySearch","historySearchPlaceholder","competitionFilter",
  "allCompetitions","venueFilter","allVenues","monthFilter","allMonths",
  "resultFilter","outcome.ALL","outcome.HOME_WIN","outcome.DRAW",
  "outcome.AWAY_WIN","outcome.UNKNOWN","matchesFound","clearFilters",
  "historyVerifiedHint","noMatchesFound","showMoreHistory","gregorianChartHint",
  "averageSubmissionTime","venueBreakdown",
])assert.equal(locale.split('"rf3.'+name+'"').length-1,3,
  "Missing English/Dari/Pashto "+name);
assert.ok(pkg.scripts["verify:referee-dashboard-statistics-phase6"]
  .includes("scripts/tests/referee-dashboard-statistics-phase6.test.mjs"));
assert.ok(pkg.scripts.verify.includes("pnpm verify:referee-dashboard-statistics-phase6"));
console.log("Referee Phase 6 audit passed: report denominator, verified-only career, filters, locale and account isolation.");
