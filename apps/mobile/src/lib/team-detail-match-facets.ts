import type {PublicTeamMatch,TeamMatchFilter,TeamMatchPhase} from "./team-detail-matches.ts";
import {teamMatchRows} from "./team-detail-matches.ts";
import {venueMatchFitsFilters,venueMatchLocalParts,
  type VenueMatchFacets,type VenueMatchFilters} from "./venue-match-filters.ts";

/** Team feeds are an authorized, bounded published-match snapshot (100 most recent).
 * Apply five venue-style filters to that snapshot, not to private team records. */
export function teamMatchSelectFacets(
  matches:readonly PublicTeamMatch[],teamId:string,phase:TeamMatchPhase,
  timeZone:string,
):VenueMatchFacets{
  const all=teamMatchRows(matches,teamId,phase);
  const competitions=new Map<string,string>();
  const opponents=new Map<string,string>();
  const years=new Set<number>(),months=new Set<number>(),weeks=new Set<number>();
  for(const match of all){
    competitions.set(match.competitionId,match.competitionName);
    const opponentId=match.homeTeamId===teamId?match.awayTeamId:match.homeTeamId;
    const opponentName=match.homeTeamId===teamId?match.awayTeamName:match.homeTeamName;
    if(opponentId&&opponentName)opponents.set(opponentId,opponentName);
    if(match.startsAt){
      const calendar=venueMatchLocalParts(match.startsAt,timeZone);
      years.add(calendar.year);months.add(calendar.month);weeks.add(calendar.week);
    }
  }
  const byName=(a:{id:string;name:string},b:{id:string;name:string})=>
    a.name.localeCompare(b.name)||a.id.localeCompare(b.id);
  return {
    competitions:[...competitions].map(([id,name])=>({id,name})).sort(byName),
    teams:[...opponents].map(([id,name])=>({id,name})).sort(byName),
    years:[...years].sort((a,b)=>b-a),
    months:[...months].sort((a,b)=>a-b),
    weeks:[...weeks].sort((a,b)=>a-b),
  };
}
export function teamMatchSelectRows(
  matches:readonly PublicTeamMatch[],teamId:string,phase:TeamMatchPhase,
  filter:VenueMatchFilters,timeZone:string,
  status:TeamMatchFilter="all",
):PublicTeamMatch[]{
  // Preserve the existing outcome/state filter, venue-style AND-filtering,
  // match-ordering and team identity guard in the existing helper.
  return teamMatchRows(matches,teamId,phase,status)
    .filter(match=>venueMatchFitsFilters(match,filter,timeZone));
}
