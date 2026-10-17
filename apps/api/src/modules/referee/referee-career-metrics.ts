/** A finished referee match may be in draft, returned, submitted or approved
 * state. Using only approved records would make submission-rate 100% by design.
 * Keep reporting workflow metrics separate from verified official match results.
 */
export type RefereeReportMetricRecord={
  finishedAt:Date|null;
  submittedAt:Date|null;
  status:string;
};
export function refereeReportMetrics(rows:ReadonlyArray<RefereeReportMetricRecord>){
  const finished=rows.filter(row=>row.finishedAt!==null);
  const finishedReports=finished.length;
  const submittedRows=finished.filter(row=>row.submittedAt!==null);
  const submitted=submittedRows.length;
  const onTime=submittedRows.filter(row=>row.finishedAt&&row.submittedAt&&
    row.submittedAt.getTime()>=row.finishedAt.getTime()&&
    row.submittedAt.getTime()-row.finishedAt.getTime()<=86400000).length;
  const hours=submittedRows.filter(row=>row.finishedAt&&row.submittedAt&&
    row.submittedAt.getTime()>=row.finishedAt.getTime()).map(row=>
    (row.submittedAt!.getTime()-row.finishedAt!.getTime())/3600000);
  return {
    finishedReports,submitted,onTime,
    submissionRate:finishedReports?Math.round(100*submitted/finishedReports):0,
    onTimeRate:submitted?Math.round(100*onTime/submitted):0,
    draftReports:finished.filter(row=>row.status==="DRAFT").length,
    correctionsRequested:finished.filter(row=>row.status==="CHANGES_REQUESTED").length,
    awaitingReview:finished.filter(row=>["SUBMITTED","APPROVING"].includes(row.status)).length,
    averageSubmissionHours:hours.length?
      Math.round(10*hours.reduce((sum,value)=>sum+value,0)/hours.length)/10:null,
  };
}
