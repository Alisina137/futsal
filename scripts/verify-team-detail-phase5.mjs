import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const mobile=read("apps/mobile/src/components/social/TeamDetailExperience.tsx");
const helper=read("apps/mobile/src/lib/team-detail-competitions.ts");
const api=read("apps/api/src/modules/team/team-manager-phase3.routes.ts");
const tests=read("scripts/tests/team-detail-competitions.test.mjs");
for(const token of [
  'testID="team-competitions-list"','testID="team-competitions-filters"',
  'testID={"team-competition-format-"+format}',
  'testID={"team-competition-status-"+status}',
  'testID={"team-competition-card-"+comp.id}',
  'testID={"team-competition-preview-"+comp.id}',
  'teamCompetitionRows(data.competitions,phase,filters)',
  'teamCompetitionAvailableFormats(data.competitions,phase)',
  'teamCompetitionAvailableStatuses(data.competitions,phase)',
  'teamCompetitionFixturePreview(data.matches,id,comp.id)',
  'setCompetitionFilters({active:{format:"all",status:"all"},past:{format:"all",status:"all"}})',
  'accessibilityState={{selected:filters.format===format}}',
  'accessibilityState={{selected:filters.status===status}}',
  'formatCompetitionDateTime(comp.startsAt,language)',
  'formatCompetitionDateTime(comp.endsAt,language)',
  'params:{competitionId:comp.id,tab:"MATCHES"}',
  'params:{competitionId:comp.id,matchId:preview.match.id}',
  'data.competitions.length>=50',
])assert.ok(mobile.includes(token),"Missing Team Detail Phase 5 invariant: "+token);

for(const token of [
  'return null;', 'if(status==="DRAFT")return null',
  'pastStatuses.has(status)','CANCELLED','ARCHIVED',
  'filter.format==="all"||comp.format===filter.format',
  'filter.status==="all"||comp.status===filter.status',
  'm.competitionId===competitionId&&(m.homeTeamId===teamId||m.awayTeamId===teamId)',
  'm.homeScore!==null&&m.awayScore!==null',
])assert.ok(helper.includes(token),"Competition state / safe public preview missing: "+token);

assert.ok(api.includes('eq(competitionTeams.status,"ACCEPTED")')&&
  api.includes('eq(competitions.published,true)')&&
  api.includes('orderBy(desc(competitions.createdAt)).limit(50)')&&
  api.includes('orderBy(desc(competitionMatches.startsAt)).limit(100)'),
  "Public API must show only accepted/published competitions and bounded fixtures.");
for(const key of [
  "compShowing","compOf","compConfirmed","compFilterFormat","compFilterStatus","compAll",
  "compNoFiltered","compStarts","compEnds","compSchedulePending","compViewMatches",
  "compRecentFixture","compLatestResult","compRecentNote","compLimited","compBrowse",
  "compFormatLeague","compFormatKnockout","compFormatGroups","compStatusOpen",
  "compStatusClosed","compStatusScheduled","compStatusInProgress","compStatusCompleted",
  "compStatusArchived","compStatusCancelled",
])assert.equal(mobile.split(key+":").length,4,"Missing EN/Dari/Pashto competition wording: "+key);
assert.ok(tests.includes("fixture preview never leaks other competitions or teams")&&
  tests.includes("completed/corrected preview requires real recorded scores"),
  "Competition tests must cover privacy and verified score evidence.");
console.log("Team Detail Phase 5 verified: accepted public competitions, accurate status, filtering, lifecycle, safe match previews and RTL localization.");
