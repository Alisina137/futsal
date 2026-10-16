import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const page=read("apps/mobile/app/(app)/competitions/[competitionId].tsx");
const sections=read("apps/mobile/src/components/competition/CompetitionProfileSections.tsx");
const nav=read("apps/mobile/src/lib/competition-detail-navigation.ts");
const pkg=JSON.parse(read("package.json"));
function has(source,parts,scope){
  for(const part of parts)assert.ok(source.includes(part),scope+" missing "+part);
}
has(page,[
  'activeTab!=="MATCHES"&&(activeTab!=="STANDINGS"||availableSubtabs.length>1)',
  'testID="competition-profile-subtabs"',
  'availableSubtabs.map(key=><Pressable',
  'activeTab==="STATS"?',
  'onMatchRefresh={()=>void refreshCompetitionPublic()}',
  'matchRefreshing={refreshingPublic}',
  'const refreshCompetitionPublic=useCallback(async(silent=false)=>{',
  'publicRefreshBusy.current',
  'onPress={()=>void refreshCompetitionPublic()}',
  'refreshingPublic?t("competition.detail.refreshing"):t("competition.detail.refresh")',
], "Competition tabs / refresh ownership");
has(nav,[
  'if(main==="STANDINGS")return format==="LEAGUE"?["LEAGUE"]:',
  'format==="KNOCKOUT"?["KNOCKOUT"]:["GROUPS","KNOCKOUT"]',
  'return available.includes(current.sub[main]??"")',
], "Format-aware standings sub-navigation");
has(sections,[
  'function CompetitionStandings({competition,initialStage,onStageChange,onRefresh,refreshing=false}',
  'testID="competition-phase5-standings"',
  'SectionHeading title={t(mixed?"competition.profile.stages":"competition.standings")}',
  'action={<Pressable testID="competition-table-refresh"',
  'accessibilityLabel={t("competition.detail.refreshMatches")}',
  'accessibilityState={{disabled:refreshing}}',
  'disabled={refreshing||!onRefresh} onPress={onRefresh}',
  'style={[styles.standingsRefresh,{flexDirection:isRTL?"row-reverse":"row"}]}',
  'refreshing?t("competition.detail.refreshing"):t("competition.detail.refresh")',
  'standingsRefresh:{minHeight:44',
  'onRefresh={onMatchRefresh} refreshing={matchRefreshing}',
  '<LeagueStandingsTable competition={competition}',
  'CompetitionKnockoutBracket competition={competition}',
  'onStageChange?.(option)',
], "Standings title-inline refresh / all format content");
const afterReturn=sections.slice(sections.indexOf('return <View style={styles.stack} testID="competition-phase5-standings"'));
assert.ok(afterReturn.indexOf('SectionHeading title=')<afterReturn.indexOf('competition-stage-${option}'),
  "Refresh must appear on the standings heading, not beneath the stage tabs.");
assert.ok(pkg.scripts["verify:competition-standings-header"]?.includes("verify-competition-standings-header.mjs"));
assert.ok(pkg.scripts.verify.includes("pnpm verify:competition-standings-header"));
console.log("Competition Standings verified: hide single League/Knockout subtab, preserve mixed-format stage tabs and place working refresh beside title; Stats keeps own refresh.");
