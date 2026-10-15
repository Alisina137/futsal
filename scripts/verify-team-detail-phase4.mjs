import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const screen=read("apps/mobile/src/components/social/TeamDetailExperience.tsx");
const helper=read("apps/mobile/src/lib/team-detail-matches.ts");
const tests=read("scripts/tests/team-detail-matches.test.mjs");
const cards=read("apps/mobile/src/components/venues/VenueMatchCard.tsx");
const selector=read("apps/mobile/src/components/venues/VenueMatchSelect.tsx");

for(const token of [
  'testID="team-match-list"','testID={"team-match-status-"+value}',
  'testID="team-match-filter-rail"',
  'testID="team-match-filter-competition"','testID="team-match-filter-team"',
  'testID="team-match-filter-year"','testID="team-match-filter-month"',
  'testID="team-match-filter-week"',
  'teamMatchRows(data.matches,id,phase)',
  'teamMatchSelectRows(data.matches,id,phase,faceted,AFGHANISTAN_TIME_ZONE,selected)',
  'teamMatchSelectFacets(data.matches,id,phase,AFGHANISTAN_TIME_ZONE)',
  'setMatchSelectFilters({upcoming:{...emptyVenueMatchFilters},results:{...emptyVenueMatchFilters}})',
  'setMatchFilters({upcoming:"all",results:"all"})',
  'accessibilityState={{selected:selected===value}}',
  'rows.map(m=><TeamMatchCard key={m.id}',
  'm.homeTeamId===id?team?.name??m.homeTeamName:m.homeTeamName',
  'm.awayTeamId===id?team?.name??m.awayTeamName:m.awayTeamName',
  'missingScoreLabel={tx("matchUnknownScore")}',
])assert.ok(screen.includes(token),"Team match phase 4 invariant missing: "+token);
for(const key of ["matchAll","matchLive","matchScheduled","matchPostponed","matchWin",
  "matchDraw","matchLoss","matchCup","matchNoFilter","matchOpenCompetition",
  "matchSummary","matchUnknownScore"])
  assert.equal(screen.split(key+":").length,4,"Missing localized match key "+key);
for(const part of [
  'export function TeamMatchCard(', 'testID={"team-match-"+match.id}',
  'venueMatchResultEmphasis(', 'match.homeLogoUrl', 'match.awayLogoUrl',
  'match.homeScore', 'match.awayScore',
  'finished&&emph[side]==="winner"?"bold"',
  'finished&&emph[side]==="loser"?colors.textMuted',
  'pathname:"/competitions/[competitionId]/matches/[matchId]"',
])assert.ok(cards.includes(part),"Shared fixture scorecard missing "+part);
assert.ok(selector.includes("Modal visible={open}"),"Venue-style selector must remain a real dropdown.");
assert.ok(helper.includes('m.homeTeamId!==teamId&&m.awayTeamId!==teamId'));
assert.ok(helper.includes('m.homeScore===null||m.awayScore===null'));
assert.ok(tests.includes('corrected counts as finished'));
console.log("Team Detail Phase 4 fixtures: truthful outcomes, filtering, localized labels and safe navigation.");
