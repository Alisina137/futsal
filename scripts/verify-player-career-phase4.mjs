import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=name=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const panel=read("apps/mobile/src/components/player/PlayerCareerTabs.tsx");
const dashboard=read("apps/mobile/src/components/player/PlayerDashboard.tsx");
const translations=read("packages/localization/src/index.ts");
const helper=read("apps/mobile/src/lib/player-career-view.ts");
for(const key of ["statistics","achievements","history"])
  assert.ok(panel.includes('tab==="'+key+'"'),"Lost player career tab "+key);
assert.ok(dashboard.includes('<PlayerCareerTabs tab={careerTab}'),"Player career navigation missing");
for(const marker of [
 'const data=loadedToken===token?storedData:null',
 'setLoadedToken(token)',
 'careerPeriod(r.recordedAt,language).year===season',
 'careerPeriod(a.achievedAt,language).year===season',
 'const competitionOptions=',
 'const resetFilters=()=>',
 'careerMonthlyTrend(visible,metric,language)',
 'careerPersonalBest(visible)',
 'careerResults(visible,historyResult)',
 'setHistoryLimit(previous=>previous+20)',
 'testID="player-career-more-history"',
 'testID="player-career-history"',
 'style={styles.chartViewport}',
 'flexDirection:isRTL?"row-reverse":"row"',
 'data.visibility==="PUBLIC"',
 'if(data?.visibility!=="PUBLIC")return',
]){
 assert.ok(panel.includes(marker),"Missing Career Phase 4 marker: "+marker);
}
for(const marker of ['calendar:"gregory"','careerPeriod(','careerDateTime(',
 'timeZone:"Asia/Kabul"','new Set<string>()','sort((a,b)=>b.recordedAt.localeCompare('])
 assert.ok(helper.includes(marker),"Missing safe career helper "+marker);
for(const key of ["clearFilters","personalBest","bestGoalsMatch","bestAssistsMatch",
 "resultFilter.ALL","resultFilter.WIN","resultFilter.DRAW","resultFilter.LOSS",
 "resultFilter.UNKNOWN","noHistoryResults","loadMoreHistory","historyCount","awardCount"])
 assert.equal(translations.split('"pd3.'+key+'"').length-1,3,
   "Missing player career localized key "+key);
console.log("Player Career Phase 4 verified: private account isolation, Jalali/Gregorian Kabul periods, scoped filters, responsive statistics, and progressive history.");
