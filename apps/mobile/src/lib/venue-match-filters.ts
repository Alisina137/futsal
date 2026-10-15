import type {VenueMatchItem} from "@leaguekick/contracts";

export type VenueMatchFilters={
  competitionId:string;teamId:string;year:string;month:string;week:string;
};
export const emptyVenueMatchFilters:VenueMatchFilters={
  competitionId:"",teamId:"",year:"",month:"",week:"",
};
export type VenueMatchFacets={
  competitions:Array<{id:string;name:string}>;
  teams:Array<{id:string;name:string}>;
  years:number[];months:number[];weeks:number[];
};
export const emptyVenueMatchFacets:VenueMatchFacets={
  competitions:[],teams:[],years:[],months:[],weeks:[],
};

/** Gregorian venue-local day and ISO Monday-Sunday week (1..53). */
export function venueMatchLocalParts(iso:string,timeZone:string){
  const parts=new Intl.DateTimeFormat("en-GB",{
    timeZone,calendar:"gregory",year:"numeric",month:"2-digit",day:"2-digit",
  }).formatToParts(new Date(iso));
  const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  const year=Number(values.year),month=Number(values.month),day=Number(values.day);
  const date=new Date(Date.UTC(year,month-1,day));
  // ISO 8601 week starts Monday; first week contains January 4.
  date.setUTCDate(date.getUTCDate()+4-(date.getUTCDay()||7));
  const weekYear=date.getUTCFullYear();
  const yearStart=new Date(Date.UTC(weekYear,0,1));
  const week=Math.ceil((((date.getTime()-yearStart.getTime())/86400000)+1)/7);
  return {year,month,week};
}

export function venueMatchFitsFilters(
  match:Pick<VenueMatchItem,"competitionId"|"homeTeamId"|"awayTeamId"|"startsAt">,
  filter:VenueMatchFilters,timeZone:string,
):boolean{
  if(filter.competitionId&&match.competitionId!==filter.competitionId)return false;
  if(filter.teamId&&match.homeTeamId!==filter.teamId&&match.awayTeamId!==filter.teamId)return false;
  if(!filter.year&&!filter.month&&!filter.week)return true;
  if(!match.startsAt)return false;
  const parts=venueMatchLocalParts(match.startsAt,timeZone);
  return (!filter.year||parts.year===Number(filter.year))&&
    (!filter.month||parts.month===Number(filter.month))&&
    (!filter.week||parts.week===Number(filter.week));
}

/** Neutral for draws, unknown scores, or matches without an official final. */
export function venueMatchResultEmphasis(
  status:VenueMatchItem["status"],home:number|null,away:number|null,
):{home:"winner"|"loser"|"neutral";away:"winner"|"loser"|"neutral"}{
  if((status!=="COMPLETED"&&status!=="CORRECTED")||home===null||away===null||home===away)
    return {home:"neutral",away:"neutral"};
  return home>away
    ?{home:"winner",away:"loser"}
    :{home:"loser",away:"winner"};
}
