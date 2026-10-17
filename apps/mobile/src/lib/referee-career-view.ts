import type {RefereeCareerResponse} from "./api";

export type RefereeHistoryOutcome="ALL"|"HOME_WIN"|"DRAW"|"AWAY_WIN";
export type RefereeCareerMatch=RefereeCareerResponse["history"][number];

/** Career history contains approved official results only. These filters never
 * change the verified statistics or unlock private/unapproved reports.
 */
export function refereeHistoryOutcome(
  item:Pick<RefereeCareerMatch,"homeScore"|"awayScore">,
):Exclude<RefereeHistoryOutcome,"ALL">|"UNKNOWN"{
  if(item.homeScore===null||item.awayScore===null)return "UNKNOWN";
  return item.homeScore===item.awayScore?"DRAW":
    item.homeScore>item.awayScore?"HOME_WIN":"AWAY_WIN";
}
export function refereeHistoryLocalMonth(value:string|null){
  if(!value)return null;
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return null;
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kabul",
    calendar:"gregory",numberingSystem:"latn",year:"numeric",month:"2-digit"})
    .formatToParts(date);
  const part=(kind:string)=>parts.find(p=>p.type===kind)?.value??"";
  return part("year")+"-"+part("month");
}
export function refereeHistoryFilter(
  items:ReadonlyArray<RefereeCareerMatch>,
  options:{query:string;competitionId:string;venueId:string;outcome:RefereeHistoryOutcome;
    month:string},
){
  const q=options.query.trim().toLocaleLowerCase();
  return items.filter(item=>{
    if(options.competitionId!=="ALL"&&item.competitionId!==options.competitionId)return false;
    if(options.venueId!=="ALL"&&item.venueId!==options.venueId)return false;
    if(options.month!=="ALL"&&refereeHistoryLocalMonth(item.finishedAt)!==options.month)return false;
    if(options.outcome!=="ALL"&&refereeHistoryOutcome(item)!==options.outcome)return false;
    return !q||[item.homeName,item.awayName,item.competitionName,item.venueName]
      .some(name=>name.toLocaleLowerCase().includes(q));
  }).sort((a,b)=>(Date.parse(b.finishedAt??"")||0)-(Date.parse(a.finishedAt??"")||0)||
    a.matchId.localeCompare(b.matchId));
}
export function refereeHistoryOptions(items:ReadonlyArray<RefereeCareerMatch>){
  const competitions=[...new Map(items.map(m=>[m.competitionId,m.competitionName])).entries()]
    .sort((a,b)=>a[1].localeCompare(b[1]));
  const venues=[...new Map(items.map(m=>[m.venueId,m.venueName])).entries()]
    .sort((a,b)=>a[1].localeCompare(b[1]));
  const months=[...new Set(items.map(m=>refereeHistoryLocalMonth(m.finishedAt))
    .filter((month):month is string=>Boolean(month)))].sort().reverse();
  return {competitions,venues,months};
}
