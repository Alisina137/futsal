import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const screen=read("apps/mobile/src/components/social/TeamDetailExperience.tsx");
const helper=read("apps/mobile/src/lib/team-detail-matches.ts");
const tests=read("scripts/tests/team-detail-matches.test.mjs");
for(const token of [
  'testID="team-match-list"','testID={"team-match-status-"+value}',
  'testID={"team-match-competition-"+cup.id}',
  'teamMatchRows(data.matches,id,phase,selected,competition)',
  'teamMatchCompetitions(data.matches,id,phase)',
  'teamMatchOutcome(m,id)','finished(m)&&m.homeScore!==null&&m.awayScore!==null',
  'formatCompetitionDateTime(m.startsAt,language)',
  'params:{competitionId:m.competitionId,matchId:m.id}',
  'params:{competitionId:m.competitionId}',
  'setMatchFilters({upcoming:"all",results:"all"})',
  'setMatchCompetitions({upcoming:"all",results:"all"})',
  'accessibilityState={{selected:selected===value}}',
])assert.ok(screen.includes(token),"Team match phase 4 invariant missing: "+token);
for(const key of ["matchAll","matchLive","matchScheduled","matchPostponed","matchWin",
  "matchDraw","matchLoss","matchCup","matchNoFilter","matchOpenCompetition",
  "matchSummary","matchUnknownScore"])
  assert.equal(screen.split(key+":").length,4,"Missing localized match key "+key);
assert.ok(helper.includes('m.homeTeamId!==teamId&&m.awayTeamId!==teamId'));
assert.ok(helper.includes('m.homeScore===null||m.awayScore===null'));
assert.ok(tests.includes('corrected counts as finished'));
console.log("Team Detail Phase 4 fixtures: truthful outcomes, filtering, localized labels and safe navigation.");
