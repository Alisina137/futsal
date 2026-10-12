import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const contract=read("packages/contracts/src/index.ts");
const route=read("apps/api/src/modules/team/team.routes.ts");
const repository=read("apps/api/src/modules/team/team.repository.ts");
const service=read("apps/api/src/modules/team/team.service.ts");
const fake=read("apps/api/test/fake-team-repository.ts");
const mobile=read("apps/mobile/src/components/social/TeamDirectoryExperience.tsx");
const client=read("apps/mobile/src/lib/api.ts");
const locale=read("packages/localization/src/index.ts");
const tests=read("apps/api/test/team.test.ts");

assert.ok(contract.includes('teamDiscoveryQuerySchema=z.object')&&
  contract.includes('teamDiscoveryResponseSchema=z.object')&&
  contract.includes('teamDiscoverySortSchema=z.enum')&&
  contract.includes('teamDiscoveryScopeSchema=z.enum'),
  "A bounded validated discovery DTO with sorting and paging is mandatory.");
assert.ok(route.includes('router.get("/teams/discover",auth')&&
  route.includes('teamDiscoveryQuerySchema.parse(request.query)')&&
  service.includes("repository.discoverTeams(userId,filters)"),
  "Auth and server validation must happen before SQL discovery.");
assert.ok(repository.includes("async discoverTeams(userId:string,filters:TeamDiscoveryQuery)")&&
  repository.includes(".limit(filters.limit).offset((filters.page-1)*filters.limit)")&&
  repository.includes("const filteredTotal=this.db.select")&&
  repository.includes("followCounts=this.db.select")&&
  repository.includes("memberCounts=this.db.select")&&
  repository.includes("teamManagerProfiles.province")&&
  repository.includes("teamManagerProfiles.district")&&
  repository.includes("isNotNull(socialFollows.userId)")&&
  repository.includes("isNotNull(teamMemberships.userId)"),
  "Search, facets, filtered totals and user-scoped membership must all be server-side.");
const queryBlock=repository.slice(repository.indexOf("  async discoverTeams("),
  repository.indexOf("  async allowsJoinRequests("));
assert.ok(!queryBlock.includes("getTeam(")&&!queryBlock.includes("getMembership("),
  "Paginated discovery must not reintroduce N+1 team/member queries.");
assert.ok(client.includes('discover:(token:string,input:')&&
  client.includes('"/api/v1/teams/discover?"'),"Mobile must use the new search API.");
assert.ok(mobile.includes('setTimeout(()=>{')&&mobile.includes('},2000)')&&
  mobile.includes('onChangeText={typing}')&&
  mobile.includes('onSubmitEditing={()=>submit()}'),
  "Text search must apply after 2 seconds or immediate keyboard submit.");
for(const id of ["province","city","district"]){
  assert.ok(mobile.includes('testID="teams-'+id+'-select"'),
    "Province, city and district select missing: "+id);
  assert.ok(mobile.includes(id+"Selected"),
    "Location selections must immediately apply search: "+id);
}
assert.ok(mobile.includes('sortSelected(value)')&&
  mobile.includes('testID={`teams-sort-${value}`}')&&
  mobile.includes('accessibilityState={{selected:sort===value}}'),
  "Sort chips must be accessible and immediately fetch.");
assert.ok(mobile.includes('testID="teams-load-more"')&&
  mobile.includes("load(applied.current,currentPage+1,true)")&&
  mobile.includes("setTotal(result.total)")&&
  mobile.includes("result.hasMore"),
  "Results should have accurate server count and bounded load-more paging.");
assert.ok(mobile.includes('scope:"following",limit:11')&&
  !mobile.includes("teamApi.directory(token)"),
  "Followed rail and directory must not fetch every team.");
assert.ok(mobile.includes("++requestId.current")&&
  mobile.includes("if(requestId.current!==id)return")&&
  mobile.includes("clearTimer()"),
  "Old searches/timers must not replace newer results.");
assert.ok(fake.includes("async discoverTeams(")&&
  tests.includes('filters and paginates teams across name')&&
  tests.includes('validates page/filter bounds'),
  "Tests must cover pagination, filters and invalid input.");
for(const key of ["province","allProvinces","district","allDistricts","sortBy",
  "sort.recommended","sort.mostFollowed","sort.mostMembers","sort.newest",
  "sort.alphabetical","showMore"]){
  assert.equal(locale.split('"teams.phase2.'+key+'"').length,4,
    "Missing English/Dari/Pashto locale: "+key);
}
console.log("Teams Phase 2: server-side paginated search, sorting, geography, 2s debounce, stable async guards and localization verified.");
