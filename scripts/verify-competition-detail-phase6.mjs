import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const stats=read("apps/mobile/src/lib/competition-detail-statistics.ts");
const sections=read("apps/mobile/src/components/competition/CompetitionProfileSections.tsx");
const navigation=read("apps/mobile/src/lib/competition-detail-navigation.ts");
const locales=read("packages/localization/src/index.ts");
for(const marker of ['match.status==="COMPLETED"||match.status==="CORRECTED"',
  'match.homeScore!==null&&match.awayScore!==null',
  'ids.has(match.homeTeamId)&&ids.has(match.awayTeamId)',
  'wins+draws+losses','recordedPlayers:recorded.length']){
  assert.ok(stats.includes(marker),"Missing official-stats validation: "+marker);
}
for(const marker of ["competitionTeamStatistics(competition)","competitionRecordedDiscipline(competition)",
  'testID="competition-team-stats"','testID="competition-fairplay-stats"',
  'competition.detail.phase6FairPlayScope','competition.detail.phase6OfficialScope',
  'competition.detail.phase6NoPlayerRecords','competition-stats-'+String.fromCharCode(36)+'{value}',
  '"/players/[playerId]"']){
  assert.ok(sections.includes(marker),"Missing phase 6 stats UX: "+marker);
}
assert.ok(navigation.includes('STATS:["TEAMS","PLAYERS","FAIR_PLAY"]'));
for(const key of ["phase6OfficialScope","phase6FairPlayScope","phase6NoPlayerRecords"]){
  assert.equal(locales.split('"competition.detail.'+key+'"').length-1,3,"Localization missing "+key);
}
console.log("Competition Detail Phase 6 stats, scope and translations verified.");
