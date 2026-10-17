import test from "node:test";
import assert from "node:assert/strict";
import {refereeReportMetrics} from "../../apps/api/src/modules/referee/referee-career-metrics.ts";
import {refereeHistoryOutcome,refereeHistoryLocalMonth,refereeHistoryFilter,
  refereeHistoryOptions} from "../../apps/mobile/src/lib/referee-career-view.ts";

const date=value=>new Date(value);
const start=date("2026-10-17T06:00:00Z");
const hours=amount=>date(new Date(start.getTime()+amount*3600000).toISOString());
const metric=(status,submittedAt=null)=>({status,finishedAt:start,submittedAt});
const match=(id,patch={})=>({
  matchId:id,competitionId:"cup1",competitionName:"Kabul Cup",
  venueId:"v1",venueName:"Central Court",
  homeName:"Eagles",awayName:"Falcons",
  finishedAt:"2026-10-17T19:30:00Z",
  homeScore:2,awayScore:1,...patch,
});
test("Submission ratio uses all finished reports, not only approved ones",()=>{
  const r=refereeReportMetrics([
    metric("APPROVED",hours(2)),metric("SUBMITTED",hours(27)),
    metric("CHANGES_REQUESTED",hours(20)),metric("DRAFT"),
  ]);
  assert.deepEqual([r.finishedReports,r.submitted,r.onTime,r.submissionRate,r.onTimeRate],
    [4,3,2,75,67]);
  assert.deepEqual([r.draftReports,r.correctionsRequested,r.awaitingReview],[1,1,1]);
  assert.equal(r.averageSubmissionHours,16.3);
});
test("In-progress matches are excluded from the completed-report denominator",()=>{
  const summary=refereeReportMetrics([
    {status:"DRAFT",finishedAt:null,submittedAt:null},
    metric("DRAFT"),metric("SUBMITTED",hours(1)),
  ]);
  assert.equal(summary.finishedReports,2);
  assert.equal(summary.submissionRate,50);
});
test("Empty reports produce zero rates and an absent average, not NaN",()=>{
  const summary=refereeReportMetrics([]);
  assert.equal(summary.finishedReports,0);
  assert.equal(summary.submissionRate,0);
  assert.equal(summary.onTimeRate,0);
  assert.equal(summary.averageSubmissionHours,null);
});
test("Late reports are counted but cannot count as on time",()=>{
  const summary=refereeReportMetrics([
    metric("APPROVED",hours(24)),
    metric("APPROVED",hours(25)),
    metric("SUBMITTED",hours(-1)),
  ]);
  assert.equal(summary.submitted,3);
  assert.equal(summary.onTime,1);
  assert.equal(summary.onTimeRate,33);
  assert.equal(summary.averageSubmissionHours,24.5);
});
test("History matches are categorized from the official home/away score",()=>{
  assert.equal(refereeHistoryOutcome(match("one")),"HOME_WIN");
  assert.equal(refereeHistoryOutcome(match("two",{homeScore:0,awayScore:0})),"DRAW");
  assert.equal(refereeHistoryOutcome(match("three",{homeScore:1,awayScore:4})),"AWAY_WIN");
  assert.equal(refereeHistoryOutcome(match("four",{homeScore:null,awayScore:0})),"UNKNOWN");
});
test("History month is Kabul local, not UTC",()=>{
  assert.equal(refereeHistoryLocalMonth("2026-09-30T20:00:00Z"),"2026-10");
  assert.equal(refereeHistoryLocalMonth("2026-09-30T18:00:00Z"),"2026-09");
  assert.equal(refereeHistoryLocalMonth("invalid"),null);
});
test("Dari and Pashto month filters switch at Nowruz when Solar Hijri is supported",{
  skip:new Intl.DateTimeFormat("fa-AF",{calendar:"persian"})
    .resolvedOptions().calendar!=="persian",
},()=>{
  const before="2026-03-20T07:00:00Z";
  const after="2026-03-21T07:00:00Z";
  assert.equal(refereeHistoryLocalMonth(before,"fa-AF"),"1404-12");
  assert.equal(refereeHistoryLocalMonth(after,"fa-AF"),"1405-01");
  assert.equal(refereeHistoryLocalMonth(after,"ps-AF"),"1405-01");
  assert.equal(refereeHistoryLocalMonth(after,"en"),"2026-03");
  const rows=[match("old",{finishedAt:before}),match("new",{finishedAt:after})];
  assert.deepEqual(refereeHistoryFilter(rows,{
    query:"",competitionId:"ALL",venueId:"ALL",outcome:"ALL",month:"1405-01",language:"fa-AF",
  }).map(row=>row.matchId),["new"]);
});
test("History search and four filters combine without mutating source",()=>{
  const rows=Object.freeze([
    Object.freeze(match("a")),
    Object.freeze(match("b",{homeName:"Lions",competitionId:"cup2",
      competitionName:"Fall League",venueId:"v2",venueName:"West Court",
      homeScore:0,awayScore:0,finishedAt:"2026-09-03T15:00:00Z"})),
    Object.freeze(match("c",{venueId:"v2",venueName:"West Court",
      homeScore:0,awayScore:2})),
  ]);
  const filtered=refereeHistoryFilter(rows,{
    query:"eagles",competitionId:"cup1",venueId:"v2",
    outcome:"AWAY_WIN",month:"2026-10",
  });
  assert.deepEqual(filtered.map(row=>row.matchId),["c"]);
  assert.equal(rows.length,3);
  assert.deepEqual(refereeHistoryOptions(rows).months,["2026-10","2026-09"]);
});
test("History ordering is newest first with deterministic tie-breaking",()=>{
  const rows=[match("z"),match("a"),
    match("old",{finishedAt:"2026-01-17T19:30:00Z"})];
  const visible=refereeHistoryFilter(rows,{
    query:"",competitionId:"ALL",venueId:"ALL",outcome:"ALL",month:"ALL",
  });
  assert.deepEqual(visible.map(row=>row.matchId),["a","z","old"]);
});
