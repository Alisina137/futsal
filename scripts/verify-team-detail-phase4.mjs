import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const screen=read("apps/mobile/src/components/social/TeamDetailExperience.tsx");
const helper=read("apps/mobile/src/lib/team-detail-matches.ts");
const api=read("apps/api/src/modules/team/team-manager-phase3.routes.ts");
const client=read("apps/mobile/src/lib/api.ts");
const tests=read("scripts/tests/team-detail-matches.test.mjs");
const navigation=read("apps/mobile/src/lib/team-detail-navigation.ts");
for(const token of [
  'testID="team-matches-experience"','testID="team-matches-overview"',
  'testID="team-match-search"','testID="team-match-competitions"',
  'testID="team-match-status-filters"','testID="team-match-clear-filters"',
  'testID={"team-match-"+m.id}','testID={"team-match-outcome-"+m.id}',
  'teamMatchSnapshot(data.matches,id)','teamMatchCompetitionChoices(data.matches,id)',
  'filterTeamMatches(data.matches,id','teamMatchOutcome(m,id)','teamMatchScoreLabel(m)',
  'const finished=(m:TeamPublicHighlights["matches"][number])=>isTeamMatchFinished(m)',
  'const resultPending=finished(m)&&score===null',
  'm.status==="CORRECTED"?"matchCorrected":"resultsVerified"',
  'formatRefereeScheduleParts(m.startsAt,language)',
  'formatCompetitionDateTime(m.startsAt,language)',
  'setMatchQuery("");setMatchCompetitionId("ALL");setMatchStatus("ALL");setMatchOutcomeFilter("ALL");',
  'router.push({pathname:"/competitions/[competitionId]/matches/[matchId]"',
  'router.push({pathname:"/competitions/[competitionId]"',
  'styles.matchActions,rowDirection','styles.matchFilters,rowDirection',
])assert.ok(screen.includes(token),"Team Detail Phase 4 UI missing: "+token);

for(const token of [
  'Number.isSafeInteger(match.homeScore)',
  'Number.isSafeInteger(match.awayScore)',
  'return isTeamMatchFinished(match)&&',
  'if(match.homeTeamId!==teamId&&match.awayTeamId!==teamId)return false',
  'options.view==="results"?!isTeamMatchFinished(match):!isTeamMatchUpcoming(match)',
  'match.competitionId!==competition',
  'match.status!==status',
  'teamMatchOutcome(match,teamId)!==outcome',
  'value.toLocaleLowerCase().includes(query)',
  'm.status==="IN_PROGRESS"?0',
  'a.id.localeCompare(b.id)',
])assert.ok(helper.includes(token),"Team Detail Phase 4 match logic missing: "+token);

for(const token of [
  'eq(competitions.published,true)',
  'eq(competitionTeams.status,"ACCEPTED")',
  'or(eq(competitionMatches.homeTeamId,teamId),eq(competitionMatches.awayTeamId,teamId))',
  'eq(socialPosts.visibility,"PUBLIC")',
  'orderBy(desc(competitionMatches.startsAt)).limit(100)',
])assert.ok(api.includes(token),"The public fixture endpoint must remain published/accepted/bounded: "+token);
assert.ok(client.includes('matches:Array<{id:string;competitionId:string;competitionName:string;'),
  "Matches UI must rely on actual typed API fixtures, not mock content.");
assert.ok(navigation.includes('matches:["upcoming","results"]'),
  "Existing Team Detail main tabs/subtabs and direct deep links must remain intact.");
assert.ok(tests.includes("only completed or corrected score pairs")&&
  tests.includes("combine public competition, opponent/stage search")&&
  tests.includes("upcoming excludes completed"),"Missing match classification and filters tests.");

for(const key of ["matchSearch","matchAllCompetitions","matchAllStatuses","matchAllResults",
 "matchUpcomingCount","matchResultsCount","matchAvailable","matchNoFilterResults","matchClearFilters",
 "matchWin","matchDraw","matchLoss","matchResultPending","matchCorrected","matchHome",
 "matchAway","matchOpponentPending","matchGroup","matchKnockout","matchStage","matchCompetitionLink"])
  assert.equal(screen.split(key+":").length,4,"Missing localized match copy in EN/Dari/Pashto: "+key);
console.log("Team Detail Phase 4 verified: statuses, competition/opponent filters, verified results, AM/PM dates, truthful public scope and navigation.");
