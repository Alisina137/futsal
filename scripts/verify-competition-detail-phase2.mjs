import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const screen=read("apps/mobile/app/(app)/competitions/[competitionId].tsx");
const sections=read("apps/mobile/src/components/competition/CompetitionProfileSections.tsx");
const helper=read("apps/mobile/src/lib/competition-detail-home.ts");
const locale=read("packages/localization/src/index.ts");
const pageNav=read("apps/mobile/src/lib/competition-detail-navigation.ts");

for(const marker of [
  'testID="competition-cover-share"',
  'accessibilityLabel={t("competition.detail.share")}',
  'Share.share({message:competitionShareMessage(',
  'setError(t("competition.detail.shareError"))',
  'competitionHomeSnapshot(competition)',
  'home?.action.sub==="REGISTRATION"',
  'home?.action.sub==="LIVE"',
  'home?.action.sub==="RESULTS"',
  'onPress={openHomeAction}',
  'switchTab(home.action.main)',
  'chooseCompetitionSubtab(',
  'if(actor===lastActorIdentity.current)setFollowState(next)',
  'router.push("/login")',
  'testID="competition-hero-status"',
  'testID="competition-capacity-progress"',
  'testID="competition-profile-tabs"',
])assert.ok(screen.includes(marker),"Competition header Phase 2 invariant missing: "+marker);

for(const marker of [
  'testID="competition-home-champion"',
  'testID="competition-home-overview"',
  'testID="competition-home-spaces"',
  'testID="competition-home-next-fixture"',
  'testID="competition-home-highlight-preview"',
  'testID="competition-home-all-updates"',
  'snapshot.upcoming&&nextFixtureDate',
  'live.length===0&&snapshot.upcoming',
  'snapshot.champion',
  'snapshot.verifiedResults',
  'const highlightPreviews=updates.slice(0,2)',
  'highlightPreviews.map(post=>',
  'onTabChange("MEDIA")',
  'updates.map(post=>',
  'mode==="MEDIA"',
  'match.status==="IN_PROGRESS"',
  'competition.status==="REGISTRATION_OPEN"',
])assert.ok(sections.includes(marker),"Competition Home Phase 2 invariant missing: "+marker);

for(const marker of [
  'accepted.length<competition.maxTeams',
  'match.status==="SCHEDULED"',
  'finalMatch(match)',
  'match.homeScore!==null&&match.awayScore!==null',
  'competition.status==="COMPLETED"||competition.status==="ARCHIVED"',
  'accepted.find(team=>team.teamId===competition.championTeamId)',
  'leaguekick://competitions/',
])assert.ok(helper.includes(marker),"Competition Home must derive authentic published content: "+marker);

for(const key of ["share","shareError","confirmedChampion","verifiedResults",
  "availablePlaces","nextFixture","recentUpdates","viewAllUpdates"]){
  assert.equal(locale.split('"competition.detail.'+key+'"').length-1,3,
    "Missing EN/Dari/Pashto competition Home translation: "+key);
}
assert.ok(pageNav.includes('"HOME","MATCHES","STANDINGS","STATS","TEAMS","MEDIA","ABOUT"'),
  "Phase 2 must retain seven navigable competition tabs");
console.log("Competition Detail Phase 2: Home, actionable hero, native sharing, verified previews and localization verified.");
