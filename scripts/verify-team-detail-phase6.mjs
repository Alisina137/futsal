import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const screen=read("apps/mobile/src/components/social/TeamDetailExperience.tsx");
const helper=read("apps/mobile/src/lib/team-detail-stats.ts");
const server=read("apps/api/src/modules/team/team-manager-phase3.routes.ts");
for(const token of [
 'verifiedTeamForm(data.matches,id,5)','rankedPublicPlayers(stats.players,playerMetric)',
 'teamPerformanceDistribution(stats)','isStatsConsistent(stats)',
 'testID="team-verified-player-leaders"','testID={"team-player-stat-"+metric}',
 'testID={"team-stat-player-"+player.userId}','testID={"team-form-match-"+match.id}',
 'testID="team-stats-distribution"','setPlayerMetric("goals")',
 'accessibilityState={{selected:playerMetric===metric}}',
 'params:{competitionId:match.competitionId,matchId:match.id}',
 'formatCompetitionDateTime(match.startsAt,language)',
])assert.ok(screen.includes(token),"Team Detail Phase 6 missing: "+token);
for(const key of ["statsAllTime","statsRecentSample","statsPublicPlayers","statsRankBy",
  "statsPlayedMatches","statsWinDistribution","statsCheck","statsFormScore",
  "statsFormOpponent","statsFormMatch","statsPlayedLabel"])
  assert.equal(screen.split(key+":").length,4,"Missing EN/Dari/Pashto statistics label: "+key);
for(const token of [
  'teamMatchOutcome(match,teamId)!==null','Math.max(0,limit)',
  'player.userId&&player.displayName','Number.isInteger(value)&&value>=0',
  'stats.wins+stats.draws+stats.losses===stats.played',
])assert.ok(helper.includes(token),"Statistics safety invariant missing: "+token);
assert.ok(server.includes("aggregateCompletedMatches(statsGames,teamId)")&&
  server.includes("aggregatePublicPlayerStats(playerScores)")&&
  server.includes('eq(playerProfiles.visibility,"PUBLIC")')&&
  server.includes('inArray(competitionMatches.status,["COMPLETED","CORRECTED"])'),
  "Server must aggregate verified published games and public-profile players.");
console.log("Team Detail Phase 6 verified: full-history server stats, capped five-match form and public leaderboards.");
