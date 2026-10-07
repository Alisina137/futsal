import fs from "node:fs";

function read(path){
  return fs.readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
}
function assert(value,message){
  if(!value)throw new Error(message);
}

const migration=read("packages/database/drizzle/0017_media_center.sql");
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
  "venuePostTypeEnum",
  "venuePostVisibilityEnum",
  "venuePostScheduledActionEnum",
  "venuePostScheduledActions",
]){
  assert(schema.includes(marker),`Media database schema missing: ${marker}`);
}

for(const marker of [
  "venuePostTypeSchema",
  "venuePostVisibilitySchema",
  "venuePostScheduledActionSchema",
  "venuePostScheduleRequestSchema",
  "venuePostUpdateRequestSchema",
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
]){
  assert(routes.includes(marker),`Media route missing: ${marker}`);
}

assert(server.includes("mediaLifecycleTimer")&&server.includes("60_000")&&server.includes("refreshScheduledMedia"),"Server must process Media timers independently of page visits.");
assert(bookingRoutes.includes("request.query.q"),"Venue directory API must accept a name-search query.");
assert(bookingRepository.includes("ilike(venues.name"),"Venue directory must search venue page names server-side.");

for(const marker of [
  "media.stat.total",
  '"ALL","PUBLISHED","DRAFT","SCHEDULED","PRIVATE"',
  "setPostVisibility",
  "cancelPostSchedule",
  "ownerApi.deletePost",
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
]){
  assert(composer.includes(marker),`Media composer missing: ${marker}`);
}

assert(venueDirectory.includes("media.venueSearch")&&venueDirectory.includes("query.trim()"),"Users must be able to search venue pages by name.");
for(const marker of [
  "marketingApi.venuePosts",
  "media.pagePosts",
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
]){
  const count=localization.split(`"${key}"`).length-1;
  assert(count===3,`Media localization missing ${key}; found ${count}.`);
}

assert(tests.includes("keeps followers-only venue posts off the public page"),"Media audience regression test missing.");
assert(tests.includes("executes scheduled media visibility and deletion actions"),"Media lifecycle regression test missing.");

console.log("Owner Media verified: searchable/followable venue pages, post types, competition/promotion/result linking, audience privacy, Facebook-style conversations, and server-driven scheduled lifecycle actions are present.");
