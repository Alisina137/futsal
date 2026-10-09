import type { CompetitionMatchDto } from "./index";

export type LeagueFormResult="W"|"D"|"L";

/** Results for the most recent five scored, finalized league fixtures, oldest first. */
export function lastFiveLeagueResults(matches:CompetitionMatchDto[],teamId:string):LeagueFormResult[]{
  return matches.filter(match=>
    match.stage==="LEAGUE" &&
    (match.status==="COMPLETED"||match.status==="CORRECTED") &&
    match.homeScore!==null && match.awayScore!==null &&
    (match.homeTeamId===teamId||match.awayTeamId===teamId)
  ).sort((a,b)=>{
    // Prefer actual played dates. Round + slot give deterministic order for backfilled games.
    const timeCompare=(b.endsAt??b.startsAt??"").localeCompare(a.endsAt??a.startsAt??"");
    return timeCompare||b.roundNumber-a.roundNumber||b.slotNumber-a.slotNumber||b.id.localeCompare(a.id);
  }).slice(0,5).reverse().map(match=>{
    const home=match.homeTeamId===teamId;
    const scored=home?match.homeScore!:match.awayScore!;
    const conceded=home?match.awayScore!:match.homeScore!;
    return scored>conceded?"W":scored<conceded?"L":"D";
  });
}
