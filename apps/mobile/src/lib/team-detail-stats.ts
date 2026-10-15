import type {TeamPublicHighlights} from "./api";
import {teamMatchOutcome,type PublicTeamMatch} from "./team-detail-matches";

export type PlayerStatMetric="goals"|"assists"|"appearances";
export type PublicTeamPlayer=TeamPublicHighlights["stats"]["players"][number];
export type PublicTeamStats=TeamPublicHighlights["stats"];

export function verifiedTeamForm(matches:readonly PublicTeamMatch[],teamId:string,limit=5){
  return matches.filter(match=>teamMatchOutcome(match,teamId)!==null)
    .sort((a,b)=>{
      const left=a.startsAt?Date.parse(a.startsAt):NaN;
      const right=b.startsAt?Date.parse(b.startsAt):NaN;
      const x=Number.isFinite(left)?left:-Infinity;
      const y=Number.isFinite(right)?right:-Infinity;
      return y-x||a.id.localeCompare(b.id);
    }).slice(0,Math.max(0,limit)).map(match=>({
      match,outcome:teamMatchOutcome(match,teamId)!,
      scored:match.homeTeamId===teamId?match.homeScore!:match.awayScore!,
      conceded:match.homeTeamId===teamId?match.awayScore!:match.homeScore!,
    }));
}

export function rankedPublicPlayers(players:readonly PublicTeamPlayer[],metric:PlayerStatMetric){
  const other:PlayerStatMetric[]=metric==="goals"?["assists","appearances"]:
    metric==="assists"?["goals","appearances"]:["goals","assists"];
  return players.filter(player=>player.userId&&player.displayName&&
    [player.goals,player.assists,player.appearances].every(value=>
      Number.isInteger(value)&&value>=0))
    .sort((a,b)=>b[metric]-a[metric]||b[other[0]]-a[other[0]]||
      b[other[1]]-a[other[1]]||a.displayName.localeCompare(b.displayName)||
      a.userId.localeCompare(b.userId));
}

export function teamPerformanceDistribution(stats:PublicTeamStats){
  const played=Number.isFinite(stats.played)&&stats.played>0?stats.played:0;
  const wins=played?Math.min(played,Math.max(0,stats.wins)):0;
  const draws=played?Math.min(played-wins,Math.max(0,stats.draws)):0;
  const losses=played?Math.min(played-wins-draws,Math.max(0,stats.losses)):0;
  return {
    played,
    wins:{count:wins,percent:played?wins/played*100:0},
    draws:{count:draws,percent:played?draws/played*100:0},
    losses:{count:losses,percent:played?losses/played*100:0},
  };
}

export function isStatsConsistent(stats:PublicTeamStats){
  return Number.isInteger(stats.played)&&stats.played>=0&&
    [stats.wins,stats.draws,stats.losses,stats.goalsFor,stats.goalsAgainst].every(
      number=>Number.isInteger(number)&&number>=0)&&
    stats.wins+stats.draws+stats.losses===stats.played&&
    stats.goalsFor-stats.goalsAgainst===stats.goalDifference;
}
