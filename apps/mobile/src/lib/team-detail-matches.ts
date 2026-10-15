import type {TeamPublicHighlights} from "./api";

export type TeamPublicMatch=TeamPublicHighlights["matches"][number];
export type TeamMatchView="upcoming"|"results";
export type TeamMatchStatusFilter="ALL"|"SCHEDULED"|"IN_PROGRESS"|"POSTPONED";
export type TeamMatchOutcomeFilter="ALL"|"WIN"|"DRAW"|"LOSS";
export type TeamMatchOutcome=Exclude<TeamMatchOutcomeFilter,"ALL">;

export const teamMatchUpcomingStatuses=["ALL","IN_PROGRESS","SCHEDULED","POSTPONED"] as const;
export const teamMatchResultOutcomes=["ALL","WIN","DRAW","LOSS"] as const;

/** Completed/corrected is a status, not evidence that scores were entered. */
export function isTeamMatchFinished(match:TeamPublicMatch):boolean{
  return match.status==="COMPLETED"||match.status==="CORRECTED";
}
export function isTeamMatchUpcoming(match:TeamPublicMatch):boolean{
  return match.status==="IN_PROGRESS"||match.status==="SCHEDULED"||match.status==="POSTPONED";
}
export function teamMatchHasVerifiedScore(match:TeamPublicMatch):boolean{
  return isTeamMatchFinished(match)&&
    Number.isSafeInteger(match.homeScore)&&Number.isSafeInteger(match.awayScore)&&
    match.homeScore!==null&&match.awayScore!==null&&
    match.homeScore>=0&&match.awayScore>=0;
}
export function teamMatchOutcome(match:TeamPublicMatch,teamId:string):TeamMatchOutcome|null{
  if(!teamMatchHasVerifiedScore(match))return null;
  if(match.homeTeamId!==teamId&&match.awayTeamId!==teamId)return null;
  const our=match.homeTeamId===teamId?match.homeScore!:match.awayScore!;
  const opponent=match.homeTeamId===teamId?match.awayScore!:match.homeScore!;
  return our===opponent?"DRAW":our>opponent?"WIN":"LOSS";
}
export function teamMatchScoreLabel(match:TeamPublicMatch):string|null{
  return teamMatchHasVerifiedScore(match)?`${match.homeScore} : ${match.awayScore}`:null;
}

type Options={
  view:TeamMatchView;
  query?:string;
  competitionId?:string;
  status?:TeamMatchStatusFilter;
  outcome?:TeamMatchOutcomeFilter;
};

/** Search/filter only data supplied by the public, published-competition endpoint. */
export function filterTeamMatches(
  matches:readonly TeamPublicMatch[],teamId:string,options:Options,
):TeamPublicMatch[]{
  const query=(options.query??"").trim().toLocaleLowerCase();
  const competition=options.competitionId??"ALL";
  const status=options.status??"ALL";
  const outcome=options.outcome??"ALL";
  const rows=matches.filter(match=>{
    if(match.homeTeamId!==teamId&&match.awayTeamId!==teamId)return false;
    if(options.view==="results"?!isTeamMatchFinished(match):!isTeamMatchUpcoming(match))return false;
    if(competition!=="ALL"&&match.competitionId!==competition)return false;
    if(options.view==="upcoming"&&status!=="ALL"&&match.status!==status)return false;
    if(options.view==="results"&&outcome!=="ALL"&&teamMatchOutcome(match,teamId)!==outcome)return false;
    if(query&&![
      match.competitionName,match.homeTeamName,match.awayTeamName,match.stage,
    ].some(value=>value.toLocaleLowerCase().includes(query)))return false;
    return true;
  });
  const dateNumber=(match:TeamPublicMatch)=>{
    const time=match.startsAt?Date.parse(match.startsAt):NaN;
    return Number.isFinite(time)?time:null;
  };
  return rows.sort((a,b)=>{
    if(options.view==="upcoming"){
      // Live first, scheduled next, postponed last. Missing dates stay last.
      const priority=(m:TeamPublicMatch)=>m.status==="IN_PROGRESS"?0:
        m.status==="SCHEDULED"?1:2;
      const rank=priority(a)-priority(b);
      if(rank)return rank;
    }
    const aTime=dateNumber(a),bTime=dateNumber(b);
    if(aTime===null&&bTime!==null)return 1;
    if(bTime===null&&aTime!==null)return -1;
    if(aTime!==null&&bTime!==null&&aTime!==bTime)
      return options.view==="results"?bTime-aTime:aTime-bTime;
    return a.id.localeCompare(b.id);
  });
}

/** Counts describe this server-limited public fixture snapshot, not season totals. */
export function teamMatchSnapshot(matches:readonly TeamPublicMatch[],teamId:string){
  const relevant=matches.filter(m=>m.homeTeamId===teamId||m.awayTeamId===teamId);
  return {
    upcoming:relevant.filter(isTeamMatchUpcoming).length,
    results:relevant.filter(isTeamMatchFinished).length,
  };
}
export function teamMatchCompetitionChoices(matches:readonly TeamPublicMatch[],teamId:string){
  const byId=new Map<string,string>();
  for(const match of matches)
    if((match.homeTeamId===teamId||match.awayTeamId===teamId)&&
      !byId.has(match.competitionId))
      byId.set(match.competitionId,match.competitionName);
  return [...byId].map(([id,name])=>({id,name}))
    .sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
}
