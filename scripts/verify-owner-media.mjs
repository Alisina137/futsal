import fs from "node:fs";

function read(path){
  return fs.readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
}
function assert(value,message){
  if(!value)throw new Error(message);
}

const migration=read("packages/database/drizzle/0017_media_center.sql");
const mediaAssetsMigration=read("packages/database/drizzle/0018_media_page_assets.sql");
const journal=read("packages/database/drizzle/meta/_journal.json");
const schema=read("packages/database/src/schema.ts");
const contracts=read("packages/contracts/src/index.ts");
const repository=read("apps/api/src/modules/marketing/marketing.repository.ts");
const service=read("apps/api/src/modules/marketing/marketing.service.ts");
const routes=read("apps/api/src/modules/marketing/marketing.routes.ts");
const server=read("apps/api/src/server.ts");
const bookingRoutes=read("apps/api/src/modules/booking/booking.routes.ts");
const bookingRepository=read("apps/api/src/modules/booking/booking.repository.ts");
const ownerMedia=read("apps/mobile/app/(app)/owner/posts/index.tsx");
const composer=read("apps/mobile/app/(app)/owner/posts/create.tsx");
const venuePage=read("apps/mobile/app/(app)/venues/[venueId].tsx");
const venueDirectory=read("apps/mobile/app/(app)/(tabs)/venues.tsx");
const postDetail=read("apps/mobile/app/(app)/posts/[postId].tsx");
const home=read("apps/mobile/app/(app)/(tabs)/home.tsx");
const comments=read("apps/mobile/app/(app)/posts/[postId]/comments.tsx");
const mediaPicker=read("apps/mobile/src/components/owner/media/MediaImagePicker.tsx");
const mobilePackage=read("apps/mobile/package.json");
const mobileApi=read("apps/mobile/src/lib/api.ts");
const localization=read("packages/localization/src/index.ts");
const tests=read("apps/api/test/marketing.test.ts");

for(const marker of [
  'CREATE TYPE "venue_post_type"',
  'CREATE TYPE "venue_post_visibility"',
  'CREATE TYPE "venue_post_scheduled_action"',
  'CREATE TABLE "venue_post_scheduled_actions"',
  '"visibility" "venue_post_visibility"',
]){
  assert(migration.includes(marker),`Media migration missing: ${marker}`);
}
assert(journal.includes('"tag": "0017_media_center"'),"Media migration must be registered in Drizzle journal.");
for(const marker of [
  'page_profile_image_url',
  'page_cover_image_url',
  'page_bio',
  'CREATE TABLE "venue_media_assets"',
  '"data_base64" text',
]){
  assert(mediaAssetsMigration.includes(marker),`Media page asset migration missing: ${marker}`);
}
assert(journal.includes('"tag": "0018_media_page_assets"'),"Venue media asset migration must be registered in Drizzle journal.");

for(const marker of [
  "venuePostTypeEnum",
  "venuePostVisibilityEnum",
  "venuePostScheduledActionEnum",
  "venuePostScheduledActions",
  "venueMediaAssets",
  "pageProfileImageUrl",
  "pageCoverImageUrl",
]){
  assert(schema.includes(marker),`Media database schema missing: ${marker}`);
}

for(const marker of [
  "venuePostTypeSchema",
  "venuePostVisibilitySchema",
  "venuePostScheduledActionSchema",
  "venuePostScheduleRequestSchema",
  "venuePostUpdateRequestSchema",
  "venueMediaAssetDtoSchema",
  "venueMediaPageDtoSchema",
  "venueMediaPageUpdateRequestSchema",
  "mediaImageRefSchema",
  'z.enum(["NOW","DRAFT","SCHEDULED"])',
]){
  assert(contracts.includes(marker),`Media contracts missing: ${marker}`);
}

for(const marker of [
  "refreshPostStates",
  "setPostVisibility",
  "addPostSchedule",
  "cancelPostSchedule",
  "listVenuePosts",
  'row.visibility === "PRIVATE"',
  'row.visibility === "FOLLOWERS"',
  "competitionBelongsToVenue",
  "createMediaAsset",
  "getMediaAsset",
  "updateVenueMediaPage",
]){
  assert(repository.includes(marker),`Media repository invariant missing: ${marker}`);
}

for(const marker of [
  "refreshScheduledMedia",
  "normalizePostCta",
  "MEDIA_SCHEDULE_IN_PAST",
  'input.publishMode==="SCHEDULED"',
  "getVenuePostForUser",
  "venuePosts(venueId",
  'post.visibility==="FOLLOWERS"',
  "createMediaAsset",
  "ownerMediaPage",
  "updateOwnerMediaPage",
  "assertOwnedMediaReference",
]){
  assert(service.includes(marker),`Media service invariant missing: ${marker}`);
}

for(const marker of [
  'router.get("/venues/:venueId/posts"',
  'router.get("/venues/:venueId/posts/following"',
  'router.put("/posts/:postId"',
  'router.delete("/posts/:postId"',
  'router.patch("/posts/:postId/visibility"',
  'router.post("/posts/:postId/schedules"',
  'router.get("/media-assets/:assetId/:publicToken"',
  'router.get("/media-page"',
  'router.patch("/media-page"',
  '"/media-assets"',
]){
  assert(routes.includes(marker),`Media route missing: ${marker}`);
}

