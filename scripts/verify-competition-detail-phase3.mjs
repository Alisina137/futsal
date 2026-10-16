import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const page=read("apps/mobile/app/(app)/competitions/[competitionId].tsx");
const fixtures=read("apps/mobile/src/components/competition/CompetitionMatchList.tsx");
const sections=read("apps/mobile/src/components/competition/CompetitionProfileSections.tsx");
const helper=read("apps/mobile/src/lib/competition-detail-match-filters.ts");
const locale=read("packages/localization/src/index.ts");
for(const marker of [
 'const refreshCompetitionPublic=useCallback(async(silent=false)=>{',
 'actor!==lastActorIdentity.current||generation!==loadGeneration.current',
 'current?.id===fresh.id?fresh:current',
 'setInterval(()=>void refreshScore(),25000)',
 '"HOME","MATCHES","STANDINGS","STATS"',
 'AppState.currentState!=="active"',
 'setMatchPreferences(emptyCompetitionMatchPreferences)',
 'setExtraMatchStatus(null)',
 'onMatchStatusChange={onMatchStatusChange}',
 'onMatchPreferencesChange={setMatchPreferences}',
 'onMatchRefresh={()=>void refreshCompetitionPublic()}',
 'matchRefreshing={refreshingPublic}',
 'testID="competition-table-refresh"',
 'testID="competition-profile-subtabs"',
])assert.ok(page.includes(marker),"Competition Phase 3 polling/navigation missing: "+marker);
for(const marker of [
 'testID="competition-match-filter-summary"',
 'testID="competition-match-refresh"',
 'testID="competition-my-team-fixtures"',
 'testID="competition-match-date-filters"',
 'testID="competition-match-select-date"',
 'testID="competition-match-empty-reset"',
 'testID="competition-match-clear-filters"',
 'matchFitsPreferences(match,currentPreferences)',
 'onPrimaryFilterChange?.(next)',
 'onPreferencesChange(next)',
 'formatRefereeScheduleParts(',
 'Asia/Kabul',
 'match.status==="IN_PROGRESS"',
 'match.status==="COMPLETED"||match.status==="CORRECTED"',
 'match.status==="SCHEDULED"||match.status==="UNSCHEDULED"',
 'pathname:"/competitions/[competitionId]/matches/[matchId]"',
])assert.ok(fixtures.includes(marker),"Competition Phase 3 fixture UI missing: "+marker);
for(const marker of [
 'preferences={matchPreferences}',
 'onPreferencesChange={onMatchPreferencesChange}',
 'onPrimaryFilterChange={onMatchStatusChange}',
 'myAcceptedTeamId={myAcceptedTeamId}',
])assert.ok(sections.includes(marker),"Competition Phase 3 prop mismatch: "+marker);
for(const marker of [
 'timeZone:"Asia/Kabul"',
 'formatToParts(',
 'matchFitsDatePreset(match.startsAt,prefs.date,now)',
 'eq(playerProfiles.visibility',
])if(marker!=='eq(playerProfiles.visibility')
  assert.ok(helper.includes(marker),"Kabul date filter correctness: "+marker);
for(const key of ["matchFilterSummary","matchFilterHint","refreshMatches","refresh","refreshing",
  "dateFilter","myTeamMatches"])
  assert.equal(locale.split('"competition.detail.'+key+'"').length-1,3,"Missing localized "+key);
for(const key of ["ALL","TODAY","TOMORROW","NEXT_7_DAYS"])
  assert.equal(locale.split('"competition.detail.date.'+key+'"').length-1,3,"Missing date locale "+key);
console.log("Competition Detail Phase 3: match status, Kabul calendar, filters, live polling and safe refresh verified.");
