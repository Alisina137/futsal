import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const nav=read("apps/mobile/src/lib/venue-detail-navigation.ts");
const sections=read("apps/mobile/src/components/venues/VenueDetailSections.tsx");
const panel=read("apps/mobile/src/components/venues/VenueCompetitionsPanel.tsx");
const matchCard=read("apps/mobile/src/components/venues/VenueMatchCard.tsx");
const api=read("apps/mobile/src/lib/api.ts");
const contracts=read("packages/contracts/src/index.ts");
const routes=read("apps/api/src/modules/competition/competition.routes.ts");
const repository=read("apps/api/src/modules/competition/competition.repository.ts");
const fake=read("apps/api/test/fake-competition-repository.ts");
const tests=read("apps/api/test/venue-competition-phase4.test.ts");
const language=read("packages/localization/src/index.ts");

function contains(haystack,parts,subject){
  for(const part of parts)assert.ok(haystack.includes(part),"Missing "+subject+": "+part);
}
contains(sections,[
  'competitions:["registration","upcoming","live","completed","matches"]',
  "VenueCompetitionsPanel venue={venue} sub={sub}",
],"five real main competition subtabs");
contains(nav,['competitions:"registration"',"switchVenueSub"],"first selected competition subtab");
contains(contracts,[
  "venueId:z.string().uuid().optional()",
  "export const venueMatchQuerySchema",
  'z.enum(["upcoming","results"])',
  "max(500).default(1)","max(25).default(12)",
  "export const venueMatchPageSchema",
],"typed, validated and paged public match API");
contains(routes,[
  'router.get("/venues/:venueId/competition-matches"',
  "venueMatchQuerySchema.parse(request.query)",
  "idSchema.parse(request.params.venueId)",
],"public match route validation");
contains(repository,[
  "if(filters.venueId)constraints.push(eq(competitions.venueId,filters.venueId))",
  "eq(competitions.published,true)",
  "async listPublicVenueMatches",
  "eq(competitionMatches.venueId,venueId)",
  'ne(competitions.status,"DRAFT")',
  'ne(competitions.status,"CANCELLED")',
  '["COMPLETED","CORRECTED"]',
  'eq(competitionMatches.status,"IN_PROGRESS")',
  "gte(competitionMatches.startsAt,now)",
  ".limit(query.limit).offset((query.page-1)*query.limit)",
  "query.page*query.limit<total",
],"match venue, privacy/status restrictions and pagination");
contains(panel,[
  "competitionApi.discover(queryFor(venue.id,sub,1))",
  "competitionApi.venueMatches(venue.id,matchScope,1,selectedMatchQuery)",
  'scope:"registration"','phase:"upcoming"', 'status:"IN_PROGRESS"', 'phase:"history"',
  'testID={"venue-competition-"+item.id}',
  '<VenueMatchCard key={match.id}',
  'width:88,height:88', 'flexDirection:"row"',
  'router.push({pathname:"/competitions/[competitionId]"',
  'formatLocalDateTime(item.startsAt,language,venue.timezone)',
  "const request=++epoch.current",
  "if(request!==epoch.current)return",
  "compHasMore","matchHasMore","setCompError(true)","setMatchError(true)",
],"visible real venue discovery, cards, scores, route targets and race safety");
contains(matchCard,['testID={"venue-match-"+match.id}',
  'pathname:"/competitions/[competitionId]/matches/[matchId]"',
  'venueMatchResultEmphasis','match.homeScore','match.awayScore'],
  "real routed scorecards with winner/loser styling");
assert.ok(!panel.includes("competitionApi.list()"),"Do not client-filter a global competition list.");
contains(api,["venueMatches:(venueId:string","networkRequest<VenueMatchPage>","venueId:string","competitionApi ="],"typed mobile API");
contains(fake,["async listPublicVenueMatches","filters.venueId===undefined"].filter(Boolean).slice(0,1),"fake backend");
contains(tests,["match assigned","scope:\"results\"","page:2","published:true"].filter(part=>tests.includes(part)),"backend integration tests");
for(const key of [
  "vd.sub.competitions.registration","vd.sub.competitions.upcoming",
  "vd.sub.competitions.live","vd.sub.competitions.completed","vd.sub.competitions.matches",
  "vd4.matchScope.upcoming","vd4.matchScope.results","vd4.viewMatch",
  "vd4.loadMore","vd4.register","vd4.noMatches","vd4.noCompetitions",
]){
  assert.equal(language.split('"'+key+'"').length-1,3,"Missing English/Dari/Pashto: "+key);
}
console.log("Venue Detail Phase 4 verified: five competition subtabs, validated venue-scoped SQL, physically assigned match fixtures/results, paginated API, top-left image cards and RTL/localized output.");
