import {randomUUID} from "node:crypto";
import {competitionDiscoveryQuerySchema,type CompetitionCreateRequest} from "@leaguekick/contracts";
import {describe,expect,it} from "vitest";
import {CompetitionService} from "../src/modules/competition/competition.service.js";
import {FakeCompetitionRepository} from "./fake-competition-repository.js";

const now=new Date("2026-10-14T09:00:00Z");
const base:CompetitionCreateRequest={
  name:"Competition",description:"",format:"LEAGUE",maxTeams:4,
  registrationFeeAfn:500,winPoints:3,drawPoints:1,lossPoints:0,
  tieBreakOrder:["POINTS","GOAL_DIFFERENCE","GOALS_FOR"],
  groupCount:null,qualifiersPerGroup:null,registrationClosesAt:"2026-11-01T12:00:00Z",
  matchDurationMinutes:60,startsAt:"2026-11-03T12:00:00Z",endsAt:null,
};
function setup(){
  const repo=new FakeCompetitionRepository(),owner=randomUUID();
  const venue=repo.seedVenue(owner,{subscriptionStatus:"ACTIVE",activeUntil:new Date("2027-01-01T00:00:00Z")});
  return {repo,owner,venue,service:new CompetitionService(repo,()=>now)};
}
const filters=(overrides:Record<string,unknown>={})=>
  competitionDiscoveryQuerySchema.parse({...overrides});
describe("Competition Phase 2 discovery",()=>{
  it("validates date and fee bounds, scope and pagination",()=>{
    expect(filters().page).toBe(1);
    expect(filters({page:"2",limit:"8",fee:"paid",sort:"popular"})).toMatchObject({page:2,limit:8});
    for(const bad of [
      {page:0},{page:501},{limit:31},{q:"X".repeat(121)},
      {minFee:400,maxFee:100},{from:"2026-02-30"},{from:"2026-11-01",to:"2026-10-31"},
      {sort:"random"},{scope:"PRIVATE"},{status:"DRAFT"}, {minFee:-1},
    ])expect(()=>filters(bad)).toThrow();
  });
  it("filters literal search by venue/name, format, status, fee and dates with server totals",async()=>{
    const {repo,owner,service}=setup();
    const a=await service.create(owner,{...base,name:"Alpha Club",format:"LEAGUE"});
    const b=await service.create(owner,{...base,name:"Beta League",format:"KNOCKOUT",registrationFeeAfn:0,
      startsAt:"2026-11-05T12:00:00Z"});
    const draft=await service.create(owner,{...base,name:"Never Reveal"});
    for(const row of [a,b]){
      const record=repo.competitions.get(row.id)!;
      repo.competitions.set(row.id,{...record,published:true,status:"REGISTRATION_OPEN"});
    }
    expect((await service.discoverPublic(filters({q:"Kabul"}))).total).toBe(2);
    expect((await service.discoverPublic(filters({q:"Alpha",fee:"paid",format:"LEAGUE"}))).total).toBe(1);
    expect((await service.discoverPublic(filters({q:"Never"}))).total).toBe(0);
    expect((await service.discoverPublic(filters({format:"KNOCKOUT",fee:"free"}))).total).toBe(1);
    expect((await service.discoverPublic(filters({from:"2026-11-05",to:"2026-11-05"}))).total).toBe(1);
    const first=await service.discoverPublic(filters({limit:1,page:1,sort:"starting"}));
    const second=await service.discoverPublic(filters({limit:1,page:2,sort:"starting"}));
    expect(first.total).toBe(2);
    expect(first.hasMore).toBe(true);
    expect(second.hasMore).toBe(false);
    expect(first.competitions[0]?.id).not.toBe(second.competitions[0]?.id);
    expect((await service.discoverPublic(filters({province:"Herat"}))).total).toBe(0);
    expect((await service.discoverPublic(filters({status:"COMPLETED"}))).total).toBe(0);
    expect((await service.discoverPublic(filters({fee:"paid",minFee:600}))).total).toBe(0);
    expect((await service.discoverPublic(filters())).competitions.some(x=>x.id===draft.id)).toBe(false);
  });
  it("prevents anonymous user-specific scopes and scopes followed or involved tournaments per identity",async()=>{
    const {repo,owner,venue,service}=setup();
    const personA=randomUUID(),personB=randomUUID();
    const first=await service.create(owner,{...base,name:"A"});
    const second=await service.create(owner,{...base,name:"B"});
    for(const item of [first,second]){
      const row=repo.competitions.get(item.id)!;
      repo.competitions.set(item.id,{...row,published:true,status:"IN_PROGRESS"});
    }
    repo.followedCompetitions.set(personA,new Set([first.id]));
    repo.followedCompetitions.set(personB,new Set([second.id]));
    repo.followedVenues.set(personA,new Set([venue.id]));
    const team=repo.seedTeam(personA);
    repo.registrations.set(first.id+":"+team.id,{
      competitionId:first.id,teamId:team.id,teamName:team.name,logoUrl:null,
      managerUserId:personA,teamPrivacy:"PUBLIC",offlineVenueId:null,claimedAt:null,
      status:"APPLIED",seed:null,groupId:null,groupName:null,feeStatus:"UNPAID",
      feePaymentReference:null,feeConfirmedAt:null,
    });
    for(const scope of ["following","mine","ongoingFollowedVenues"] as const){
      await expect(service.discoverPublic(filters({scope}))).rejects.toMatchObject({statusCode:401});
    }
    expect((await service.discoverPublic(filters({scope:"following"}),personA)).competitions.map(x=>x.id))
      .toEqual([first.id]);
    expect((await service.discoverPublic(filters({scope:"following"}),personB)).competitions.map(x=>x.id))
      .toEqual([second.id]);
    expect((await service.discoverPublic(filters({scope:"mine"}),personA)).competitions.map(x=>x.id))
      .toEqual([first.id]);
    expect((await service.discoverPublic(filters({scope:"mine"}),personB)).total).toBe(0);
    expect((await service.discoverPublic(filters({scope:"ongoingFollowedVenues"}),personA)).total).toBe(2);
    expect((await service.discoverPublic(filters({scope:"ongoingFollowedVenues"}),personB)).total).toBe(0);
  });
});
