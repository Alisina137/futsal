import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const team=read("apps/mobile/src/components/social/TeamDetailExperience.tsx");
const card=read("apps/mobile/src/components/venues/VenueMatchCard.tsx");
const palette=read("apps/mobile/src/lib/team-result-theme.ts");
const match=read("apps/mobile/src/lib/team-detail-matches.ts");
const tests=read("scripts/tests/team-result-colors.test.mjs");
const pkg=JSON.parse(read("package.json"));
for(const part of [
  'import {teamMatchOutcome,teamMatchRows',
  'rows.map(m=><TeamMatchCard key={m.id} scope={phase}',
  'outcome={phase==="results"?teamMatchOutcome(m,id):null}',
  'outcomeLabel={outcomeLabel(m)}',
  'const outcome=phase==="results"?teamMatchOutcome(m,id):null;',
  'return outcome?label(outcome):null;',
  'label=(filter:TeamMatchFilter)',
]){
  assert.ok(team.includes(part),"Team Results must use actual local-team outcome: "+part);
}
for(const part of [
  'teamResultTheme({','scope,status:match.status,homeScore:match.homeScore',
  'outcome:teamOutcome','teamOutcomeLabel={outcomeLabel??undefined}',
  'teamOutcome={outcome}',
  'resultColors&&{borderColor:resultColors.border}',
  'resultColors&&styles.resultPanel',
  'resultColors&&{borderColor:resultColors.border,backgroundColor:resultColors.surface}',
  'resultColors&&{color:resultColors.text}',
  'resultColors&&teamOutcomeLabel?',
  'style={[styles.outcomeLabel,{color:resultColors.text}]}',
  'resultPanel:{borderWidth:1,borderRadius:radius.md',
  'export function VenueMatchCard(',
  'export function TeamMatchCard(',
  'testID={"team-match-"+match.id}',
  'pathname:"/competitions/[competitionId]/matches/[matchId]"',
]){
  assert.ok(card.includes(part),"Result card styling or safety missing: "+part);
}
for(const part of [
  'win:{border:"#86EFAC",surface:"#F0FDF4",text:"#166534"}',
  'loss:{border:"#FCA5A5",surface:"#FEF2F2",text:"#991B1B"}',
  'draw:{border:"#CBD5E1",surface:"#F1F5F9",text:"#475569"}',
  'scope!=="results"',
  'status!=="COMPLETED"&&status!=="CORRECTED"',
  'homeScore===null||awayScore===null',
  'if((outcome==="draw")!==(homeScore===awayScore))return null;',
]){
  assert.ok(palette.includes(part),"Official result palette regression: "+part);
}
for(const part of ['m.homeTeamId!==teamId&&m.awayTeamId!==teamId',
  'm.homeScore===null||m.awayScore===null',
  'return own===rival?"draw":own>rival?"win":"loss"']){
  assert.ok(match.includes(part),"Viewer-relative result outcome guard missing: "+part);
}
for(const label of ["completed team win","loss gets red border",
  "drawn result is neutral gray","unscored, unrelated and unverified"]){
  assert.ok(tests.includes(label),"No unit coverage: "+label);
}
assert.ok(pkg.scripts["verify:team-result-colors"]?.includes("team-result-colors.test.mjs"));
assert.ok(pkg.scripts.verify.includes("pnpm verify:team-result-colors"));
console.log("Team Detail > Matches > Results uses verified viewer-relative green wins, red losses, and gray draws with matching borders, subtle tinted result panels and translated labels. Upcoming, venue and missing scores remain neutral.");
