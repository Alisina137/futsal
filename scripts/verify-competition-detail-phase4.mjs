import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const section=read("apps/mobile/src/components/competition/CompetitionProfileSections.tsx");
const bracket=read("apps/mobile/src/components/competition/CompetitionKnockoutBracket.tsx");
const graph=read("apps/mobile/src/lib/competition-detail-standings.ts");
const table=read("apps/mobile/src/components/competition/LeagueStandingsTable.tsx");
const page=read("apps/mobile/app/(app)/competitions/[competitionId].tsx");
const loc=read("packages/localization/src/index.ts");
const nav=read("apps/mobile/src/lib/competition-detail-navigation.ts");
for(const marker of [
  'competition-phase5-standings',
  'competition-bracket-round-selector',
  'bracket-round-${round}',
  'bracket-match-detail-${match.id}',
  'bracket-next-match-${match.id}',
  'CompetitionKnockoutBracket competition={competition}',
  'competition-group-selector',
  'competition-group-option-${key}',
  'competition-provisional-group-${group.key}',
  'provisionalQualificationZone(group,competition.qualifiersPerGroup)',
  'competitionStandingGroups(competition.standings',
  'onStageChange?.(option)',
  'competition.format==="LEAGUE"?"LEAGUE":"GROUP"',
  'competition.format==="GROUP_KNOCKOUT"?competition.qualifiersPerGroup??undefined',
  '<LeagueStandingsTable competition={competition}',
  'testID={`competition-stage-${option}`}',
])assert.ok(section.includes(marker),"Standings regression: "+marker);
for(const marker of [
  'testID="competition-phase4-visual-bracket"',
  'testID="competition-visual-bracket-scroll"',
  'competition-visual-round-${column.round}',
  'competition-visual-match-${match.id}',
  'competition-visual-advanced-${match.id}',
  'knockoutRoundColumns(competition.matches)',
  'verifiedKnockoutConnections(competition.matches)',
  'pathname:"/competitions/[competitionId]/matches/[matchId]"',
  'finished(match)&&match.homeScore!==null&&match.awayScore!==null',
  'competition.detail.bracketNotProjected',
  'flexDirection:isRTL?"row-reverse":"row"',
])assert.ok(bracket.includes(marker),"Visual knockout UI regression: "+marker);
for(const marker of [
  'match.status==="COMPLETED"||match.status==="CORRECTED"',
  'm.homeScore===null||m.awayScore===null',
  'm.winnerTeamId!==m.homeTeamId&&m.winnerTeamId!==m.awayTeamId',
  'next.roundNumber>=m.roundNumber',
  'nextTeam!==m.winnerTeamId',
  'row.position<=places',
])assert.ok(graph.includes(marker),"Never fabricate qualification or promotion: "+marker);
for(const marker of [
  'lastFiveLeagueResults(', 'stage,','testID="league-pinned-team-column"',
  'testID="league-scrollable-stats"','testID="group-qualification-legend"',
])assert.ok(table.includes(marker),"Fixed official league table regression: "+marker);
assert.ok(page.includes("onStandingsStageChange={onStandingsStageChange}")&&
  page.includes('allowedCompetitionSubtabs("STANDINGS",competition?.format??"LEAGUE")')&&
  nav.includes('format==="KNOCKOUT"?["KNOCKOUT"]'),
  "Stage navigation must synchronize with format-aware public profile navigation.");
for(const key of ["bracketTitle","bracketHint","bracketFinal","matchNumber",
  "officialAdvance","homeSide","awaySide","bracketNotProjected","allGroups",
  "groupTeamCount","provisionalZone"]){
  assert.equal(loc.split('"competition.detail.'+key+'"').length-1,3,
    "Missing EN/Dari/Pashto translation "+key);
}
console.log("Competition Detail Phase 4 release gate: verified real progression, provisional groups, seven-tab sync, standings privacy and RTL.");
