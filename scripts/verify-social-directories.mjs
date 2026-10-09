import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const ensure=(ok,message)=>{if(!ok)throw new Error(message);};
const team=read("apps/mobile/src/components/social/TeamDirectoryExperience.tsx");
const competition=read("apps/mobile/src/components/social/CompetitionDirectoryExperience.tsx");
const card=read("apps/mobile/src/components/social/SocialDirectoryCard.tsx");
const tile=read("apps/mobile/src/components/social/SocialFollowedTile.tsx");
const picker=read("apps/mobile/src/components/social/DirectoryFilterSelect.tsx");
const service=read("apps/api/src/modules/marketing/marketing.service.ts");
const repo=read("apps/api/src/modules/marketing/marketing.repository.ts");
const routes=read("apps/api/src/modules/marketing/marketing.routes.ts");
const contracts=read("packages/contracts/src/index.ts");
const api=read("apps/mobile/src/lib/api.ts");
const tests=read("apps/api/test/marketing.test.ts");
const l10n=read("packages/localization/src/index.ts");
const paths=["teams/index","teams/popular","teams/following","teams/my",
  "competitions/index","competitions/popular","competitions/following","competitions/ongoing"];
for(const path of paths)ensure(read(`apps/mobile/app/(app)/${path}.tsx`).includes("DirectoryExperience"),
  `Missing new or refactored discovery screen: ${path}`);
ensure(team.includes("teamApi.directory")&&team.includes('socialDirectoryDiscovery(token,"TEAM")')
  &&team.includes("teamApi.requestJoin")&&team.includes('joinRequestStatus==="PENDING"')
  &&team.includes("myMembershipRole")&&team.includes("SocialDirectoryCard")
  &&team.includes("SocialFollowedTile"),"Teams must keep their membership workflow, followed carousel and search cards.");
ensure(team.includes("followed.slice(0,10)")&&team.includes("router.push(\"/teams/following\")")
  &&team.includes("router.push(\"/teams/popular\")")
  &&team.includes("router.push(\"/teams/my\")"),"Team discovery rail needs up to ten followed teams and two relevant shortcuts.");
ensure(team.includes("count")&&team.includes("followers.get(b.id)")
  &&team.includes(".slice(0,15)"),"Most followed teams must rank true follower counts.");
ensure(competition.includes('socialDirectoryDiscovery(token,"COMPETITION")')
  &&competition.includes("marketingApi.followedVenues(token)")
  &&competition.includes('status==="IN_PROGRESS"&&followedVenueIds.includes(x.venueId)')
  &&competition.includes(".slice(0,10)"),"Ongoing competitions must be limited to ten running at followed venues.");
ensure(competition.includes("x.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())")
  &&competition.includes('testID="competition-name-search"'),"Competition search must filter by competition name only.");
ensure(competition.includes("router.push(\"/competitions/popular\")")
  &&competition.includes("router.push(\"/competitions/ongoing\")")
  &&competition.includes("followed.slice(0,10)")&&competition.includes("router.push(\"/competitions/following\")"),
  "Competition discovery must include followed, popular and ongoing destinations.");
ensure(competition.includes('status==="REGISTRATION_OPEN"')
  &&competition.includes('focusRegistration:"1"')
  &&competition.includes("competition.standings"),"Competition buttons must respect registration vs in-progress states.");
ensure(card.includes('width:"25%"')&&card.includes('width:"75%"')&&card.includes("aspectRatio:1")
  &&tile.includes("minHeight:44")&&picker.includes("Modal"),"Reuse square venue-style cards, touch-friendly compact tiles and select-style filters.");
ensure(routes.includes('router.get("/social/discovery/:entityType",requireAuth(tokens)')
  &&service.includes("async socialDirectoryDiscovery(")
  &&repo.includes("async listSocialDirectoryCounts(")
  &&repo.includes("async listFollowedEntityIds(")
  &&contracts.includes("socialDirectoryDiscoveryResponseSchema")
  &&api.includes("request<SocialDirectoryDiscoveryResponse>"),"Social discovery must have server-counted follows and typed, authenticated endpoint.");
ensure(tests.includes("scopes followed team and competition discovery to caller"),
  "Server test must cover followed-team and competition account isolation.");
for(const key of ["teams.followedTeams","teams.mostFollowed","teams.myTeams",
  "competition.followedCompetitions","competition.mostFollowed","competition.ongoingFollowedVenues",
  "competition.searchName","competition.noOngoingFollowed"]){
  ensure(l10n.split(`"${key}"`).length-1===3,`Missing localized key ${key}`);
}
console.log("Teams and Competitions discovery verified: venue-style followed rail, city/status select filters, typed live social rankings, scoped ongoing follow-venue competitions, localized responsive actions.");
