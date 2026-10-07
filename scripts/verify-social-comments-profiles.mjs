import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}
function assert(value, message) {
  if (!value) throw new Error(message);
}

const schema = read("packages/database/src/schema.ts");
const migration = read("packages/database/drizzle/0013_social_comment_interactions.sql");
const contracts = read("packages/contracts/src/index.ts");
const repository = read("apps/api/src/modules/marketing/marketing.repository.ts");
const service = read("apps/api/src/modules/marketing/marketing.service.ts");
const routes = read("apps/api/src/modules/marketing/marketing.routes.ts");
const api = read("apps/mobile/src/lib/api.ts");
const home = read("apps/mobile/app/(app)/(tabs)/home.tsx");
const comments = read("apps/mobile/app/(app)/posts/[postId]/comments.tsx");
const venue = read("apps/mobile/app/(app)/venues/[venueId].tsx");
const team = read("apps/mobile/app/(app)/teams/[teamId].tsx");
const localization = read("packages/localization/src/index.ts");

assert(schema.includes("socialPostCommentLikes") && schema.includes('editedAt: timestamp("edited_at"'), "comment likes/edited schema missing");
assert(migration.includes('"social_post_comment_likes"') && migration.includes('"edited_at"'), "comment interaction migration missing");
assert(contracts.includes("socialPostCommentUpdateRequestSchema"), "comment update contract missing");
assert(contracts.includes("likedByMe: z.boolean()") && contracts.includes("canManage: z.boolean()"), "comment interaction DTO fields missing");

assert(repository.includes("hydrateSocialComment") && repository.includes("row.userId === viewerUserId"), "comment ownership hydration missing");
assert(repository.includes("updateSocialComment") && repository.includes("deleteSocialComment"), "comment owner mutations missing");
assert(repository.includes("likeSocialComment") && repository.includes("unlikeSocialComment"), "comment like persistence missing");
assert(service.includes("COMMENT_ACCESS_DENIED"), "comment ownership service guard missing");
assert(routes.includes('comments/:commentId/like') && routes.includes('router.patch("/social/posts/:postId/comments/:commentId"'), "comment edit/like routes missing");

assert(api.includes("updateSocialComment") && api.includes("deleteSocialComment"), "mobile comment mutation API missing");
assert(api.includes("likeSocialComment") && api.includes("unlikeSocialComment"), "mobile comment-like API missing");
assert(home.includes('pathname:"/posts/[postId]/comments"'), "Home Comment button must navigate to comments page");
assert(!home.includes("commentsOpen"), "Home must not keep the legacy inline comment thread");
assert(comments.includes("canManage") && comments.includes("confirmDelete"), "comments page must expose own-comment edit/delete controls");
assert(comments.includes("toggleCommentLike"), "comments page must expose comment Likes");

assert(venue.includes("styles.pageHeader") && venue.includes("pageCoverImageUrl") && venue.includes("pageProfileImageUrl") && venue.includes("publicProfile.aboutVenue") && venue.includes("publicProfile.availability"), "public Venue profile styling missing");
assert(team.includes("styles.hero") && team.includes("publicProfile.followers") && team.includes("styles.statGrid"), "public Team profile styling missing");

assert((localization.match(/"social\.commentsPageTitle"/g) ?? []).length === 3, "comments page title missing in one or more languages");
assert((localization.match(/"social\.commentEditError"/g) ?? []).length === 3, "comment edit copy missing in one or more languages");
assert((localization.match(/"publicProfile\.aboutVenue"/g) ?? []).length === 3, "Venue profile copy missing in one or more languages");
assert((localization.match(/"publicProfile\.followers"/g) ?? []).length === 3, "Team profile copy missing in one or more languages");

console.log("Social comments and public profiles verified: dedicated conversation page, comment likes/edit/delete ownership, and polished Venue/Team profiles.");
