import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const profile=read("apps/mobile/app/(app)/competitions/[competitionId].tsx");
const sections=read("apps/mobile/src/components/competition/CompetitionProfileSections.tsx");
const matchList=read("apps/mobile/src/components/competition/CompetitionMatchList.tsx");
const about=read("apps/mobile/app/(app)/competitions/[competitionId]/about.tsx");
const locale=read("packages/localization/src/index.ts");
const listing=read("apps/mobile/src/components/social/CompetitionDirectoryCard.tsx");
for(const marker of ["competition-public-profile","competition-profile-back",
 "competition-hero-status","competition-profile-summary","competition-capacity-progress",
 "competition-profile-tabs","competition-metric-teams","competition-metric-matches",
 "competition-metric-results","competition-tab-content"]){
 assert.ok(profile.includes('testID="'+marker+'"'),"Competition profile is missing "+marker);
}
assert.ok(profile.includes("mediaPosts.find(post=>post.imageUrl)")&&
 profile.includes('Ionicons name="trophy"')&&
 profile.includes("styles.cover")&&profile.includes("styles.avatarFrame"),
 "Honor real published media fallback and existing profile identity");
assert.ok(profile.includes('setActiveTab(focusRegistration==="1"?"TEAMS":selectedTab(tab))')&&
 profile.includes('tabScrollRef.current?.scrollTo({x,animated})')&&
 profile.includes("tabPositions.current.set(value,{x,width})")&&
 profile.includes("COMPETITION_PROFILE_TABS.map"),
 "Five-tab deep links, RTL and selected tab focus must stay intact");
assert.ok(profile.includes('formatCompetitionDateTime(nextDate,language)')&&
 profile.includes("competition.registrationFeeAfn")&&
 profile.includes('competition.status==="IN_PROGRESS"')&&
 profile.includes('competition.status==="REGISTRATION_OPEN"')&&
 profile.includes('setIntent(')&&profile.includes('CompetitionParticipationPanel'),
 "Header must use real status, date, fee and retain safe manager actions");
for(const marker of ["competition-home-overview","competition-home-feed",
 "competition-home-media-tabs","competition-home-view-UPDATES","competition-home-view-PHOTOS",
 "competition-photo-gallery","competition-photo-close","competition-home-view-matches"]){
 assert.ok(sections.includes(marker),"Home overview/media UI missing "+marker);
}
assert.ok(sections.includes('updates.map(post=>')&&
 sections.includes('const updates=posts.slice().sort(')&&
 sections.includes('photos=updates.filter(post=>Boolean(resolveMediaImageUrl(post.imageUrl)))')&&
 sections.includes('testID={\`competition-gallery-photo-\${post.id}\`}')===false,
 "Home must keep every published post and only show actual media in its gallery");
assert.ok(sections.includes("setLightbox(resolveMediaImageUrl(post.imageUrl))")&&
 sections.includes('<Modal visible={Boolean(lightbox)}')&&
 sections.includes('onRequestClose={()=>setLightbox(null)}'),
 "Photo lightbox must show full-size genuine images and allow closing");
assert.ok(sections.includes('live.length>0?<View testID="competition-live-scoreboard"')&&
 sections.includes('match.status==="IN_PROGRESS"')&&
 !sections.includes("posts.slice(0,5)"),
 "Home keeps live-only match scores and the complete post timeline");
assert.ok(matchList.includes("totals[value]")&&
 matchList.includes('testID="competition-matches-list"')&&
 matchList.includes('testID={\`competition-match-\${match.id}\`}')===false&&
 matchList.includes('router.push({')&&
 matchList.includes('competition.phase4.matchDetails')&&
 matchList.includes('match.status==="IN_PROGRESS"'),
 "Matches must show actual totals, scores, status and match detail navigation");
assert.ok(about.includes('testID="competition-about-at-a-glance"')&&
 about.includes("data.rewards.filter(")&&about.includes("data.tieBreakOrder.map(")&&
 about.includes("data.registrationFeeAfn")&&about.includes("data.registrationClosesAt")&&
 about.includes("data.groupCount")&&about.includes("data.qualifiersPerGroup")&&
 about.includes('params:{competitionId,tab:"TEAMS"}')&&
 about.includes('params:{competitionId,tab:"MATCHES"}'),
 "About summary must complement—not remove—complete organizer, awards and rules information");
assert.ok(listing.includes("const IMAGE_SIZE=144")&&
 listing.includes('header:{flexDirection:"row"')&&listing.includes('testID="competition-card-info"'),
 "Phase 4 must not change user's top-left square card layout");
for(const key of ["competition.phase4.matchDetails","competition.phase4.fullAbout",
 "competition.phase4.viewFixtures","competition.phase4.updates","competition.phase4.photos",
 "competition.phase4.openPhoto","competition.phase4.noPhotos",
 "competition.phase4.registerTeam","competition.phase4.liveMatches",
 "competition.phase4.finishedResults","competition.phase4.viewSchedule"]){
 assert.equal(locale.split('"'+key+'"').length-1,3,
  "Missing locale strings EN/Dari/Pashto for "+key);
}
console.log("Competition Phase 4 verified: updated status-led profile, published posts/gallery, About parity, matches UX, registration and top-left listing image invariants.");
