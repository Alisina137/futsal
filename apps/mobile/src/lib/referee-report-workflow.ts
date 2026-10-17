import type {RefereeMatchReport} from "./api";

/** UI-only decisions. Official permissions, submission readiness and revision checks
 * remain enforced by the authenticated server endpoints.
 */
export function refereeReportCanEdit(report:RefereeMatchReport|null){
  return !!report&&["DRAFT","CHANGES_REQUESTED"].includes(report.status);
}
export function refereeReportNeedsChanges(report:RefereeMatchReport|null){
  return report?.status==="CHANGES_REQUESTED";
}
export function refereeReportUnsavedSummary(report:RefereeMatchReport|null,summary:string){
  return refereeReportCanEdit(report)&&summary!==(report?.summary??"");
}
export function refereeReportCanSubmit(
  report:RefereeMatchReport|null,summary:string,
  pendingCount:number,online:boolean,busy:boolean,
){
  return refereeReportCanEdit(report)&&!!report?.finishedAt&&
    !!report?.startedAt&&summary===(report?.summary??"")&&
    pendingCount===0&&online&&!busy;
}
export function refereeReportNeedsExitWarning(
  pendingCount:number,summaryDirty:boolean,syncing:boolean,persisting:boolean,
){
  return pendingCount>0||summaryDirty||syncing||persisting;
}
