import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const settings=read("apps/mobile/app/(app)/(tabs)/settings.tsx");
const feed=read("apps/mobile/app/(app)/(tabs)/feed.tsx");
const locales=read("packages/localization/src/index.ts");
const pkg=JSON.parse(read("package.json"));
assert.ok(settings.includes('user?.roles.includes("PLAYER")&&!user?.roles.includes("REFEREE")?<>'),
  "Player Profile quick access must be shown only for actual Player users.");
assert.ok(settings.includes('onPress={()=>router.push("/profile/player")}')&&
  settings.includes('onPress={()=>router.push("/feed")}'),
  "Keep the Player route for eligible roles and Feed shortcut for everyone.");
assert.ok(feed.includes('useFocusEffect')&&feed.includes("const requestId=useRef(0)")&&
  feed.includes("requestId.current===id")&&feed.includes("requestId.current+=1"),
  "Feed must refresh on focus, prevent stale results from rapid filter changes.");
assert.ok(feed.includes('marketingApi.feed(token,followingOnly)')&&
  feed.includes('onRefresh={()=>void load(true)}'),
  "Feed uses real backend data and native pull-to-refresh.");
assert.ok(feed.includes('testID="feed-filters"')&&
  feed.includes('testID="feed-filter-all"')&&feed.includes('testID="feed-filter-following"')&&
  feed.includes('accessibilityState={{selected}}')&&feed.includes('flexDirection:isRTL?"row-reverse":"row"'),
  "Compact, selected filter tabs must work in English/Dari/Pashto.");
assert.ok(feed.includes('item.type==="PROMOTION"')&&
  feed.includes('function PromotionFeedCard(')&&feed.includes('function PostFeedCard('),
  "Promotion and post cards must remain separate representations of real feed data.");
assert.ok(feed.includes('p.discountedPriceAfn')&&feed.includes('p.originalPriceAfn')&&
  feed.includes('p.startsAt')&&feed.includes('feed.bookPromotion')&&
  feed.includes('startsAt:item.promotion.startsAt'),
  "Promotions must retain their prices, dates and deep link to real slots.");
assert.ok(feed.includes('resolveMediaImageUrl(post.imageUrl)')&&
  feed.includes('post.publishedAt')&&feed.includes('post.socialPostId'),
  "Media assets, localized relative times and existing comments remain available.");
assert.ok(feed.includes('formatLocalDateTime(p.startsAt,language)')&&
  feed.includes('formatPostTimeAgo(')&&!feed.includes("GMT+4:30"),
  "Displayed date/time must respect localized dates and AM/PM without GMT offsets.");
assert.ok(feed.includes('testID="feed-error-state"')&&
  feed.includes('testID="feed-empty-state"')&&
  feed.includes('router.push("/venues")')&&
  feed.includes('router.push("/notifications")'),
  "Retry, meaningful empty state, venue discovery, and notifications must remain usable.");
for(const label of ["feed.venueUpdates","feed.offers","feed.updates","feed.viewVenue",
  "feed.slotTime","feed.savePercent","feed.browseVenues"]){
  assert.equal(locales.split('"'+label+'"').length-1,3,"Missing translations for "+label);
}
assert.ok(pkg.scripts.verify.includes("pnpm verify:normal-profile-feed"),
  "Feed UI test must be included in project verification.");
console.log("Normal-user Feed and Profile Quick Access checked: role gating, refined venue post/offer cards, RTL, dates, refresh/races, empty/error states.");
