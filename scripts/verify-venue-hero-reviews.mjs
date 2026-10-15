import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const screen=read("apps/mobile/app/(app)/venues/[venueId].tsx");
const badge=read("apps/mobile/src/components/venues/VenueHeroReviewBadge.tsx");
const api=read("apps/mobile/src/lib/api.ts");
const contracts=read("packages/contracts/src/index.ts");
const locales=read("packages/localization/src/index.ts");
const pkg=JSON.parse(read("package.json"));
function includes(source,parts,area){
  for(const marker of parts)assert.ok(source.includes(marker),area+": "+marker);
}
includes(screen,[
  'resolveMediaImageUrl(venue.pageCoverImageUrl)',
  '<Image source={{uri:resolveMediaImageUrl(venue.pageCoverImageUrl)!}}',
  'cover:{height:184',
  'paddingTop:spacing.md',
  '<VenueHeroReviewBadge venueId={venue.id}',
  'onOpenReviews={()=>chooseMain("about","reviews")}',
  'chooseMain("reserve","slots")',
  'style={[styles.actions,{flexDirection:isRTL?"row-reverse":"row"}]}',
  'onPress={()=>reserve()}',
  'onPress={()=>void toggleFollow()}',
], "Venue hero cover, rating and actions");
assert.ok(!screen.includes("pageProfileImageUrl")&&!screen.includes("avatarFrame")&&
  !screen.includes("styles.avatar")&&!screen.includes("marginTop:-44"),
  "No overlapping circular profile avatar or avatar fallback may appear in the hero.");
const nameAt=screen.indexOf('>{venue.name}</AppText>',screen.indexOf('<View style={styles.identity}>'));
const ratingAt=screen.indexOf('<VenueHeroReviewBadge venueId={venue.id}');
const locationAt=screen.indexOf('<View style={[styles.location,');
const actionsAt=screen.indexOf('<View style={[styles.actions,');
assert.ok(nameAt>0&&nameAt<ratingAt&&ratingAt<locationAt&&locationAt<actionsAt,
  "Show the actual venue review result immediately beneath the title, before location and actions.");
includes(badge,[
  'venueApi.reviews(venueId)',
  'const request=++requestSequence.current',
  'if(request!==requestSequence.current)return',
  'venueHeroReviewFacts(result,venueId)',
  'return()=>{requestSequence.current+=1;}',
  'loadedVenueId===venueId?venueHeroReviewFacts(facts,venueId):null',
  'venueHeroHasRating(safe)',
  'safe!.averageRating.toFixed(1)+" / 5"',
  't("booking.community.reviewsCount",{count:safe!.reviewCount})',
  't("vd2.ratingNotAvailable")',
  't("vd2.customerReviews")',
  'onPress={onOpenReviews}',
  'accessibilityRole="button"',
  'testID="venue-hero-reviews"',
  'flexDirection:isRTL?"row-reverse":"row"',
], "Scoped verified customer rating badge");
includes(api,['reviews:(venueId:string,page=1,sort:','networkRequest<VenueReviewSummary>'],
  "Actual public venue reviews API");
includes(contracts,['venueReviewSummarySchema=z.object({',
  'venueId:z.string().uuid()','averageRating:z.number().min(0).max(5)',
  'reviewCount:z.number().int().nonnegative()'],
  "Review contract");
for(const key of ["vd2.ratingNotAvailable","vd2.customerReviews",
  "booking.community.reviewsCount"]){
  assert.equal(locales.split('"'+key+'"').length-1,3,
    "Review badge translations missing for EN, Dari, Pashto: "+key);
}
assert.ok(pkg.scripts["verify:venue-hero-reviews"]?.includes("venue-hero-reviews.test.mjs"));
assert.ok(pkg.scripts.verify.includes("pnpm verify:venue-hero-reviews"));
console.log("Venue hero verified: cover-only profile (no avatar), venue-scoped real star rating/review count, unrated/failure-safe CTA, about-reviews navigation, RTL and booking/follow preservation.");
