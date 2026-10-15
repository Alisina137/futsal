import type {CompetitionDto,CompetitionParticipationDto,TeamListItemDto} from "@leaguekick/contracts";

export type CompetitionRegistrationClosure="OPEN"|"CLOSED"|"DEADLINE"|"FULL";
export type CompetitionRegistrationSummary={
  state:CompetitionRegistrationClosure;acceptedCount:number;remainingPlaces:number;
  availableForApply:boolean;submittedCount:number;
};
const pending=new Set(["INVITED","APPLIED","PENDING","ACCEPTED"]);
export function competitionRegistrationSummary(
  competition:Pick<CompetitionDto,"status"|"maxTeams"|"teams"|"registrationClosesAt">,
  now:Date=new Date(),
):CompetitionRegistrationSummary{
  const acceptedCount=competition.teams.filter(team=>team.status==="ACCEPTED").length;
  const remainingPlaces=Math.max(0,competition.maxTeams-acceptedCount);
  const deadlineMs=competition.registrationClosesAt?Date.parse(competition.registrationClosesAt):null;
  const state:CompetitionRegistrationClosure=competition.status!=="REGISTRATION_OPEN"?
    "CLOSED":deadlineMs!==null&&Number.isFinite(deadlineMs)&&deadlineMs<=now.getTime()?
    "DEADLINE":remainingPlaces===0?"FULL":"OPEN";
  return {state,acceptedCount,remainingPlaces,availableForApply:state==="OPEN",
    submittedCount:competition.teams.filter(team=>pending.has(team.status)).length};
}

/** Do not allow a manager to submit a duplicate active team application. */
export function eligibleCompetitionTeams(
  managed:readonly TeamListItemDto[],
  competition:Pick<CompetitionDto,"teams">,
  participations:readonly CompetitionParticipationDto[],
  currentUserId:string,
):TeamListItemDto[]{
  const registered=new Set([...competition.teams.filter(team=>pending.has(team.status))
    .map(team=>team.teamId),...participations.filter(item=>pending.has(item.status))
    .map(item=>item.teamId)]);
  return managed.filter(team=>team.managerUserId===currentUserId&&!registered.has(team.id));
}
export function visibleCompetitionParticipations(
  participations:readonly CompetitionParticipationDto[],
):CompetitionParticipationDto[]{
  const order:Record<string,number>={INVITED:0,APPLIED:1,PENDING:2,ACCEPTED:3,
    REJECTED:4,WITHDRAWN:5};
  return [...participations].sort((a,b)=>(order[a.status]??6)-(order[b.status]??6)||
    a.teamName.localeCompare(b.teamName)||a.teamId.localeCompare(b.teamId));
}
