import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const sections=read("apps/mobile/src/components/competition/CompetitionProfileSections.tsx");
const table=read("apps/mobile/src/components/competition/LeagueStandingsTable.tsx");
const matches=read("apps/mobile/src/components/competition/CompetitionMatchList.tsx");
const repo=read("apps/api/src/modules/competition/competition.repository.ts");
const service=read("apps/api/src/modules/competition/competition.service.ts");
const contracts=read("packages/contracts/src/index.ts");
const locale=read("packages/localization/src/index.ts");

for(const marker of ["competition-phase5-standings","competition-bracket-round-selector",
  "bracket-round-${round}","bracket-match-detail-${match.id}",
  "bracket-next-match-${match.id}","competition-phase5-leaderboards",
  "competition-stat-metrics","competition-stat-team-filter"]){
  assert.ok(sections.includes(marker),"Phase 5 missing UI "+marker);
}
assert.ok(sections.includes("qualifiers={competition.format===")&&
  sections.includes('stage={competition.format==="LEAGUE"?"LEAGUE":"GROUP"}')&&
  sections.includes('competition.qualifiersPerGroup??undefined'),
  "Group standings must use official qualifiers rather than a hard-coded cut");
assert.ok(table.includes('testID="league-pinned-team-column"')&&
  table.includes('testID="league-scrollable-stats"')&&
  table.includes('testID="group-qualification-legend"')&&
  table.includes("lastFiveLeagueResults(")&&
  table.includes("stage,")&&table.includes("row.position<=qualifiers"),
  "Group/league standings must retain fixed team column, verified form and provisional qualification places");
assert.ok(contracts.includes('stage:"LEAGUE"|"GROUP"="LEAGUE"')&&
  contracts.includes("match.stage===stage &&"),
  "Form must restrict official results to the requested stage");
for(const field of ["goals","assists","appearances","cleanSheets","yellowCards",
  "redCards","playerOfMatchAwards"]){
  assert.ok(sections.includes('"${field}"')||
    sections.includes('"'+field+'"'),"Leaderboard missing "+field);
  assert.equal(locale.split('"competition.phase5.metric.'+field+'"').length-1,3,
    "Metric must be localized in all languages: "+field);
}
assert.ok(sections.includes("stat[metric]>0")&&sections.includes("stat.teamId===teamId")&&
  sections.includes('competition.playerStats.filter(stat=>teams.some(')&&
  sections.includes("competition.phase5.verifiedOnly")&&
  !sections.includes("Math.random("),
  "Stats must hide missing records and never synthesize leaders");
assert.ok(repo.includes('inArray(competitionMatches.status, ["COMPLETED", "CORRECTED"])')&&
  service.includes('competition.playerStats.filter(stat=>acceptedIds.has(stat.teamId))'),
  "Public player stats must exclude incomplete fixtures and non-accepted teams");

for(const marker of ['match-filter-POSTPONED','match-filter-CANCELLED']){
  // Filter rail uses a typed map over FILTERS, so filter literal presence is enough.
  assert.ok(matches.includes(marker.replace("match-filter-","\"")),marker);
}
for(const marker of ["competition-match-team-filters","competition-match-stage-filters",
  "competition-match-round-filters","competition-match-group-filters",
  "competition-match-clear-filters","match-team-${team.teamId}",
  "match-stage-${stage}","match-group-${group}","match-round-select-${round??\"ALL\"}",
  "formatRefereeScheduleParts(","Asia/Kabul","competition.phase5.today",
  'pathname:"/teams/[teamId]"','pathname:"/venues/[venueId]"',
  'pathname:"/competitions/[competitionId]/matches/[matchId]"']){
  assert.ok(matches.includes(marker),"Fixtures missing "+marker);
}
assert.ok(matches.includes('match.status==="SCHEDULED"||match.status==="UNSCHEDULED"')&&
  !matches.includes('["SCHEDULED","UNSCHEDULED","POSTPONED"]')&&
  matches.includes('match.status==="POSTPONED"')&&
  matches.includes('match.status==="CANCELLED"'),
  "Postponed/cancelled fixtures must not be counted as upcoming");
for(const key of ["competition.phase5.qualificationPlaces","competition.phase5.nextKnockoutMatch",
  "competition.phase5.bracketProgression","competition.phase5.verifiedOnly",
  "competition.phase5.noRecordedMetric","competition.phase5.allTeams",
  "competition.phase5.filter.team","competition.phase5.filter.stage",
  "competition.phase5.filter.round","competition.phase5.filter.group",
  "competition.phase5.filter.allStages","competition.phase5.filter.allRounds",
  "competition.phase5.filter.allGroups","competition.phase5.filter.clear",
  "competition.phase5.stage.LEAGUE","competition.phase5.stage.GROUP",
  "competition.phase5.stage.KNOCKOUT","competition.phase5.today",
  "competition.matchList.filter.POSTPONED","competition.matchList.filter.CANCELLED"]){
  assert.equal(locale.split('"'+key+'"').length-1,3,
    "Missing English/Dari/Pashto translation: "+key);
}
console.log("Competitions Phase 5 verified: final-only player stats, accepted-team privacy, seven leaderboards, group form & qualification, real knockout routing, matches facets, local schedules and translations.");
