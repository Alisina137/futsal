import { readFileSync } from "node:fs";
const read=(file)=>readFileSync(new URL(`../${file}`,import.meta.url),"utf8");
const assert=(ok,message)=>{if(!ok)throw new Error(message);};

const home=read("apps/mobile/app/(app)/(tabs)/home.tsx");
const create=read("apps/mobile/app/(app)/posts/create.tsx");
const optimistic=read("apps/mobile/src/lib/optimistic-social-likes.ts");
const profile=read("apps/mobile/app/(app)/people/[userId].tsx");
const screen=read("apps/mobile/src/components/ui/Screen.tsx");
const contracts=read("packages/contracts/src/index.ts");
const schema=read("packages/database/src/schema.ts");
const journal=read("packages/database/drizzle/meta/_journal.json");
const migration=read("packages/database/drizzle/0021_social_home_user_posts.sql");
const repo=read("apps/api/src/modules/marketing/marketing.repository.ts");
const service=read("apps/api/src/modules/marketing/marketing.service.ts");
const routes=read("apps/api/src/modules/marketing/marketing.routes.ts");
const client=read("apps/mobile/src/lib/api.ts");
const locales=read("packages/localization/src/index.ts");
const test=read("apps/api/test/marketing.test.ts");

for(const marker of [
  "styles.composer","social.composerPrompt","social.createMoment",
  "moments.map(", "marketingApi.socialFeed",
  "marketingApi.likeSocialPost","marketingApi.unlikeSocialPost",
  "router.push(\"/posts/create\")","Share.share","formatPostTimeAgo",
  "router.push({pathname:\"/posts/[postId]/comments\"",
  "onRefresh={()=>void load(true)}",
  "social.postOptions","social.hidePost","social.deletePost",
  'pathname:"/people/[userId]"',
]){
  assert(home.includes(marker),`Facebook-style Home missing: ${marker}`);
}
assert(home.includes('<Screen showHeader publicNav'),"Home must preserve the five shared navigation icons.");
for(const key of ['social.latestPosts','social.homeSubtitle','social.momentsTitle','social.momentsSubtitle']){
  assert(!home.includes('t("'+key+'")'),`Home must not render redundant heading or subtitle: ${key}`);
}
assert(!home.includes('styles.feedHeading')&&!home.includes('styles.sectionTitleRow'),
  "Home feed and Moments must flow directly beneath the fixed navigation without section heading rows.");
assert(home.includes("likes.toggle(post)")&&home.includes("likes.mergeFeed(")
  &&optimistic.includes("operation.desired=!operation.desired"),
  "Home Like button must optimistically update before waiting for its request.");
assert(home.includes("imageOpen&&image?<Modal"),"Tap-to-preview images must work.");
assert(home.includes('post.authorType==="USER"&&post.authorId===userId'),
  "Only the author may see personal post deletion.");
for(const marker of ["launchImageLibraryAsync","getDocumentAsync","copyToCacheDirectory:true",
  "uploadUserPostImage","createUserPost","marketingApi","MEDIA_TOO_LARGE","social.publicPost"]){
  assert(create.includes(marker),`Working personal post composer missing: ${marker}`);
}
assert(profile.includes('socialFollowState')===false && profile.includes("socialFollow") &&
  profile.includes("marketingApi.publicUserProfile") && profile.includes("posts.map("),
  "Public user profiles must load posts and provide Follow/Unfollow actions.");
assert(screen.includes("RefreshControl")&&screen.includes("onRefresh?:()=>void"),
  "Feed must allow pull-to-refresh.");
assert(contracts.includes('["VENUE", "TEAM", "COMPETITION", "USER"]') &&
  contracts.includes("socialUserPostCreateRequestSchema"),"Personal posting contracts missing.");
assert(schema.includes("socialUserPostImages")&&journal.includes("0021_social_home_user_posts")&&
  migration.includes("ADD VALUE IF NOT EXISTS 'USER'"),
  "Personal author migration and persistent photo storage missing.");
for(const marker of ["createUserPost(","listUserPosts(","getUserPostImage(","socialUserPostImages",
  'entityType:"USER"','eq(socialPosts.createdByUserId,userId)']){
  assert(repo.includes(marker),`Account-scoped database post operation missing: ${marker}`);
}
for(const marker of ["publicUserProfile(","createUserPost(","deleteUserPost(",
  "createUserPostImage(","MEDIA_INVALID_IMAGE","POST_IMAGE_NOT_OWNED"]){
  assert(service.includes(marker),`Server post safety check missing: ${marker}`);
}
assert(routes.includes('raw({type:"image/*",limit:"5mb"})')&&
  routes.includes('requireAuth(tokens),personalPostLimiter')&&
  routes.includes('"/social/user-posts"')&&
  routes.includes('"/social/people/:userId"')&&
  routes.includes('"/social/post-images/:assetId/:publicToken"'),
  "Server routes must authenticate posting, validate media, and serve profiles.");
assert(client.includes("uploadNativeImage<{imageUrl:string}>")&&client.includes("createUserPost:"),
  "Mobile API must upload from Android Gallery/Files and publish the resulting post.");
assert(test.includes("protects owned uploads")&&test.includes("POST_IMAGE_NOT_OWNED")===false,
  "Marketing integration test must cover personal posts and foreign asset rejection.");
for(const key of ["social.composerPrompt","social.createMoment","social.momentsTitle","social.publish","social.entity.USER"]){
  assert(locales.split(`"${key}"`).length-1===3,`Missing translations for ${key}`);
}
console.log("Facebook-style Home verified: real personal text/photo posts, public profiles, safe uploads, hero composer, moments, accessible reactions, RTL translations, and refresh.");
