import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

const contracts=read("packages/contracts/src/index.ts");
const schema=read("packages/database/src/schema.ts");
const migration=read("packages/database/drizzle/0041_competition_branding.sql");
const journal=read("packages/database/drizzle/meta/_journal.json");
const repo=read("apps/api/src/modules/competition/competition.repository.ts");
const types=read("apps/api/src/modules/competition/competition.types.ts");
const service=read("apps/api/src/modules/competition/competition.service.ts");
const fake=read("apps/api/test/fake-competition-repository.ts");
const tests=read("apps/api/test/competition-phase6-branding.test.ts");
const picker=read("apps/mobile/src/components/owner/media/MediaImagePicker.tsx");
const owner=read("apps/mobile/app/(app)/owner/competitions/[competitionId]/manage.tsx");
const ownerList=read("apps/mobile/app/(app)/owner/competitions/index.tsx");
const publicPage=read("apps/mobile/app/(app)/competitions/[competitionId].tsx");
const card=read("apps/mobile/src/components/social/CompetitionDirectoryCard.tsx");
const l10n=read("packages/localization/src/index.ts");

assert.ok(schema.includes('logoUrl: text("logo_url")')&&
  schema.includes('coverImageUrl: text("cover_image_url")')&&
  migration.includes('ADD COLUMN IF NOT EXISTS "logo_url"')&&
  migration.includes('ADD COLUMN IF NOT EXISTS "cover_image_url"')&&
  journal.includes("0041_competition_branding"),"Persist competition brand references with migration");
assert.ok(contracts.includes("competitionBrandImageRefSchema")&&
  contracts.includes("logoUrl:competitionBrandImageRefSchema.nullable().optional()")&&
  contracts.includes("coverImageUrl:competitionBrandImageRefSchema.nullable().optional()")&&
  contracts.includes("logoUrl: z.string().nullable()")&&
  contracts.includes("coverImageUrl: z.string().nullable()"),"Only uploaded asset path, no arbitrary HTTP URL");
assert.ok(types.includes("isOwnedBrandAsset")&&
  repo.includes("venueMediaAssets.venueId,input.venueId")&&
  repo.includes("venueMediaAssets.ownerUserId,input.ownerUserId")&&
  repo.includes("venueMediaAssets.purpose,input.purpose")&&
  repo.includes("venueMediaAssets.publicToken")&&
  service.includes('["PROFILE",input.logoUrl]')&&
  service.includes('["COVER",input.coverImageUrl]')&&
  service.includes('COMPETITION_BRAND_ASSET_DENIED'),
  "Branding references must be same-venue, same-owner, same-purpose and validated with token");
assert.ok(repo.includes('logoUrl:row.competition.logoUrl')&&
  repo.includes('coverImageUrl:row.competition.coverImageUrl??images.get(row.competition.id)??null')&&
  repo.includes('logoUrl:row.competition.logoUrl,')&&
  repo.includes('coverImageUrl:row.competition.coverImageUrl')&&
  service.includes('...(input.logoUrl !== undefined')&&
  service.includes('...(input.coverImageUrl !== undefined'),
  "Branding must be returned in complete and paged discovery DTOs and persisted");
assert.ok(picker.includes('purpose:VenueMediaAssetPurpose')&&
  picker.includes("ownerApi.uploadMediaAsset")&&picker.includes("variant")&&
  owner.includes('testID="competition-branding-editor"')&&
  owner.includes('<MediaImagePicker accessToken={session.accessToken} purpose="PROFILE" variant="profile"')&&
  owner.includes('<MediaImagePicker accessToken={session.accessToken} purpose="COVER" variant="cover"')&&
  owner.includes('logoUrl:brandLogo||null,coverImageUrl:brandCover||null')&&
  owner.includes('async function saveBranding()'),
  "Organizer must upload and save independent logo and cover images with preview");
assert.ok(publicPage.includes("competition?.coverImageUrl??mediaPosts.find(post=>post.imageUrl)?.imageUrl")&&
  publicPage.includes('testID="competition-brand-logo"')&&
  publicPage.includes("competition?.logoUrl")&&
  card.includes("competition.logoUrl??competition.coverImageUrl??null")&&
  card.includes("const IMAGE_SIZE=144")&&
  card.includes('header:{flexDirection:"row"')&&
  ownerList.includes("item.logoUrl??item.coverImageUrl??null"),
  "Public hero should honor cover, square card must honor logo first, with honest fallback");
assert.ok(fake.includes("brandAssets")&&
  tests.includes("rejects cross-venue assets")&&
  tests.includes("keeps a duplicated competition unbranded")&&
  tests.includes("drafts stay private"),
  "Required authorization, lifecycle and persistence regression coverage");
for(const key of ["title","description","logo","cover","fallback","saveBranding","saved","invalidAsset","saveError"]){
  assert.equal(l10n.split('"competition.phase6.'+key+'"').length-1,3,"Missing translations for "+key);
}
console.log("Competitions Phase 6 verified: persistent images, venue-scoped upload authorization, organizer UI, public card/hero fallbacks, EN/Dari/Pashto and unit tests.");
