import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const page=read("apps/mobile/src/components/social/TeamDetailExperience.tsx");
const pkg=JSON.parse(read("package.json"));
for(const fragment of [
  'testID="team-competitions-list"',
  'const phase=subs.competitions',
  'chosen.map(comp=>',
  '<CompetitionAction testID={"team-competition-view-"+comp.id}',
  '<CompetitionAction testID={"team-competition-matches-"+comp.id}',
  'label={tx("viewCompetition")} icon="eye-outline" primary rtl={isRTL}',
  'label={tx("compViewMatches")} icon="football-outline" rtl={isRTL}',
  'params:{competitionId:comp.id}})',
  'params:{competitionId:comp.id,tab:"MATCHES"}',
  'accessibilityRole="button"',
  'accessibilityLabel={label}',
  'numberOfLines={1}',
  'adjustsFontSizeToFit minimumFontScale={0.8}',
  'flexDirection:rtl?"row-reverse":"row"',
  'competitionActions:{width:"100%",alignItems:"stretch",gap:spacing.sm',
  'competitionAction:{flex:1,minWidth:0,minHeight:44,paddingVertical:6,paddingHorizontal:6',
  'competitionActionPrimary:{backgroundColor:colors.primary,borderColor:colors.primary}',
  'competitionActionSecondary:{backgroundColor:colors.primarySoft,borderColor:"#B9CEF8"}',
  'competitionActionLabel:{flexShrink:1,minWidth:0,fontSize:12,lineHeight:17,textAlign:"center"}',
  'competitionCard:{padding:12,gap:12,borderWidth:1,borderColor:colors.border}',
  'style={styles.competitionTitle}',
]){
  assert.ok(page.includes(fragment),"Competition CTA regression: "+fragment);
}
const section=page.slice(page.indexOf("function competitionsContent("),page.indexOf("function statsContent("));
assert.ok(section.includes('phase==="past"') && section.includes("chosen.map(comp=>"),
  "The compact actions must render in both Active and Past competition cards.");
assert.ok(!section.includes('style={styles.competitionButton}'),
  "Legacy responsive Button must not wrap competition labels again.");
assert.equal(page.split('viewCompetition:').length,4,
  "View Competition label must stay translated in English, Dari and Pashto.");
assert.equal(page.split('compViewMatches:').length,4,
  "View Matches label must stay translated in English, Dari and Pashto.");
assert.ok(pkg.scripts["verify:team-competition-actions"]?.includes("scripts/verify-team-competition-actions.mjs"));
assert.ok(pkg.scripts.verify.includes("pnpm verify:team-competition-actions"));
console.log("Team competitions: compact single-line View Competition / View Matches CTAs, lower padding/fonts, stable routes, 44px touch targets, RTL and three languages verified.");
