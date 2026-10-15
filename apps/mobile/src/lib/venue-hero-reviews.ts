/** Display only verified public review aggregates belonging to the visible venue.
 * A zero-review venue is unrated, never a fake 0.0-star venue. */
export type VenueHeroReviewFacts={
  venueId:string;averageRating:number;reviewCount:number;
};
export function venueHeroReviewFacts(
  value:VenueHeroReviewFacts|null|undefined,venueId:string,
):VenueHeroReviewFacts|null{
  if(!value||value.venueId!==venueId||
    !Number.isFinite(value.averageRating)||value.averageRating<0||value.averageRating>5||
    !Number.isSafeInteger(value.reviewCount)||value.reviewCount<0)return null;
  return value;
}
export function venueHeroHasRating(facts:VenueHeroReviewFacts|null):boolean{
  return facts!==null&&facts.reviewCount>0;
}
