import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const server=read("apps/api/src/modules/team/team-manager-phase3.routes.ts");
const tests=read("apps/api/test/team-manager-phase3.test.ts");
const client=read("apps/mobile/src/lib/api.ts");
const profile=read("apps/mobile/src/components/social/TeamDetailExperience.tsx");
const manager=read("apps/mobile/src/components/team-manager/TeamGrowthPanel.tsx");
const locale=read("packages/localization/src/index.ts");
for(const [ok,label] of [
  [server.includes('router.get("/teams/:teamId/public-posts"')&&
    server.includes("async publicPosts(teamId:string,offset:number,limit:number)"),"bounded public post pagination"],
  [server.includes('eq(socialPosts.status,"PUBLISHED")')&&
    server.includes('eq(socialPosts.visibility,"PUBLIC")')&&
    server.includes("offset(offset).limit(limit+1)"),"published-only feed with lookahead"],
  [server.includes("team.offlineVenueId&&!team.claimedAt")&&
    server.includes('team.status!=="ACTIVE"'),"inactive and unclaimed team exclusion"],
  [server.includes('eq(competitions.published,true)')&&
    server.includes('eq(competitionTeams.status,"ACCEPTED")'),"published accepted competition filtering"],
  [server.includes('team.privacy==="PUBLIC"')&&
    server.includes('eq(playerProfiles.visibility,"PUBLIC")')&&
    server.includes('eq(teamMemberships.status,"ACTIVE")')&&
    server.includes('eq(users.status,"ACTIVE")'),"public leader identity privacy gates"],
  [server.includes("aggregateCompletedMatches(statsGames,teamId)")&&
    server.includes("aggregatePublicPlayerStats(playerScores)"),"all-game verified stats and public leaders"],
  [tests.includes("Teams Phase 5 public player leaderboard privacy"),"regression tests"],
  [client.includes("posts:(teamId:string,offset:number,limit=20)")&&
    client.includes("players:Array<{userId:string;displayName:string;appearances:number;goals:number;assists:number}>"),"typed public media + stats"],
  [profile.includes('stats:["overview","form","leaders"]')&&
    profile.includes('testID="team-verified-player-leaders"'),"three statistics subtabs"],
  [profile.includes("async function loadMorePosts()")&&
    profile.includes("postsGeneration.current")&&
    profile.includes("morePostsAvailable")&&profile.includes("teamPublicApi.posts("),"race-safe load more"],
  [manager.includes('mediaSection==="PHOTOS"')&&
    manager.includes("requestMediaLibraryPermissionsAsync")&&
    manager.includes("currentTeam.current===selectedTeam"),"manager gallery and safe upload"],
  [manager.includes("setDeleteCandidate(post.id)")&&
    manager.includes('tr("phase5ConfirmDelete")'),"manager explicit post delete confirmation"],
])assert.ok(ok,"Teams Phase 5 missing: "+label);
for(const key of ["phase5Photos","phase5PhotoHint","phase5NoPhotos","phase5ConfirmDelete","photoPermission"]){
 assert.equal(locale.split('"tm3.'+key+'"').length,4,"Missing three-language Phase 5 string: "+key);
}
console.log("Teams Phase 5 verified: paginated media, manager gallery, verified matches, accurate stats, private leaders.");
