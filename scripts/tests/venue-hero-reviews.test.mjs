import assert from "node:assert/strict";
import {test} from "node:test";
import {venueHeroHasRating,venueHeroReviewFacts} from
  "../../apps/mobile/src/lib/venue-hero-reviews.ts";
const venueA="11111111-1111-4111-8111-111111111111";
const venueB="22222222-2222-4222-8222-222222222222";
test("only same-venue verified review summaries are eligible for hero display",()=>{
  const current={venueId:venueA,averageRating:4.75,reviewCount:8};
  assert.deepEqual(venueHeroReviewFacts(current,venueA),current);
  assert.equal(venueHeroReviewFacts(current,venueB),null);
  assert.equal(venueHeroReviewFacts(null,venueA),null);
  assert.equal(venueHeroHasRating(venueHeroReviewFacts(current,venueA)),true);
});
test("zero reviews and invalid aggregates never fabricate a zero-star rating",()=>{
  const empty=venueHeroReviewFacts({venueId:venueA,averageRating:0,reviewCount:0},venueA);
  assert.equal(venueHeroHasRating(empty),false);
  assert.equal(venueHeroHasRating(null),false);
  for(const bad of [
    {venueId:venueA,averageRating:-1,reviewCount:1},
    {venueId:venueA,averageRating:5.01,reviewCount:1},
    {venueId:venueA,averageRating:NaN,reviewCount:1},
    {venueId:venueA,averageRating:2,reviewCount:-1},
    {venueId:venueA,averageRating:2,reviewCount:1.5},
    {venueId:venueA,averageRating:2,reviewCount:Infinity},
  ])assert.equal(venueHeroReviewFacts(bad,venueA),null,JSON.stringify(bad));
});
