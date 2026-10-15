import {randomUUID} from "node:crypto";
import type {CompetitionCreateRequest,CompetitionMediaPostDto} from "@leaguekick/contracts";
import {describe,it,expect} from "vitest";
import {CompetitionService} from "../src/modules/competition/competition.service.js";
import {FakeCompetitionRepository} from "./fake-competition-repository.js";

const now=new Date("2026-10-15T07:00:00.000Z");
const input:CompetitionCreateRequest={
  name:"Media Test Cup",description:"Media safety regression",format:"LEAGUE",
  maxTeams:4,registrationFeeAfn:0,winPoints:3,drawPoints:1,lossPoints:0,
  tieBreakOrder:["POINTS","GOAL_DIFFERENCE","GOALS_FOR","HEAD_TO_HEAD","ADMIN"],
  groupCount:null,qualifiersPerGroup:null,
  registrationClosesAt:"2026-10-20T06:00:00.000Z",
  matchDurationMinutes:60,startsAt:null,endsAt:null,
};

describe("Competition Detail Phase 7: public media scope and pagination",()=>{
  it("returns stable pages of only published competition posts and real photo rows",async()=>{
    const repository=new FakeCompetitionRepository();
    const owner=randomUUID();
    repository.seedVenue(owner,{subscriptionStatus:"ACTIVE",activeUntil:new Date("2027-01-01")});
    const service=new CompetitionService(repository,()=>now);
    const cup=await service.create(owner,input);
    const record=repository.competitions.get(cup.id)!;
    repository.competitions.set(cup.id,{...record,published:true,status:"IN_PROGRESS"});
    const otherId=randomUUID();
    const post=(competitionId:string,body:string,imageUrl:string|null,
      status:"PUBLISHED"|"UNPUBLISHED"="PUBLISHED"):CompetitionMediaPostDto=>({
      id:randomUUID(),competitionId,body,imageUrl,status,
      publishedAt:"2026-10-15T07:00:00.000Z",unpublishedAt:null,
    });
    for(const item of [
      post(cup.id,"alpha","https://example.com/1.jpg"),
      post(cup.id,"beta",null),
      post(cup.id,"gamma","https://example.com/2.jpg"),
      post(cup.id,"private draft","https://example.com/private.jpg","UNPUBLISHED"),
      post(otherId,"other competition","https://example.com/other.jpg"),
    ])repository.mediaPosts.set(item.id,item);

    const first=await service.listPublicMediaPage(cup.id,{
      page:1,limit:2,kind:"all",sort:"newest",
    });
    const second=await service.listPublicMediaPage(cup.id,{
      page:2,limit:2,kind:"all",sort:"newest",
    });
    expect(first.posts).toHaveLength(2);
    expect(first.hasMore).toBe(true);
    expect(second.posts).toHaveLength(1);
    expect(second.hasMore).toBe(false);
    expect([...first.posts,...second.posts].map(x=>x.body).sort()).toEqual(
      ["alpha","beta","gamma"]);
    const photos=await service.listPublicMediaPage(cup.id,{
      page:1,limit:12,kind:"photos",sort:"oldest",
    });
    expect(photos.posts.map(x=>x.body).sort()).toEqual(["alpha","gamma"]);
    expect(photos.posts.every(x=>x.status==="PUBLISHED")).toBe(true);
    // Legacy no-query route must preserve its old posts-only response.
    const legacy=await service.listPublicMedia(cup.id);
    expect("posts" in legacy).toBe(true);
    expect(legacy.posts.every(x=>x.competitionId===cup.id&&x.status==="PUBLISHED")).toBe(true);
  });

  it("never publishes draft competitions through the media endpoint",async()=>{
    const repository=new FakeCompetitionRepository();
    const owner=randomUUID();
    repository.seedVenue(owner,{subscriptionStatus:"ACTIVE",activeUntil:new Date("2027-01-01")});
    const service=new CompetitionService(repository,()=>now);
    const cup=await service.create(owner,input);
    await expect(service.listPublicMediaPage(cup.id,{
      page:1,limit:12,kind:"all",sort:"newest",
    })).rejects.toBeTruthy();
  });
});
