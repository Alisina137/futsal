import type {RefereeMatch,RefereeMatchEvent,RefereeMatchReport,RefereeReportMember} from "./api";

export type RefereeWorkspaceTab="scoreboard"|"events"|"teams"|"report";
export const refereeWorkspaceTabs:ReadonlyArray<RefereeWorkspaceTab>=
  ["scoreboard","events","teams","report"];
export function refereeWorkspaceInitialTab(
  section:"upcoming"|"live"|"reports",
):RefereeWorkspaceTab{
  return section==="reports"?"report":"scoreboard";
}
export type RefereeCenterSection="upcoming"|"live"|"reports";
export function refereeCenterSectionForMatch(
  match:Pick<RefereeMatch,"reportFinishedAt"|"reportStatus"|"reportStartedAt">,
):RefereeCenterSection{
  if(match.reportFinishedAt||
    ["SUBMITTED","CHANGES_REQUESTED","APPROVING","APPROVED"].includes(match.reportStatus??""))
    return "reports";
  return match.reportStartedAt?"live":"upcoming";
}
export function refereeWorkspaceAllowsFinish(
  report:RefereeMatchReport|null,
  pendingEvents:number,
  connected:boolean,
  busy:boolean,
):boolean{
  return connected&&!busy&&pendingEvents===0&&!!report?.startedAt&&
    !report.finishedAt&&(report.clock?.period??0)===2&&
    report.status==="DRAFT";
}
export function refereeTeamRoster(roster:ReadonlyArray<RefereeReportMember>,
  teamId:string|null){
  return roster.filter(person=>person.teamId===teamId)
    .sort((a,b)=>(a.shirtNumber??999)-(b.shirtNumber??999)||
      a.name.localeCompare(b.name));
}
export function refereeMatchEventTotals(events:ReadonlyArray<RefereeMatchEvent>){
  const kinds=["GOAL","YELLOW_CARD","RED_CARD","FOUL","TIMEOUT","SUBSTITUTION","INCIDENT"] as const;
  const totals:Record<(typeof kinds)[number],number>={
    GOAL:0,YELLOW_CARD:0,RED_CARD:0,FOUL:0,TIMEOUT:0,SUBSTITUTION:0,INCIDENT:0,
  };
  for(const event of events)if(Object.prototype.hasOwnProperty.call(totals,event.kind))
    totals[event.kind]++;
  return totals;
}
