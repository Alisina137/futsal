import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const screen=read("apps/mobile/src/components/social/TeamDetailExperience.tsx");
const client=read("apps/mobile/src/lib/api.ts");
const manager=read("apps/mobile/src/components/team-manager/TeamManagerDashboard.tsx");
const pkg=JSON.parse(read("package.json"));

const heroStart=screen.indexOf('<View style={styles.profileCard}>');
const heroEnd=screen.indexOf('<View style={styles.tabContainer}>',heroStart);
assert.ok(heroStart>=0&&heroEnd>heroStart,"Public team hero is missing");
const hero=screen.slice(heroStart,heroEnd);
for(const token of [
  '<View testID="team-profile-cover"',
  'cover?<Image source={{uri:cover}} resizeMode="cover"',
  'style={StyleSheet.absoluteFill}',
  'testID="team-header-share"',
  'style={styles.identity}',
  'style={styles.teamName}>{team.name}</AppText>',
  'profile?.description',
  'team.rosterCount',
  'displayTeamFollowerCount(followState?.followerCount)',
  'testID="team-header-actions"',
  'testID="team-header-shortcuts"',
]){
  assert.ok(hero.includes(token),"Team cover-only hero lost existing content: "+token);
}
assert.ok(!hero.includes("team.logoUrl")&&!hero.includes("styles.teamLogo"),
  "Hero must not show team logo image or overlapping avatar initials.");
assert.ok(!hero.includes("team.name.slice(0,2).toUpperCase()"),
  "Hero must not show generated initials profile circle.");
assert.ok(!screen.includes("teamLogo:{height:84")&&!screen.includes("marginTop:-40"),
  "Remove unused overlapping profile-circle styles from team detail.");
assert.ok(screen.includes(
  'identity:{alignItems:"center",gap:spacing.sm,padding:spacing.md,paddingTop:spacing.md}'),
  "Resting team title should have natural spacing below the cover.");
assert.ok(screen.includes("styles.avatarEmpty")&&screen.includes("styles.playerAvatar"),
  "Squad player avatars should not be removed by the team hero change.");
assert.ok(client.includes("coverImageUrl:string|null")&&
  manager.includes('testID="team-cover-settings"'),
  "Manager cover upload and public background persistence remain unchanged.");
assert.ok(pkg.scripts["verify:team-cover-only-hero"]?.includes("verify-team-cover-only-hero.mjs"));
assert.ok(pkg.scripts.verify.includes("pnpm verify:team-cover-only-hero"));
console.log("Team Detail hero verified: cover image only, no team logo avatar/initials circle, natural title spacing, existing actions, player portraits and manager cover settings retained.");