assert(server.includes("mediaLifecycleTimer")&&server.includes("60_000")&&server.includes("refreshScheduledMedia"),"Server must process Media timers independently of page visits.");
assert(bookingRoutes.includes("request.query.q"),"Venue directory API must accept a name-search query.");
assert(bookingRepository.includes("ilike(venues.name"),"Venue directory must search venue page names server-side.");

for(const marker of [
  "page.pageCoverImageUrl",
  "page.pageProfileImageUrl",
  "media.composerPrompt",
  "media.editPage",
  '"ALL","PUBLISHED","DRAFT","SCHEDULED","PRIVATE"',
  "setPostVisibility",
  "cancelPostSchedule",
  "ownerApi.deletePost",
  "ownerApi.updateMediaPage",
  "MediaImagePicker",
  'pathname:"/venues/[venueId]"',
]){
  assert(ownerMedia.includes(marker),`Owner Media dashboard missing: ${marker}`);
}

for(const marker of [
  '"GENERAL","ANNOUNCEMENT","PROMOTION","COMPETITION","RESULT"',
  "DateTimePickerField",
  '"PUBLISH","UNPUBLISH","MAKE_PUBLIC","MAKE_FOLLOWERS","MAKE_PRIVATE","DELETE"',
  "competitionApi.ownerList",
  "completedMatches",
  "ownerApi.addPostSchedule",
  "publishMode",
  "MediaImagePicker",
  'purpose="POST"',
]){
  assert(composer.includes(marker),`Media composer missing: ${marker}`);
}

for(const marker of [
  "expo-image-picker",
  "expo-document-picker",
  "expo-file-system",
]){
  assert(mobilePackage.includes(marker),`Native media picker/upload dependency missing: ${marker}`);
}
for(const marker of [
  "launchImageLibraryAsync",
  "getDocumentAsync",
  'purpose:VenueMediaAssetPurpose',
]){
  assert(mediaPicker.includes(marker),`Native image picker capability missing: ${marker}`);
}
assert(mobileApi.includes("uploadVenueMediaAsset")&&mobileApi.includes("resolveMediaImageUrl"),"Mobile Media API must upload and resolve durable images.");
assert(mobileApi.includes('import { fetch as expoFetch } from "expo/fetch";'),"Media upload must use Expo fetch for native files.");
assert(mobileApi.includes('import { File } from "expo-file-system";'),"Media upload must use Expo File instead of React Native Blob conversion.");
assert(mobileApi.includes("body:file"),"Media upload must send the selected native file directly.");
const uploadStart=mobileApi.indexOf("async function uploadVenueMediaAsset");
const uploadEnd=mobileApi.indexOf("export const systemApi",uploadStart);
const uploadSource=mobileApi.slice(uploadStart,uploadEnd);
assert(!uploadSource.includes(".blob()"),"Media upload must not call Response.blob(); it causes React Native Blob/base64 overhead and Android LogBox warnings.");

assert(venueDirectory.includes("media.venueSearch")&&venueDirectory.includes("query.trim()"),"Users must be able to search venue pages by name.");
for(const marker of [
  "marketingApi.venuePosts",
  "media.pagePosts",
  "pageCoverImageUrl",
  "pageProfileImageUrl",
  "resolveMediaImageUrl",
  "socialPostId",
  'pathname:"/posts/[postId]/comments"',
]){
  assert(venuePage.includes(marker),`Venue public page Media timeline missing: ${marker}`);
}
assert(postDetail.includes("venuePostForUser")&&postDetail.includes("socialPostId"),"Follower-only post details must preserve audience checks and comments.");
assert(home.includes("likeSocialPost")&&home.includes("openComments")&&home.includes("sharePost"),"Facebook-style Home interactions must remain wired.");
assert(comments.includes("addSocialComment")&&comments.includes("updateSocialComment")&&comments.includes("deleteSocialComment"),"Post comments must support conversation management.");

for(const key of [
  "media.title",
  "media.createPost",
  "media.type.RESULT",
  "media.visibility.FOLLOWERS",
  "media.publishMode.SCHEDULED",
  "media.automation",
  "media.action.MAKE_PRIVATE",
  "media.venueSearch",
  "media.pagePosts",
  "media.chooseGallery",
  "media.chooseFiles",
  "media.editPage",
  "media.coverPhoto",
]){
  const count=localization.split(`"${key}"`).length-1;
  assert(count===3,`Media localization missing ${key}; found ${count}.`);
}

assert(tests.includes("keeps followers-only venue posts off the public page"),"Media audience regression test missing.");
assert(tests.includes("executes scheduled media visibility and deletion actions"),"Media lifecycle regression test missing.");

console.log("Owner Media verified: Facebook-style editable venue pages, Gallery/Files uploads, durable cover/profile/post images, searchable/followable public pages, rich post management, audience privacy, conversations, and scheduled lifecycle actions are present.");
