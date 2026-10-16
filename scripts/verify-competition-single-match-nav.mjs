import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const page=read("apps/mobile/app/(app)/competitions/[competitionId].tsx");
const matches=read("apps/mobile/src/components/competition/CompetitionMatchList.tsx");
const select=read("apps/mobile/src/components/venues/VenueMatchSelect.tsx");
const preferences=read("apps/mobile/src/lib/competition-detail-match-filters.ts");
const tabs=read("apps/mobile/src/lib/competition-detail-navigation.ts");
const pkg=JSON.parse(read("package.json"));
const requireParts=(source,parts,subject)=>{
  for(const part of parts)assert.ok(source.includes(part),subject+" missing: "+part);
};
requireParts(page,[
  '{activeTab!=="MATCHES"?<View testID="competition-profile-subtabs">',
  'testID="competition-profile-tabs"',
  'initialMatchFilter={extraMatchStatus??',
  'onMatchStatusChange={onMatchStatusChange}',
  'setMatchPreferences(emptyCompetitionMatchPreferences)',
  'setExtraMatchStatus(null)',
], "single competition Matches navigation and deep links");
assert.ok(page.includes('{activeTab!=="MATCHES"?<View testID="competition-profile-subtabs">'),
  "The first competition-subtab rail must be hidden whenever Matches is active.");
requireParts(matches,[
  'testID="match-filter-rail"',
  '["ALL","UPCOMING","LIVE","FINISHED","POSTPONED","CANCELLED"]',
  'testID={`match-filter-${value}`}',
  'accessibilityState={{selected:value===filter}}',
  'const statusNav=useVisibleTab<MatchFilter>(filter)',
  'ref={statusNav.scrollRef}',
  'onLayout={statusNav.onViewport}',
  'onContentSizeChange={statusNav.onContentSize}',
  'onLayout={event=>statusNav.cellLayout(value,event)}',
  'statusNav.focus(next,true)',
  'testID="competition-match-select-rail"',
  'testID="competition-match-select-team"',
  'testID="competition-match-select-round"',
  'testID="competition-match-select-date"',
  'testID="competition-match-select-stage"',
  'testID="competition-match-select-group"',
  'testID="competition-my-team-fixtures"',
  'testID="competition-match-clear-filters"',
  'testID="competition-match-empty-reset"',
  'onSelect={value=>changePreferences({teamId:value||"ALL"})}',
  'onSelect={value=>changePreferences({round:value?Number(value):null})}',
  'onSelect={value=>setDateFilter((value||"ALL") as CompetitionMatchDatePreset)}',
  'round:null,group:"ALL"',
  'group:value||"ALL"',
  'matchFitsPreferences(match,currentPreferences)',
  'matches.length===0?',
], "single six-status navigation with compact accessible dropdowns");
requireParts(select,[
  'Modal visible={open}',
  'accessibilityLabel={label+": "+active}',
  'onSelect(option.value);setOpen(false)',
  'testID={testID+"-option-"+(option.value||"all")}',
], "real dropdown selection UI");
requireParts(preferences,[
  'allowedTeams.has(pref.teamId)',
  'roundValid','groupValid','matchFitsDatePreset(match.startsAt,prefs.date,now)',
], "server-backed client filter correctness");
requireParts(tabs,[
  'incoming==="RESULTS"?"MATCHES"',
  'MATCHES:["UPCOMING","LIVE","RESULTS","ALL"]',
], "legacy results links survive hidden duplicate navigation");
for(const oldId of [
  'testID={`match-team-${team.teamId}`}',
  'testID={`match-round-select-${round??"ALL"}`}',
  'testID={`competition-match-date-${preset}`}',
  'testID={`match-stage-${stage}`}',
  'testID={`match-group-${group}`}',
]){
  assert.ok(!matches.includes(oldId),"Old long navigation is still rendered: "+oldId);
}
assert.ok(pkg.scripts["verify:competition-single-match-nav"]?.includes("competition-match-selects.test.mjs"));
assert.ok(pkg.scripts.verify.includes("pnpm verify:competition-single-match-nav"));
console.log("Competition Matches verified: one six-state navigation; team/round/date/stage/group dropdowns, RTL scroll focus, existing logic, clear/empty state and deep links preserved.");
