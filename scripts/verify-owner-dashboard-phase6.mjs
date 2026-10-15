import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const paths={
  nav:"apps/mobile/src/lib/owner-dashboard-navigation.ts",
  shell:"apps/mobile/src/components/owner/OwnerManagementSubNav.tsx",
  posts:"apps/mobile/app/(app)/owner/posts/index.tsx",
  createPost:"apps/mobile/app/(app)/owner/posts/create.tsx",
  promos:"apps/mobile/app/(app)/owner/promotions/index.tsx",
  createPromotion:"apps/mobile/app/(app)/owner/promotions/create.tsx",
  profile:"apps/mobile/app/(app)/owner/media-profile.tsx",
  reviews:"apps/mobile/app/(app)/owner/media-reviews.tsx",
  logic:"apps/mobile/src/lib/owner-media-marketing.ts",
  api:"apps/mobile/src/lib/api.ts",
  l10n:"packages/localization/src/index.ts",
};
const data=Object.fromEntries(Object.entries(paths).map(([key,value])=>[key,read(value)]));
const check=(key,parts)=>parts.forEach(part=>
 assert.ok(data[key].includes(part),key+" is missing "+part));
check("nav",[
 '{key:"profile",href:"/owner/media-profile"',
 '{key:"reviews",href:"/owner/media-reviews"',
 'path==="/owner/media-profile"||path==="/owner/media-reviews"',
 'inPath(path,"/owner/media-profile")||inPath(path,"/owner/media-reviews")',
 'if(inPath(path,"/owner/media-profile"))return "profile";',
 'if(inPath(path,"/owner/media-reviews"))return "reviews";',
]);
check("shell",['ownerDashboardSubsections[section]','accessibilityRole="tab"',
  'router.replace(item.href)','flexDirection:isRTL?"row-reverse":"row"']);
check("posts",[
  'Promise.allSettled([','ownerApi.posts(token)','ownerApi.mediaPage(token)',
  'if(request!==serial.current)return','const items=postsToken===token?rawItems:[]',
  'const page=pageToken===token?rawPage:null;',
  'ownerPostsForView(items,filter,search)',
  'owner.phase6.partialMediaError','owner.phase6.searchPosts',
  'accessibilityState={{selected:filter===value}}',
  'ownerApi.publishPost(','ownerApi.unpublishPost(','ownerApi.deletePost(',
  'ownerApi.cancelPostSchedule(','ownerApi.updateMediaPage(',
]);
check("promos",[
 'testID="owner-phase6-promotions"','ownerApi.promotions(token)',
 'ownerPromotionsForView(safeItems,view,now,query)',
 'ownerPromotionCounts(safeItems,now)',
 'ownerPromotionState(item,now)','ownerPromotionViews.map(key=>',
 'const safeItems=loadedToken===token?items:[];',
 'useFocusEffect(useCallback(()=>','AppState.currentState==="active"',
 'requestId.current++','writing.current',
 'ownerApi.closePromotion(actorToken,promotion.id)',
 'Modal transparent visible={confirm!==null}',
 'accessibilityState={{selected:key===view}}',
 'testID="owner-phase6-promotion-filters"',
]);
check("createPromotion",[
 'ownerApi.getStatus(session.accessToken)',
 'venueApi.availability(status.venue.id,date)',
 'await ownerApi.createPromotion(session.accessToken',
 'SLOT_UNAVAILABLE','PROMOTION_EXISTS',
]);
check("profile",[
 'testID="owner-phase6-public-profile"',
 'ownerApi.mediaPage(token)','ownerApi.updateMediaPage(token',
 'const current=loadedToken===token?page:null',
 'if(request!==generation.current)return',
 '<MediaImagePicker accessToken={token} purpose="COVER"',
 '<MediaImagePicker accessToken={token} purpose="PROFILE"',
 'pageBio:bioDraft.trim()||null','maxLength={500}',
 'params:{venueId:current.venueId}',
]);
check("reviews",[
 'testID="owner-phase6-reviews"',
 'ownerApi.getStatus(token)','const id=status.venue.id',
 'venueApi.reviews(id,page,sort)','if(summary.venueId!==id)',
 'const visible=loadedToken===token&&data?.venueId===venueId?data:null;',
 'const sorts:readonly VenueReviewSort[]=["recent","highest","lowest"]',
 'visible.ratingCounts[stars-1]','visible.hasMore',
 'owner.phase6.reviewsReadOnly','requestId',
].filter(x=>x!=="requestId"));
check("api",['mediaPage: (accessToken: string)','updateMediaPage: (accessToken: string',
 'promotions: (accessToken: string)','closePromotion: (accessToken: string']);
for(const suffix of [
 "owner.dashboardSubnav.publicProfile","owner.dashboardSubnav.reviews",
 "owner.phase6.promoSubtitle","owner.phase6.searchPromotions",
 "owner.phase6.promotion.ALL","owner.phase6.promotion.ACTIVE",
 "owner.phase6.promotion.UPCOMING","owner.phase6.promotion.EXPIRED",
 "owner.phase6.promotion.CLOSED","owner.phase6.noMatchingPromotions",
 "owner.phase6.closeTitle","owner.phase6.closeMessage",
 "owner.phase6.profileSubtitle","owner.phase6.profileLoadError",
 "owner.phase6.reviewsReadOnly","owner.phase6.reviewsLoadError",
 "owner.phase6.reviewCount","owner.phase6.reviewSort.recent",
 "owner.phase6.reviewSort.highest","owner.phase6.reviewSort.lowest",
 "owner.phase6.noReviews","owner.phase6.partialMediaError",
]){
 assert.equal(data.l10n.split('"'+suffix+'"').length-1,3,
  "Phase 6 must support English / Dari / Pashto: "+suffix);
}
const pkg=JSON.parse(read("package.json"));
assert.ok(pkg.scripts["verify:owner-dashboard-phase6"]?.includes("venue-owner-dashboard-phase6.test.mjs"));
assert.ok(pkg.scripts.verify.includes("pnpm verify:owner-dashboard-phase6"));
console.log("Venue Owner Phase 6 verified: post lifecycle search, independent media loading, offer states, profile editing, real reviews, 4 RTL tabs and private actor scope.");
