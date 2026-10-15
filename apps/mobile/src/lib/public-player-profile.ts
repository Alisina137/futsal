import type {PublicPlayerProfileDto} from "@leaguekick/contracts";
import type {TeamPublicHighlights} from "./api";

/** Public, finalized match figures only: team highlights already filter out
 * private profiles, non-active members and unpublished/non-finalized matches.
 * Never replace missing player records with fabricated 0-goal seasons. */
export type PublicPlayerVerifiedStat={
  teamId:string;appearances:number;goals:number;assists:number;
};
export type PublicPlayerVerifiedSummary={
  appearances:number;goals:number;assists:number;teamsWithStats:number;
};
export function publicPlayerVerifiedStats(
  player:Pick<PublicPlayerProfileDto,"userId"|"teams">,
  responses:ReadonlyArray<{teamId:string;stats:TeamPublicHighlights["stats"]}>,
):{teams:PublicPlayerVerifiedStat[];total:PublicPlayerVerifiedSummary|null}{
  const permitted=new Set(player.teams.map(team=>team.id));
  const seen=new Set<string>();
  const teams:PublicPlayerVerifiedStat[]=[];
  for(const item of responses){
    if(!permitted.has(item.teamId)||seen.has(item.teamId))continue;
    seen.add(item.teamId);
    const entry=item.stats.players.find(candidate=>candidate.userId===player.userId);
    if(!entry)continue;
    const valid=[entry.appearances,entry.goals,entry.assists]
      .every(value=>Number.isSafeInteger(value)&&value>=0);
    if(!valid||entry.appearances===0)continue;
    teams.push({
      teamId:item.teamId,appearances:entry.appearances,goals:entry.goals,assists:entry.assists,
    });
  }
  if(teams.length===0)return {teams,total:null};
  return {teams,total:teams.reduce<PublicPlayerVerifiedSummary>((total,item)=>({
    appearances:total.appearances+item.appearances,goals:total.goals+item.goals,
    assists:total.assists+item.assists,teamsWithStats:total.teamsWithStats+1,
  }),{appearances:0,goals:0,assists:0,teamsWithStats:0})};
}
