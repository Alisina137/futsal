import type {RefereeMatch} from "./api";

export type RefereeAssignmentSection="pending"|"confirmed"|"history";
export type RefereeHistoryStatus=
  "ALL"|"DECLINED"|"WITHDRAW_REQUESTED"|"EXPIRED"|"CANCELLED"|
  "COMPLETED"|"POSTPONED"|"REVOKED"|"OTHER";

function validStart(match:RefereeMatch){
  const start=match.startsAt?Date.parse(match.startsAt):NaN;
  return Number.isFinite(start)?start:null;
}
function interval(match:RefereeMatch){
  const start=validStart(match);
  if(start===null)return null;
  const rawEnd=match.endsAt?Date.parse(match.endsAt):NaN;
  const end=Number.isFinite(rawEnd)?rawEnd:
    start+Math.max(0,match.durationMinutes)*60_000;
  return end>start?{start,end}:null;
}

/** The API retains the underlying response; UI grouping cannot grant permissions. */
export function refereeAssignmentSection(match:RefereeMatch,nowMs:number):RefereeAssignmentSection{
  const starts=validStart(match);
  if(match.authorized&&match.matchStatus==="SCHEDULED"&&
    match.responseStatus==="PENDING"&&starts!==null&&starts>nowMs)return "pending";
  if(match.authorized&&match.responseStatus==="ACCEPTED"&&
    ["SCHEDULED","IN_PROGRESS"].includes(match.matchStatus))return "confirmed";
  return "history";
}
export function refereeAssignmentHistoryStatus(match:RefereeMatch,nowMs:number):Exclude<RefereeHistoryStatus,"ALL">{
  if(match.responseStatus==="DECLINED")return "DECLINED";
  if(match.responseStatus==="WITHDRAW_REQUESTED")return "WITHDRAW_REQUESTED";
  if(match.matchStatus==="CANCELLED")return "CANCELLED";
  if(match.matchStatus==="POSTPONED")return "POSTPONED";
  if(["COMPLETED","CORRECTED"].includes(match.matchStatus))return "COMPLETED";
  if(!match.authorized)return "REVOKED";
  const start=validStart(match);
  if(match.responseStatus==="PENDING"&&
    (start===null||start<=nowMs))return "EXPIRED";
  return "OTHER";
}

/** Informational conflict preview; server-side locked acceptance is authoritative. */
export function refereeAssignmentTimeConflict(
  candidate:RefereeMatch,
  assignments:ReadonlyArray<RefereeMatch>,
):RefereeMatch|null{
  const target=interval(candidate);
  if(!target)return null;
  return assignments.find(other=>{
    if(other.id===candidate.id||other.responseStatus!=="ACCEPTED"||!other.authorized||
      !["SCHEDULED","IN_PROGRESS"].includes(other.matchStatus))return false;
    const booked=interval(other);
    return !!booked&&target.start<booked.end&&booked.start<target.end;
  })??null;
}

export function refereeVisibleAssignments(
  assignments:ReadonlyArray<RefereeMatch>,
  section:RefereeAssignmentSection,
  query:string,
  venueId:string,
  historyStatus:RefereeHistoryStatus,
  nowMs:number,
){
  const term=query.trim().toLocaleLowerCase();
  const matching=assignments.filter(match=>{
    if(refereeAssignmentSection(match,nowMs)!==section)return false;
    if(venueId!=="ALL"&&match.venueId!==venueId)return false;
    if(section==="history"&&historyStatus!=="ALL"&&
      refereeAssignmentHistoryStatus(match,nowMs)!==historyStatus)return false;
    return !term||[match.homeTeamName,match.awayTeamName,match.competitionName,
      match.venueName,match.venueAddress].some(value=>value.toLocaleLowerCase().includes(term));
  });
  return matching.sort((a,b)=>{
    const aTime=validStart(a)??0,bTime=validStart(b)??0;
    return (section==="history"?bTime-aTime:aTime-bTime)||a.id.localeCompare(b.id);
  });
}
