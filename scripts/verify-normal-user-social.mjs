import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}
function assert(value, message) {
  if (!value) throw new Error(message);
}

const schema = read("packages/database/src/schema.ts");
const migration = read("packages/database/drizzle/0011_normal_user_social_feed.sql");
const contracts = read("packages/contracts/src/index.ts");
const repository = read("apps/api/src/modules/marketing/marketing.repository.ts");
const service = read("apps/api/src/modules/marketing/marketing.service.ts");
const routes = read("apps/api/src/modules/marketing/marketing.routes.ts");
const home = read("apps/mobile/app/(app)/(tabs)/home.tsx");
const teamsDirectory = read("apps/mobile/app/(app)/teams/index.tsx");
const team = read("apps/mobile/app/(app)/teams/[teamId].tsx");
const commentsPage = read("apps/mobile/app/(app)/posts/[postId]/comments.tsx");
const competition = read("apps/mobile/app/(app)/competitions/[competitionId].tsx");
const header = read("apps/mobile/src/components/ui/AppHeader.tsx");
const localization = read("packages/localization/src/index.ts");

assert(schema.includes("socialFollows") && schema.includes("socialPosts") && schema.includes("socialPostLikes") && schema.includes("socialPostComments"), "social persistence schema missing");
assert(migration.includes('INSERT INTO "social_follows"') && migration.includes('FROM "venue_follows"'), "venue follow backfill missing");
assert(migration.includes('INSERT INTO "social_posts"') && migration.includes('FROM "venue_posts"'), "venue post backfill missing");
assert(contracts.includes('z.enum(["VENUE", "TEAM", "COMPETITION"])'), "social entity contract missing");
assert(repository.includes('entityType: "VENUE"') && repository.includes("legacyVenuePostId"), "future venue posts must mirror into social posts");
assert(repository.includes("listSocialFeed") && repository.includes("likeSocialPost") && repository.includes("addSocialComment"), "social repository interactions missing");
assert(service.includes("socialFollowState") && service.includes("socialFeed") && service.includes("SOCIAL_POST_NOT_FOUND"), "social service validation missing");
assert(routes.includes('"/social/feed"') && routes.includes('"/social/follows/:entityType/:entityId"'), "social feed/follow routes missing");
assert(routes.includes('"/social/posts/:postId/like"') && routes.includes('"/social/posts/:postId/comments"'), "social interaction routes missing");
assert(home.includes("marketingApi.socialFeed") && home.includes("Share.share"), "Home must be the personalized feed with native sharing");
assert(home.includes("likeSocialPost") && home.includes("unlikeSocialPost"), "Home post Like interactions missing");
assert(home.includes('pathname:"/posts/[postId]/comments"'), "Home Comment action must open the dedicated comments page");
assert(commentsPage.includes("addSocialComment") && commentsPage.includes("updateSocialComment") && commentsPage.includes("deleteSocialComment"), "Dedicated comments page must support add/edit/delete");
assert(commentsPage.includes("likeSocialComment") && commentsPage.includes("unlikeSocialComment"), "Dedicated comments page must support comment likes");
assert(home.includes('pathname:"/venues/[venueId]"') && home.includes('pathname:"/teams/[teamId]"') && home.includes('pathname:"/competitions/[competitionId]"'), "post author navigation must support venue/team/competition");
assert(teamsDirectory.includes("teamApi.directory"), "Teams navigation page must list all active teams instead of only My Teams");
assert(teamsDirectory.includes("teamApi.requestJoin") && teamsDirectory.includes('t("teams.viewTeam")'), "Teams directory must support join requests and opening team profiles");
assert(team.includes('"TEAM"') && team.includes("socialFollowState"), "Team follow control missing");
assert(team.includes("teamApi.requestJoin") && team.includes("joinRequestStatus"), "Team profile must expose join-request state");
assert(competition.includes('"COMPETITION"') && competition.includes("socialFollowState"), "Competition follow control missing");
assert(!header.includes('href:"/feed"'), "Feed must not be a separate hamburger option");
const v=header.indexOf('href:"/venues"');
const tm=header.indexOf('href:"/teams"');
const cp=header.indexOf('href:"/competitions"');
const b=header.indexOf('href:"/bookings"');
assert(v >= 0 && v < tm && tm < cp && cp < b, "hamburger order must be Venues → Teams → Competitions → My Reserves");
assert((localization.match(/"social\.homeSubtitle"/g) ?? []).length === 3, "social Home copy must exist in all languages");
assert((localization.match(/"social\.like"/g) ?? []).length === 3, "Like copy must exist in all languages");
assert((localization.match(/"social\.comment"/g) ?? []).length === 3, "Comment copy must exist in all languages");
assert((localization.match(/"social\.share"/g) ?? []).length === 3, "Share copy must exist in all languages");

console.log("Normal user social experience verified: followed Home feed, entity follows, author navigation, Like/Comment/Share, and requested hamburger order.");
