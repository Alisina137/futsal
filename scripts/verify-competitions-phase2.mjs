import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const contracts=read("packages/contracts/src/index.ts");
const repo=read("apps/api/src/modules/competition/competition.repository.ts");
const routes=read("apps/api/src/modules/competition/competition.routes.ts");
const service=read("apps/api/src/modules/competition/competition.service.ts");
const mobile=read("apps/mobile/src/components/social/CompetitionDirectoryExperience.tsx");
const api=read("apps/mobile/src/lib/api.ts");
const locales=read("packages/localization/src/index.ts");
for(const key of ["competitionDiscoveryQuerySchema","competitionDiscoveryResponseSchema",
 "competitionDiscoverySortSchema","competitionDiscoveryScopeSchema"]){
 assert.ok(contracts.includes(key),"Missing typed competition discovery contract: "+key);
}
assert.ok(routes.includes('router.get("/competitions/discover",')&&
 routes.includes('router.get("/competitions/discover/private",auth,')&&
 service.includes("async discoverPublic(")&&
 repo.includes("async discoverPublicCompetitions("),
 "Public and authenticated user-scoped competition discovery endpoints required");
for(const anchor of ['eq(competitions.published,true)','ne(competitions.status,"DRAFT")',
 'ne(competitions.status,"CANCELLED")','eq(venues.province,filters.province)',
 'eq(venues.city,filters.city)','ilike(competitions.name,literal)',
 'ilike(venues.name,literal)','ilike(venues.city,literal)',
 'eq(competitions.format,filters.format)','eq(competitions.status,filters.status)',
 'gte(competitions.startsAt,','lt(competitions.startsAt,',
 'gte(competitions.registrationFeeAfn,filters.minFee)',
 'lte(competitions.registrationFeeAfn,filters.maxFee)',
 'eq(socialFollows.entityType,"VENUE")','eq(teamMemberships.status,"ACTIVE")',
 'eq(socialFollows.entityType,"COMPETITION")',
 '.limit(filters.limit).offset((filters.page-1)*filters.limit)',
 'hasMore:filters.page*filters.limit<total']){
 assert.ok(repo.includes(anchor),"Discovery SQL must enforce: "+anchor);
}
assert.ok(repo.includes(String.raw`filters.q.replace(/[\\%_]/g,"\\$&")`),
 "Literal search must escape SQL LIKE wildcards");
assert.ok(repo.includes('eq(socialPosts.status,"PUBLISHED")')&&
 repo.includes("inArray(socialPosts.entityId,rows.map(row=>row.competition.id))"),
 "Directory media must be fetched only for current page from published posts");
for(const marker of ['testID="competition-province-select"',
 'testID="competition-status-select"','testID="competition-format-select"',
 'testID="competition-fee-select"','testID="competition-status-select"',
 'testID="competition-start-from"','testID="competition-start-to"',
 'testID="competition-min-fee"','testID="competition-max-fee"',
 'testID="competitions-advanced-filters"']){
 assert.ok(mobile.includes(marker),"Mobile filter missing: "+marker);
}
assert.ok(mobile.includes("setTimeout(()=>{timer.current=null;submit(value);},2000)")&&
 mobile.includes("},300)")&&mobile.includes("++requestId.current")&&
 mobile.includes("if(requestId.current!==id)return"),
 "Two-second search, 300ms suggestion debounce, and stale response guard required");
assert.ok(mobile.includes("setProvince(value);")&&
 mobile.includes('province:value,city:""')&&
 !mobile.includes('testID="competition-city-select"')&&
 !mobile.includes("function pickCity(")&&
 mobile.includes("load(applied.current,currentPage+1,true)")&&
 mobile.includes("setHasMore(result.hasMore)"),
 "Province-only location selector, immediate filters and server Show More required");
assert.ok(api.includes('path.startsWith("/api/v1/competitions/discover")'),
 "Live competition discovery must bypass offline GET cache");
assert.ok(mobile.includes("followed.slice(0,10)")&&
 mobile.includes("followedTotal>MAX_FOLLOWED")&&
 mobile.includes('scope:"following" as const'),
 "Followed rail must use independent bounded server discovery");
for(const key of ["competition.phase2.province","competition.phase2.city",
 "competition.phase2.allFormats","competition.phase2.anyFee",
 "competition.phase2.minimumFee","competition.phase2.maximumFee",
 "competition.phase2.startsFrom","competition.phase2.startsTo",
 "competition.phase2.sort.feeLow","competition.phase2.invalidFilters"]){
 assert.equal(locales.split('"'+key+'"').length-1,3,"Missing EN/Dari/Pashto localization: "+key);
}
console.log("Competitions Phase 2 verified: server query/filters/sorts, published-only privacy, paginated results, scoped discovery, 2s search and three locales.");
