import type {TeamPublicHighlights} from "./api";

export type PublicTeamMatch=TeamPublicHighlights["matches"][number];
export type TeamMatchPhase="upcoming"|"results";
export type TeamMatchFilter="all"|"live"|"scheduled"|"postponed"|"win"|"draw"|"loss";

export function finished(m:PublicTeamMatch):boolean{
  return m.status==="COMPLETED"||m.status==="CORRECTED";
}
export function teamMatchOutcome(m:PublicTeamMatch,teamId:string):"win"|"draw"|"loss"|null{
  if(!finished(m)||m.homeScore===null||m.awayScore===null)return null;
  if(m.homeTeamId!==teamId&&m.awayTeamId!==teamId)return null;
  const own=m.homeTeamId===teamId?m.homeScore:m.awayScore;
  const rival=m.homeTeamId===teamId?m.awayScore:m.homeScore;
  return own===rival?"draw":own>rival?"win":"loss";
}
export function teamMatchRows(
  matches:readonly PublicTeamMatch[],teamId:string,phase:TeamMatchPhase,
  filter:TeamMatchFilter="all",competitionId:string="all",
):PublicTeamMatch[]{
  return matches.filter(m=>{
    // Reject unrelated fixture records (even when the server makes a mistake).
    if(m.homeTeamId!==teamId&&m.awayTeamId!==teamId)return false;
    if(competitionId!=="all"&&m.competitionId!==competitionId)return false;
    if(phase==="results"){
      if(!finished(m))return false;
      return filter==="all"||teamMatchOutcome(m,teamId)===filter;
    }
    if(!["SCHEDULED","IN_PROGRESS","POSTPONED"].includes(m.status))return false;
    return filter==="all"||(filter==="live"&&m.status==="IN_PROGRESS")||
      (filter==="scheduled"&&m.status==="SCHEDULED")||
      (filter==="postponed"&&m.status==="POSTPONED");
  }).sort((a,b)=>{
    if(phase==="upcoming"){
      if(a.status==="IN_PROGRESS"&&b.status!=="IN_PROGRESS")return -1;
      if(b.status==="IN_PROGRESS"&&a.status!=="IN_PROGRESS")return 1;
    }
    const aTime=a.startsAt?Date.parse(a.startsAt):NaN;
    const bTime=b.startsAt?Date.parse(b.startsAt):NaN;
    const x=Number.isFinite(aTime)?aTime:phase==="results"?-Infinity:Infinity;
    const y=Number.isFinite(bTime)?bTime:phase==="results"?-Infinity:Infinity;
    return phase==="results"?y-x||a.id.localeCompare(b.id):x-y||a.id.localeCompare(b.id);
  });
}
export function teamMatchCompetitions(matches:readonly PublicTeamMatch[],teamId:string,phase:TeamMatchPhase){
  const rows=teamMatchRows(matches,teamId,phase);
  return [...new Map(rows.map(m=>[m.competitionId,{id:m.competitionId,name:m.competitionName}])).values()]
    .sort((a,b)=>a.name.localeCompare(b.name));
}
