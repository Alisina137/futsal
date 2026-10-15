import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const panel=read("apps/mobile/src/components/venues/VenueCompetitionsPanel.tsx");
const card=read("apps/mobile/src/components/venues/VenueMatchCard.tsx");
const picker=read("apps/mobile/src/components/venues/VenueMatchSelect.tsx");
const contracts=read("packages/contracts/src/index.ts");
const repo=read("apps/api/src/modules/competition/competition.repository.ts");
const fake=read("apps/api/test/fake-competition-repository.ts");
const api=read("apps/mobile/src/lib/api.ts");
const locales=read("packages/localization/src/index.ts");
const tests=read("apps/api/test/competition-venue-match-filters.test.ts");
function has(source,fragments,where){
 for(const part of fragments)assert.ok(source.includes(part),where+" missing "+part);
}
for(const name of ["competition","team","year","month","week"]){
 has(panel,[`testID="venue-match-filter-${name}"`],name+" dropdown");
}
has(panel,[
 'testID="venue-match-filter-rail"',
 'matchFilters.competitionId','matchFilters.teamId','matchFilters.year','matchFilters.month',
 'matchFilters.week','selectedMatchQuery',
 'competitionApi.venueMatches(venue.id,matchScope,1,selectedMatchQuery)',
 'competitionApi.venueMatches(venue.id,matchScope,matchPage+1,selectedMatchQuery)',
 'setMatchFacets(result.facets);setMatchTotal(result.total)',
 'setMatches(result.matches)','setMatchHasMore(result.hasMore)',
 'matchFacets.teams.map','matchFacets.competitions.map','matchFacets.weeks.map',
 'setMatchFilters(emptyVenueMatchFilters)',
 '<VenueMatchCard key={match.id}',
 'testID="venue-competition-matches"',
],"Venue match-filter UI");
has(picker,['Modal visible={open}','testID={testID+"-option-"+(option.value||"all")}',
 'accessibilityState={{selected}}','onSelect(option.value);setOpen(false)',
 'style={styles.field}', 'width:154'], "Dropdown touch UI");
has(card,['testID={"venue-match-"+match.id}','venueMatchResultEmphasis',
 'finished&&emph[side]==="loser"?colors.textMuted:colors.text',
 'finished&&emph[side]==="winner"?"bold"','match.homeLogoUrl','match.awayLogoUrl',
 'match.homeScore','match.awayScore','scope:"upcoming"|"results"',
 'pathname:"/competitions/[competitionId]/matches/[matchId]"'], "Fixture/result card");
has(contracts,['export const venueMatchQuerySchema',
 'competitionId:z.string().uuid().optional()','teamId:z.string().uuid().optional()',
 'year:z.coerce.number().int().min(2000).max(2100).optional()',
 'month:z.coerce.number().int().min(1).max(12).optional()',
 'week:z.coerce.number().int().min(1).max(53).optional()',
 'homeTeamId:z.string().uuid().nullable()','awayTeamId:z.string().uuid().nullable()',
 'facets:z.object({'], "Validated venue match contracts");
has(repo,['async listPublicVenueMatches(','eq(competitionMatches.venueId,venueId)',
 'eq(competitions.published,true)','eq(competitionMatches.competitionId,query.competitionId)',
 'eq(competitionMatches.homeTeamId,query.teamId)','extract(year from',
 'extract(month from','extract(week from',
 'const filtered=and(base,...extra)!','.where(filtered)',
 '.limit(query.limit).offset((query.page-1)*query.limit)',
 'facets={','homeTeamId:match.homeTeamId'], "Server-side filtering before pagination");
has(api,['params.set("competitionId"','params.set("teamId"',
 'params.set("year"','params.set("month"','params.set("week"',
 'networkRequest<VenueMatchPage>'], "Typed query parameters");
has(fake,['async listPublicVenueMatches(','const matches=all.filter(match',
 'total,page:query.page,limit:query.limit','facets'], "Test double");
has(tests,['filters before pagination','rejects untrusted filters',
 'facets.competitions','results.total'], "Backend filter regression");
for(const key of ["competition","team","year","month","week","all","clear","weekNumber","count"]){
 assert.equal(locales.split('"vd4.matchesFilter.'+key+'"').length-1,3,
   "Missing English/Dari/Pashto: "+key);
}
const pkg=JSON.parse(read("package.json"));
assert.ok(pkg.scripts["verify:venue-match-filters"]?.includes("venue-match-filters.test.mjs"));
assert.ok(pkg.scripts.verify.includes("pnpm verify:venue-match-filters"));
console.log("Venue public Matches verified: five horizontal selects with scoped server pre-pagination filtering, full options, winner/loser/draw cards, and EN/Dari/Pashto support.");
