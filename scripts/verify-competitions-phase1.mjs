import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const screen=read("apps/mobile/src/components/social/CompetitionDirectoryExperience.tsx");
const card=read("apps/mobile/src/components/social/CompetitionDirectoryCard.tsx");
const routes=read("apps/api/src/modules/competition/competition.routes.ts");
const repo=read("apps/api/src/modules/competition/competition.repository.ts");
const contracts=read("packages/contracts/src/index.ts");
const api=read("apps/mobile/src/lib/api.ts");
const locales=read("packages/localization/src/index.ts");
for(const marker of ["competitions-followed-strip","competitions-quick-access",
 "competitions-search-panel","competitions-results-section","competitions-results-grid"]){
 assert.ok(screen.includes('testID="'+marker+'"'),"Missing Phase 1 section: "+marker);
}
assert.ok(screen.indexOf("competitions-followed-strip")<
 screen.indexOf("competitions-quick-access")&&screen.indexOf("competitions-quick-access")<
 screen.indexOf("competitions-search-panel")&&screen.indexOf("competitions-search-panel")<
 screen.indexOf("competitions-results-section"),"Followed → Quick Access → Find → Explore order must stay stable");
assert.ok(screen.includes("followed.slice(0,10)")&&screen.includes("followedTotal>MAX_FOLLOWED")&&
 screen.includes('router.push("/competitions/following")'),"Followed carousel must cap at ten and offer full list");
for(const id of ["registration","live","popular","mine"]){
 assert.ok(screen.includes('id:"'+id+'"')&&read("apps/mobile/app/(app)/competitions/"+(
  id==="registration"?"registration":id==="live"?"live":id==="mine"?"my":"popular")+".tsx").includes("CompetitionDirectoryExperience"),
 "Missing functional quick-access route: "+id);
}
assert.ok(screen.includes('router.push("/competitions/ongoing")')&&
 screen.includes('ongoing:"ongoingFollowedVenues"'),
 "Keep ongoing at followed venues as a separate existing shortcut");
assert.ok(screen.includes('testID="competitions-refresh-results"')&&
 screen.includes("competition.phase1.clearFilters")&&screen.includes("competition.phase1.showMore")&&
 screen.includes("load(applied.current,currentPage+1,true)"),"Refresh, reset and more controls missing");
assert.ok(screen.includes("twoColumns=width>=720")&&
 screen.includes('flexWrap:"wrap"')&&screen.includes('styles.gridItem'),
 "One-column phone and two-column tablet/desktop layouts required");
assert.ok(card.includes('testID="competition-card-header"')&&card.includes('testID="competition-card-info"')&&
 card.indexOf('testID="competition-card-header"')<card.indexOf('testID="competition-card-info"')&&
 card.includes('header:{flexDirection:"row"')&&card.includes('const IMAGE_SIZE=144')&&
 card.includes('width:IMAGE_SIZE,height:IMAGE_SIZE,aspectRatio:1'),
 "Competition image must remain square in top-left header at approximately half card height");
assert.ok(card.includes("competition.name")&&card.includes("competition.venueName")&&
 card.includes("competition.acceptedTeams")&&card.includes("competition.registrationFeeAfn")&&
 card.includes("competition.registrationClosesAt"),
 "Name and venue share image header; remaining real competition metadata sits below");
assert.ok(card.includes("resolveMediaImageUrl(competition.logoUrl??competition.coverImageUrl??null)")&&
 repo.includes('eq(socialPosts.status,"PUBLISHED")')&&repo.includes("images.get(row.competition.id)??null")&&
 contracts.includes("coverImageUrl: z.string().nullable().optional()"),
 "Competition images must prioritize venue-owned logo/cover or genuine published media, never fake images");
assert.ok(screen.includes('mine:"mine"')&&api.includes("competitionApi")&&
 api.includes('"/api/v1/competitions/mine"')&&
 routes.includes('router.get("/competitions/mine",auth')&&
 repo.includes('eq(teamMemberships.userId,userId)')&&
 repo.includes('eq(teamMemberships.status,"ACTIVE")')&&
 repo.includes('eq(competitions.published,true)'),
 "My Competitions shortcut requires authenticated, user-scoped membership lookup");
assert.ok(screen.includes('item.status==="REGISTRATION_OPEN"&&canRegister')&&
 screen.includes('competition.phase1.viewRegistration')&&
 screen.includes('competition.phase1.results')&&
 screen.includes('competition.phase1.fixtures'),
 "Show honest competition actions appropriate to status and role");
for(const key of ["competition.phase1.followedSubtitle","competition.phase1.quickAccess",
 "competition.phase1.registrationOpen","competition.phase1.myCompetitions",
 "competition.phase1.explore","competition.phase1.teamsShort",
 "competition.phase1.resultsCount","competition.phase1.showMore"]){
 assert.equal(locales.split('"'+key+'"').length-1,3,
  "Translation missing for English, Dari or Pashto: "+key);
}
console.log("Competition Phase 1 verified: square top-left image, full-width metadata, four discovery sections, 4 shortcuts, safe cover images and My Competitions.");
