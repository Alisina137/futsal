import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
const read=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const directory=read("apps/mobile/src/components/social/TeamDirectoryExperience.tsx");
const card=read("apps/mobile/src/components/social/SocialDirectoryCard.tsx");
const tile=read("apps/mobile/src/components/social/SocialFollowedTile.tsx");
const contract=read("packages/contracts/src/index.ts");
const repo=read("apps/api/src/modules/team/team.repository.ts");
const fake=read("apps/api/test/fake-team-repository.ts");
const tests=read("apps/api/test/team-join-request-actions.test.ts");
const locale=read("packages/localization/src/index.ts");
assert.ok(directory.includes('testID="teams-followed-strip"')&&
  directory.includes('testID="teams-followed-carousel"')&&
  directory.includes("followed.slice(0,10)")&&
  directory.includes('testID="teams-followed-more"')&&
  directory.includes('"/teams/following"'),
  "Followed rail must retain ten tiles and route remaining teams to Show More.");
assert.ok(directory.includes('testID="teams-quick-access"')&&
  directory.includes('testID="teams-most-followed-button"')&&
  directory.includes('testID="teams-my-teams-button"')&&
  directory.includes('testID="teams-invitations-shortcut"'),
  "Three direct access shortcuts must exist outside Followed Teams.");
assert.ok(directory.includes('testID="teams-search-panel"')&&
  directory.includes('testID="teams-city-select"')&&
  directory.includes('testID="teams-name-search"')&&
  directory.includes('t("teams.search")')&&
  directory.includes('onSubmitEditing={()=>submit()}'),
  "Phase 1 must keep existing team search, city selection and search submission operational.");
assert.ok(directory.includes("useWindowDimensions()")&&
  directory.includes('windowWidth>=720')&&
  directory.includes('twoColumns&&styles.itemGrid')&&
  directory.includes('testID="teams-results-grid"')&&
  directory.includes('resultsGrid:{flexWrap:"wrap"')&&
  directory.includes('itemGrid:{width:"48.5%"'),
  "Directory results must use responsive one/two column wrapping.");
assert.ok(card.includes('statusLabel?:string')&&
  card.includes('statusTone?:"success"|"warning"|"muted"')&&
  card.includes('badge?<View style=')&&
  tile.includes('memberCountLabel?:string'),
  "Cards must display membership/status chips and followed tiles must show roster counts.");
assert.ok(contract.includes('allowJoinRequests:z.boolean()')&&
  repo.includes("allowJoinRequests:await this.allowsJoinRequests(row.id)")&&
  fake.includes("allowJoinRequests:await this.allowsJoinRequests(team.id)"),
  "Server must provide actual team-manager join policy instead of guessing.");
assert.ok(directory.includes('joinRequestStatus==="PENDING"')&&
  directory.includes('!team.allowJoinRequests')&&
  directory.includes('t("teams.invitationOnly")')&&
  directory.includes('team.myMembershipRole')&&
  directory.includes('teamApi.requestJoin(token,id)'),
  "Joined, pending, invitation-only and available actions must be mutually exclusive.");
assert.ok(directory.includes('testID="teams-refresh-results"')&&
  directory.includes('testID="teams-results-section"')&&
  directory.includes("setRetry(v=>v+1)")&&
  directory.includes("DataLoadingState")&&
  directory.includes('t("teams.phase1.clearFilters")'),
  "Loading, errors, empty results, refresh and filter reset must be accessible.");
assert.ok(directory.includes('session?.user.roles.includes("TEAM_MANAGER")')&&
  directory.includes('"/teams/create"'),
  "Only eligible managers can access team creation shortcut; entitlement check stays server-side.");
assert.ok(tests.includes('returns truthful invitation-only and membership status in the directory')&&
  tests.includes('TEAM_REQUESTS_DISABLED')&&
  tests.includes('joinRequestStatus:"PENDING"'),
  "Integration tests must guard invitation-only and pending join states.");
for(const key of ["invitationOnly","phase1.followedSubtitle","phase1.viewFollowing",
  "phase1.quickAccess","phase1.quickSubtitle","phase1.findTeams","phase1.searchSubtitle",
  "phase1.managerHint","phase1.exploreTeams","phase1.resultsCount",
  "phase1.browseSubtitle","phase1.refresh","phase1.clearFilters"]){
  assert.equal(locale.split('"teams.'+key+'"').length,4,
    "Missing EN/Dari/Pashto Teams Phase 1 localization: "+key);
}
console.log("Teams Phase 1 directory redesign: structure, responsive cards, true membership states, quick actions, localization and regression coverage verified.");
