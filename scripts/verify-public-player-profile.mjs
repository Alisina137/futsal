import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const profile=read("apps/mobile/app/(app)/players/[playerId].tsx");
const source=read("apps/mobile/src/lib/public-player-profile.ts");
const repo=read("apps/api/src/modules/team/team.repository.ts");
const server=read("apps/api/src/modules/team/team-manager-phase3.routes.ts");
const locale=read("packages/localization/src/index.ts");
const client=read("apps/mobile/src/lib/api.ts");
const teamDetail=read("apps/mobile/src/components/social/TeamDetailExperience.tsx");
const pkg=JSON.parse(read("package.json"));
function includes(s,tokens,scope){
  for(const token of tokens)assert.ok(s.includes(token),scope+" missing: "+token);
}
includes(profile,[
  'testID="public-player-hero"',
  'testID="public-player-verified-stats"',
  'testID="public-player-teams"',
  'testID="public-player-primary-team"',
  'testID={"public-player-team-"+team.id}',
  'resolveMediaImageUrl(player.imageUrl)','resolveMediaImageUrl(team.logoUrl)',
  'style={styles.cover}','style={styles.avatarOuter}',
  'player.publicDisplayName','player.position',
  't(`teams.position.${player.position}` as never)',
  't(`teams.role.${team.role}` as never)',
  't("teams.currentTeams")',
  'router.push({pathname:"/teams/[teamId]",params:{teamId:team.id}})',
  'useFocusEffect(useCallback(()=>{',
  'const request=++generation.current',
  'setPlayer(null);setLoading(true);setError(null)',
  'if(result.player.userId!==id)throw',
  'if(generation.current!==request)return',
  'return()=>{generation.current++;}',
  'teamApi.publicPlayer(id)',
  'teamPublicApi.highlights(team.id)',
  'Promise.allSettled(',
  'publicPlayerVerifiedStats(result.player,ok)',
  'setStatsError(ok.length===0)',
  'verified.total?',
  't("publicPlayer.statsUnavailable")',
  't("publicPlayer.statsEmpty")',
  't("publicPlayer.statsExplanation")',
  'setRetry(value=>value+1)',
  'onPress={()=>router.push({pathname:"/teams/[teamId]",params:{teamId:firstTeam.id}})}',
], "Public Player profile hero / accessible real data");
includes(source,[
  'permitted=new Set(player.teams.map(team=>team.id))',
  'candidate.userId===player.userId',
  'Number.isSafeInteger(value)&&value>=0',
  'entry.appearances===0',
  'if(teams.length===0)return {teams,total:null}',
  'if(!permitted.has(item.teamId)||seen.has(item.teamId))continue',
], "Verified aggregation privacy");
includes(repo,['async getPublicPlayerProfile(','eq(playerProfiles.visibility, "PUBLIC")',
  'eq(users.status, "ACTIVE")','teams: await this.listPlayerTeams(userId, true)'],
"Existing public profile privacy contract");
includes(server,[
  'team.privacy==="PUBLIC"?','eq(competitions.published,true)',
  'inArray(competitionMatches.status,["COMPLETED","CORRECTED"])',
  'eq(playerProfiles.visibility,"PUBLIC")',
  'eq(teamMemberships.status,"ACTIVE")',
  'eq(users.status,"ACTIVE")',
], "Public team statistics backend evidence");
includes(client,['publicPlayer: (playerId: string)', 'teamPublicApi={',
  'highlights:(teamId:string)'], "Public-only APIs");
includes(teamDetail,['pathname:"/players/[playerId]"',
  'mayOpenPublicPlayer(player.userId,publicPlayerIds)'],"Team Squad secure entry point");
for(const key of [
  "title","represents","verifiedStats","appearances","goals","assists",
  "statsEmpty","statsUnavailable","statsLoading","statsExplanation",
  "unavailable","teamStats",
])assert.equal(locale.split('"publicPlayer.'+key+'"').length-1,3,
  "Missing English/Dari/Pashto player text: "+key);
assert.ok(pkg.scripts["verify:public-player-profile"]?.includes("public-player-profile.test.mjs"));
assert.ok(pkg.scripts.verify.includes("pnpm verify:public-player-profile"));
assert.ok(!profile.includes("fakeStats")&&!profile.includes("dummyPlayer"),
  "Do not render invented player records.");
console.log("Public player profile verified: modern hero, resolved images, current-team cards, verified-only stats, safe fallback/retry, locale, revalidation and privacy.");
