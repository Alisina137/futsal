import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const panel=read("apps/mobile/src/components/team-manager/TeamGrowthPanel.tsx");
const helper=read("apps/mobile/src/lib/team-manager-analytics.ts");
const route=read("apps/api/src/modules/team/team-manager-phase3.routes.ts");
const api=read("apps/mobile/src/lib/api.ts");
const locale=read("packages/localization/src/index.ts");
for(const marker of [
  'testID="tm7-analytics"','testID="tm7-filters"','testID="tm7-competition-select"',
  'testID="tm7-season-select"','testID="tm7-range-select"',
  'testID="tm7-performance"','testID="tm7-distribution"',
  'testID="tm7-players"','testID="tm7-player-search"','testID="tm7-trends"',
  'testID="tm7-history"','scopedTeamAnalytics(analytics,team.id,analyticsFilters)',
  'rankTeamPlayers(scoped?.players??data?.stats.players??[],statMetric)',
  'statCompetition==="ALL"&&statSeason==="ALL"&&statRange==="ALL"',
  'setStatSection("PERFORMANCE");setStatCompetition("ALL")',
  'analytics?','tm7.updateRequired','tr("officialStatsHint")','tr("rewardCaution")',
])assert.ok(panel.includes(marker),"Phase 7 dashboard missing: "+marker);
for(const marker of [
  'isFinal(m)','m.homeTeamId===teamId||m.awayTeamId===teamId',
  'kabulDay(m.startsAt).slice(0,4)','ids.has(row.matchId)',
  'm.status==="COMPLETED"||m.status==="CORRECTED"','match.startsAt&&Number.isFinite(Date.parse(match.startsAt))',
  'trend.slice(0,10)','goalDifference:goalsFor-goalsAgainst',
  'winRate:matches.length?Math.round(wins*100/matches.length):0',
])assert.ok(helper.includes(marker),"Phase 7 verified analytics logic missing: "+marker);
for(const marker of [
  'await this.access(userId,teamId)',
  'matchId:competitionMatches.id','startsAt:competitionMatches.startsAt',
  'id:competitionMatches.id','competitionId:competitions.id',
  'analytics:{','matches:matches.filter(m=>["COMPLETED","CORRECTED"].includes(m.status)',
  'm.homeScore!==null&&m.awayScore!==null',
  'players:playerStats.filter(p=>["COMPLETED","CORRECTED"].includes(p.matchStatus))',
])assert.ok(route.includes(marker),"Phase 7 authenticated server analytics missing: "+marker);
assert.ok(api.includes('analytics?:TeamAnalyticsDetails'),"Older API compatibility missing");
const keys=["title","verifiedOnly","competition","allCompetitions","season","allSeasons",
  "dateRange","allDates","range.D30","range.D90","range.D365","clearFilters",
  "updateRequired","trends","resultDistribution","noVerifiedMatches",
  "titlesAllTime","searchPlayer","rankBy","metric.GOALS","metric.ASSISTS",
  "metric.APPEARANCES","playersFound","playerScopeHint","recentForm","noDatedMatches",
  "result.WIN","result.DRAW","result.LOSS","short.WIN","short.DRAW","short.LOSS",
  "unknownCompetition","trendsHint","historyPeriodHint"];
for(const key of keys)assert.equal(locale.split('"tm7.'+key+'"').length-1,3,
  "Phase 7 missing EN/Dari/Pashto translation: "+key);
console.log("Team Manager Phase 7 source checks passed: server verified rows, filters, trends, player ranking, history, fallback and trilingual UX.");
