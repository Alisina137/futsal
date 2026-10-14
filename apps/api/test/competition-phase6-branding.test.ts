import {randomUUID} from "node:crypto";
import {competitionUpdateRequestSchema,competitionDtoSchema,competitionListItemDtoSchema} from "@leaguekick/contracts";
import type {CompetitionCreateRequest} from "@leaguekick/contracts";
import {describe,it,expect} from "vitest";
import {CompetitionService} from "../src/modules/competition/competition.service.js";
import {FakeCompetitionRepository} from "./fake-competition-repository.js";

const NOW=new Date("2026-10-14T04:00:00.000Z");
const owner=randomUUID();
const otherOwner=randomUUID();
const request:CompetitionCreateRequest={
  name:"Herat Championship",description:"Public matches",format:"LEAGUE",
  maxTeams:8,registrationFeeAfn:0,winPoints:3,drawPoints:1,lossPoints:0,
  tieBreakOrder:["POINTS","GOAL_DIFFERENCE","GOALS_FOR"],
  groupCount:null,qualifiersPerGroup:null,
  registrationClosesAt:new Date(NOW.getTime()+5*86400000).toISOString(),
  matchDurationMinutes:60,startsAt:null,endsAt:null,
};
const imageUrl=()=>`/api/v1/media-assets/${randomUUID()}/${"a".repeat(32)}`;
function setup(){
  const repo=new FakeCompetitionRepository();
  const venue=repo.seedVenue(owner,{subscriptionStatus:"ACTIVE",activeUntil:new Date("2026-12-31T00:00:00Z")});
  const other=repo.seedVenue(otherOwner,{subscriptionStatus:"ACTIVE",activeUntil:new Date("2026-12-31T00:00:00Z")});
  return {repo,venue,other,service:new CompetitionService(repo,()=>NOW)};
}
describe("Competition Phase 6 — permanent branding",()=>{
  it("validates immutable upload URLs and disallows external sources",()=>{
    expect(competitionUpdateRequestSchema.safeParse({logoUrl:null,coverImageUrl:null}).success).toBe(true);
    expect(competitionUpdateRequestSchema.safeParse({logoUrl:imageUrl()}).success).toBe(true);
    for(const url of ["https://example.com/untrusted.png","http://example.com/insecure.jpg",
      "/api/v1/media-assets/invalid/token","/api/v1/social/post-images/"+randomUUID()+"/"+"a".repeat(32),
      "javascript:alert(1)"]){
      expect(competitionUpdateRequestSchema.safeParse({logoUrl:url}).success).toBe(false);
    }
  });

  it("sets, reads, replaces and clears stored images; drafts stay private",async()=>{
    const {repo,venue,service}=setup();
    const created=await service.create(owner,request);
    expect(created.logoUrl).toBeNull();
    expect(created.coverImageUrl).toBeNull();
    const logo=imageUrl(),cover=imageUrl(),newLogo=imageUrl();
    repo.brandAssets.set(logo,{venueId:venue.id,ownerUserId:owner,purpose:"PROFILE"});
    repo.brandAssets.set(cover,{venueId:venue.id,ownerUserId:owner,purpose:"COVER"});
    repo.brandAssets.set(newLogo,{venueId:venue.id,ownerUserId:owner,purpose:"PROFILE"});
    const updated=await service.update(owner,created.id,{logoUrl:logo,coverImageUrl:cover});
    expect(updated).toMatchObject({logoUrl:logo,coverImageUrl:cover});
    expect(competitionDtoSchema.parse(updated).logoUrl).toBe(logo);
    await expect(service.getPublic(created.id)).rejects.toMatchObject({code:"COMPETITION_NOT_FOUND"});
    await service.changeState(owner,created.id,{action:"OPEN_REGISTRATION"});
    const pub=await service.getPublic(created.id);
    expect(pub.logoUrl).toBe(logo);
    expect(pub.coverImageUrl).toBe(cover);
    const listing=await service.listPublic();
    expect(competitionListItemDtoSchema.parse(listing.competitions.find(c=>c.id===created.id)).logoUrl).toBe(logo);
    const discover=await service.discoverPublic({
      q:"",province:"",city:"",status:undefined,format:undefined,fee:"any",
      sort:"recommended",scope:"all",phase:"all",page:1,limit:20,
    });
    expect(discover.competitions.find(c=>c.id===created.id)?.logoUrl).toBe(logo);
    expect((await service.update(owner,created.id,{logoUrl:newLogo})).coverImageUrl).toBe(cover);
    expect(await service.update(owner,created.id,{logoUrl:null,coverImageUrl:null}))
      .toMatchObject({logoUrl:null,coverImageUrl:null});
  });

  it("rejects cross-venue assets, missing tokens and wrong upload purposes",async()=>{
    const {repo,venue,other,service}=setup();
    const created=await service.create(owner,request);
    const wrongVenue=imageUrl(),wrongPurpose=imageUrl(),unknown=imageUrl();
    repo.brandAssets.set(wrongVenue,{venueId:other.id,ownerUserId:otherOwner,purpose:"PROFILE"});
    repo.brandAssets.set(wrongPurpose,{venueId:venue.id,ownerUserId:owner,purpose:"COVER"});
    for(const logoUrl of [wrongVenue,wrongPurpose,unknown]){
      await expect(service.update(owner,created.id,{logoUrl})).rejects.toMatchObject({
        code:"COMPETITION_BRAND_ASSET_DENIED",statusCode:403,
      });
      expect((await service.getOwner(owner,created.id)).logoUrl).toBeNull();
    }
    const good=imageUrl();
    repo.brandAssets.set(good,{venueId:venue.id,ownerUserId:owner,purpose:"PROFILE"});
    await expect(service.update(otherOwner,created.id,{logoUrl:good}))
      .rejects.toMatchObject({code:"COMPETITION_ACCESS_DENIED"});
    expect((await service.getOwner(owner,created.id)).logoUrl).toBeNull();
  });

  it("keeps a duplicated competition unbranded rather than silently reusing an old identity",async()=>{
    const {repo,venue,service}=setup();
    const created=await service.create(owner,request);
    const logo=imageUrl();
    repo.brandAssets.set(logo,{venueId:venue.id,ownerUserId:owner,purpose:"PROFILE"});
    await service.update(owner,created.id,{logoUrl:logo});
    const copy=await service.duplicate(owner,created.id);
    expect(copy.logoUrl).toBeNull();
    expect(copy.coverImageUrl).toBeNull();
    expect(copy.published).toBe(false);
  });
});
