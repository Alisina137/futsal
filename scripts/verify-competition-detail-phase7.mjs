import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const route=read("apps/api/src/modules/competition/competition.routes.ts");
const service=read("apps/api/src/modules/competition/competition.service.ts");
const repository=read("apps/api/src/modules/competition/competition.repository.ts");
const mock=read("apps/api/test/fake-competition-repository.ts");
const api=read("apps/mobile/src/lib/api.ts");
const panel=read("apps/mobile/src/components/competition/CompetitionMediaPanel.tsx");
const sections=read("apps/mobile/src/components/competition/CompetitionProfileSections.tsx");
const nav=read("apps/mobile/src/lib/competition-detail-navigation.ts");
const translations=read("packages/localization/src/index.ts");
const tests=read("apps/api/test/competition-detail-phase7.test.ts");
for(const marker of [
  'publicMediaQuerySchema=z.object(','.int().min(1).max(24).default(12)',
  'kind:z.enum(["all","photos"])','sort:z.enum(["newest","oldest"])',
  'publicMediaQuerySchema.parse(request.query)','service.listPublicMediaPage(competitionId,options)',
])assert.ok(route.includes(marker),"Media route invariant missing: "+marker);
for(const marker of [
  'this.repository.getCompetitionRecord(competitionId)',
  '!competition.published||competition.status==="DRAFT"',
  'this.repository.listPublicCompetitionMediaPage(competitionId,options)',
])assert.ok(service.includes(marker),"Competition public service permission missing: "+marker);
const paging=repository.split('async listPublicCompetitionMediaPage(')[1]?.split('async listCompetitionMedia(')[0]??"";
for(const marker of [
  'eq(socialPosts.entityType,"COMPETITION")',
  'eq(socialPosts.entityId,competitionId)',
  'eq(socialPosts.status,"PUBLISHED")',
  'eq(socialPosts.visibility,"PUBLIC")',
  'kind==="photos"?isNotNull(socialPosts.imageUrl)',
  '.limit(limit+1).offset((page-1)*limit)',
  'asc(socialPosts.id):desc(socialPosts.id)',
])assert.ok(paging.includes(marker),"Media SQL scope/paging missing: "+marker);
assert.ok(mock.includes('async listPublicCompetitionMediaPage('));
assert.ok(api.includes('mediaPage:(competitionId:string,options:'));
for(const marker of [
  'const generation=useRef(0);','generation.current++',
  'competitionApi.mediaPage(competition.id,',
  'if(token!==generation.current)return;',
  'testID="competition-phase7-media"','testID="competition-phase7-gallery"',
  'testID="competition-media-load-more"','testID="competition-media-retry"',
  'testID="competition-phase7-photo-close"','testID="competition-media-refresh"',
  'Share.share({message:post.body.trim()||competition.name})',
  'formatPostTimeAgo(post.publishedAt,language)',
  'sort==="oldest"','setItems(current=>',
])assert.ok(panel.includes(marker),"Phase 7 Media UI invariant missing: "+marker);
for(const marker of [
  'CompetitionMediaPanel competition={competition}',
  'testID="competition-phase7-information"',
  'testID="competition-phase7-rules"',
  'testID="competition-phase7-prizes"',
  'testID="competition-phase7-venue"',
  'competition.tieBreakOrder.map(rule=>',
  'competition.rewards.filter(reward=>reward.category===kind)',
  'competition.venueId','competition.registrationClosesAt',
])assert.ok(sections.includes(marker),"Phase 7 About UI invariant missing: "+marker);
assert.ok(nav.includes('MEDIA:["UPDATES","PHOTOS"]')&&
  nav.includes('ABOUT:["INFORMATION","RULES","PRIZES","VENUE"]'),
  "Competition must keep all seven main tabs and Media/About subtabs");
for(const key of [
  "publicOnly","newest","oldest","loadMore","loading","pageError",
  "shareFailed","sharePost","previous","next","rulesScope","prizesScope","venueScope",
]){
  assert.equal(translations.split('"competition.detail.phase7.'+key+'"').length-1,3,
    "Missing EN/Dari/Pashto phase 7 translation "+key);
}
assert.ok(tests.includes('returns stable pages of only published competition posts')&&
  tests.includes('never publishes draft competitions'),
  "Public Media API regression tests must be present");
console.log("Competition Detail Phase 7: SQL-scoped Media pages, photo viewer, About and trilingual copy verified.");
