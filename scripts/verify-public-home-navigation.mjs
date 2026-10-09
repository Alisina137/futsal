import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const bar=read("apps/mobile/src/components/ui/PublicTopNavigation.tsx");
const screen=read("apps/mobile/src/components/ui/Screen.tsx");
const header=read("apps/mobile/src/components/ui/AppHeader.tsx");
const tabs=read("apps/mobile/app/(app)/(tabs)/_layout.tsx");
const home=read("apps/mobile/app/(app)/(tabs)/home.tsx");
const repo=read("apps/api/src/modules/marketing/marketing.repository.ts");
const rank=read("apps/api/src/modules/marketing/social-feed-ranking.ts");
const apiTests=read("apps/api/test/social-feed-ranking.test.ts");
const locales=read("packages/localization/src/index.ts");

const paths=[
  ["home","/home","home-outline","apps/mobile/app/(app)/(tabs)/home.tsx"],
  ["venues","/venues","football-outline","apps/mobile/app/(app)/(tabs)/venues.tsx"],
  ["teams","/teams","people-outline","apps/mobile/app/(app)/teams/index.tsx"],
  ["competitions","/competitions","trophy-outline","apps/mobile/app/(app)/competitions/index.tsx"],
  ["notifications","/notifications","notifications-outline","apps/mobile/app/(app)/notifications.tsx"],
];
for(const [key,href,icon,page] of paths){
  assert(bar.includes(`key:"${key}",href:"${href}"`),`Top navigation route missing: ${key}`);
  assert(bar.includes(`icon:"${icon}"`),`Top navigation icon missing: ${key}`);
  const code=read(page);
  if(key==="home"){
    assert(code.includes("<Screen showHeader publicNav")&&code.includes('{loading?<DataLoadingState'),
      "Home must keep the top navigation mounted while feed content loads.");
  }else{
    assert((code.match(/<Screen showHeader publicNav>/g)??[]).length>=2,
      `Top bar must be visible both during loading and content: ${key}`);
  }
}
assert(screen.indexOf("<PublicTopNavigation/>")<screen.indexOf("<KeyboardAvoidingView"),
  "Top navigation must be fixed above the scrollable page content.");
assert(bar.includes('flexDirection:isRTL?"row-reverse":"row"'),"Dari and Pashto must reverse the physical tab order.");
assert(bar.includes("accessibilityRole=\"tab\"")&&bar.includes("accessibilityState={{selected:active}}"),
  "Public navigation must provide accessible selected-tab states.");
assert(bar.includes("unread>99")&&bar.includes("notificationApi.list(token)")&&bar.includes("!item.readAt"),
  "Notifications badge must count unread notifications from the real server.");
assert(bar.includes('isPlatformAdmin')&&bar.includes("if(isPlatformAdmin)return null"),
  "Public navigation must never render inside the separate platform-admin interface.");
assert(header.includes('>=isPlatformAdmin?[')&&header.includes('href:"/admin"'),
  "Admin hamburger navigation must be separate from normal roles.");
assert(header.includes('...(hasDashboard?['),
  "Non-admin role dashboards must remain available through the hamburger menu.");
assert(tabs.includes('title:t("home.title")'),"Home should not change its name for venue owners.");
assert(home.includes("marketingApi.socialFeed")&&home.includes("formatPostTimeAgo")&&home.includes("likeSocialPost"),
  "Social Home must retain the real personalized feed, relative times and Like actions.");
assert(!home.includes('t("social.latestPosts")')&&!home.includes('t("social.homeSubtitle")')
  &&home.includes("openComments")&&home.includes("moments.map("),
  "Social Home must flow directly from photo moments into interactive posts without a redundant title/subtitle.");
assert(repo.includes("selectPersonalizedSocialPosts(candidates, followed, 100)"),
  "Social feed must blend followed updates with discoverable public posts.");
assert(rank.includes('post.visibility==="PUBLIC"')&&rank.includes('post.visibility==="FOLLOWERS"'),
  "Follower-only posts must never be recommended to non-followers.");
assert(apiTests.includes("does not recommend follower-only or private posts"),
  "Social visibility and discovery rules must have unit tests.");
assert(locales.split('"social.latestPosts"').length-1===3,
  "Latest-posts label must exist in English, Dari and Pashto.");
console.log("Public top navigation verified: five shared fixed destinations, RTL, selected states, real notification badges, admin separation, personalized and discovery feed.");
