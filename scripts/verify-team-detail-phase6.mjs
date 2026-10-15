import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const screen=read("apps/mobile/src/components/social/TeamDetailExperience.tsx");
const helper=read("apps/mobile/src/lib/team-detail-stats.ts");
const api=read("apps/api/src/modules/team/team-manager-phase3.routes.ts");
const apiTest=read("apps/api/test/team-manager-phase3.test.ts");
const test=read("scripts/tests/team-detail-stats.test.mjs");
for(const token of [
  'testID="team-stat-overview"','testID="team-recent-form"',
  'testID="team-verified-player-leaders"',
  'testID="team-stat-result-breakdown"',
  'testID={"team-stat-metric-"+metric}',
  'testID={"team-stat-player-"+player.userId}',
  'testID={"team-form-match-"+match.id}',
  'teamRecentForm(last,id)','teamPlayerLeaders(data.stats.players,statMetric)',
  'teamResultBreakdown(s)','safeTeamWinRate(s.winRate)',
  'setStatMetric("goals")',
  'formatCompetitionDateTime(match.startsAt,language)',
  'params:{competitionId:match.competitionId,matchId:match.id}',
  's.played>0?', 's.winRate', 's.goalDifference',
  'data.matches.length>=100','tx("statsSnapshot")',
  'accessibilityState={{selected:statMetric===metric}}',
])assert.ok(screen.includes(token),"Missing Team Detail Phase 6 mobile invariant: "+token);
for(const token of [
  'match.homeTeamId!==teamId&&match.awayTeamId!==teamId',
  'match.homeScore===null||match.awayScore===null',
  '["COMPLETED","CORRECTED"].includes(match.status)',
  'players].sort','slice(0,Math.max(0,Math.floor(limit)))',
  'Number.isFinite(percent)', 'Number.isFinite(stats.played)',
])assert.ok(helper.includes(token),"Missing verified stats calculation guard: "+token);
for(const token of [
  'aggregateCompletedMatches(statsGames,teamId)',
  'aggregatePublicPlayerStats(playerScores)',
  'eq(competitions.published,true)','eq(competitionTeams.status,"ACCEPTED")',
  'eq(playerProfiles.visibility,"PUBLIC")','eq(teamMemberships.status,"ACTIVE")',
  'eq(users.status,"ACTIVE")','inArray(competitionMatches.status,["COMPLETED","CORRECTED"])',
  'for(const metric of ["goals","assists","appearances"] as const)',
  'selected.set(player.userId,player)',
  '.slice(0,20)',
])assert.ok(api.includes(token),"Missing authoritative backend aggregation/privacy guard: "+token);
assert.ok(apiTest.includes("strongest verified assist/appearance leaders")&&
  test.includes("verified recent form rejects unrelated")&&
  test.includes("leaders genuinely order goals, assists and appearances"),
  "Missing backend privacy and stats sorting regression tests.");
for(const key of [
  "statsAllTime","statsGoalBalance","statsSnapshot","statsLastFive",
  "statsResultWins","statsResultDraws","statsResultLosses",
  "statsOpponent","statsMatchDetail","statsLeaderFilter","statsPlayerRanks",
  "statsLeaderNote","statsLimited","statsRankOf","statsNoForm",
])assert.equal(screen.split(key+":").length,4,
  "Missing EN/Dari/Pashto Phase 6 statistic wording: "+key);
console.log("Team Detail Phase 6 verified: all-time verified record, bounded form, triple-metric public leaderboard and privacy.");
