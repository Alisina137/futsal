import {randomUUID} from "node:crypto";
import {
  competitionRewardsUpdateRequestSchema,
  type CompetitionCreateRequest,
  type CompetitionRewardDto,
} from "@leaguekick/contracts";
import {describe,expect,it} from "vitest";
import {CompetitionService} from "../src/modules/competition/competition.service.js";
import {FakeCompetitionRepository} from "./fake-competition-repository.js";

const TODAY=new Date("2026-10-10T08:00:00Z");
const template:CompetitionCreateRequest={
  name:"Kabul Prize Cup",description:"League rewards",format:"LEAGUE",maxTeams:8,
  registrationFeeAfn:0,winPoints:3,drawPoints:1,lossPoints:0,
  tieBreakOrder:["POINTS","GOAL_DIFFERENCE","GOALS_FOR"],
  groupCount:null,qualifiersPerGroup:null,registrationClosesAt:null,
  matchDurationMinutes:60,startsAt:null,endsAt:null,
};
const prizes:CompetitionRewardDto[]=[
  {category:"TEAM",title:"Champion",prize:"Trophy + AFN 15,000",description:"Winning team"},
  {category:"TEAM",title:"Runner-up",prize:"Silver cup",description:null},
  {category:"INDIVIDUAL",title:"Top scorer",prize:"Golden boot",description:"Most goals"},
];
function setup(){
  const repo=new FakeCompetitionRepository();
  const owner=randomUUID();
  repo.seedVenue(owner,{subscriptionStatus:"ACTIVE",activeUntil:new Date("2026-12-31T00:00:00Z")});
  const svc=new CompetitionService(repo,()=>TODAY);
  return {repo,owner,svc};
}
describe("Competition announced rewards",()=>{
  it("announces multiple team and player prizes that become public only when competition is published",async()=>{
    const {repo,owner,svc}=setup();
    const created=await svc.create(owner,template);
    expect(created.rewards).toEqual([]);
    const updated=await svc.replaceRewards(owner,created.id,prizes);
    expect(updated?.rewards).toEqual(prizes);
    await expect(svc.getPublic(created.id)).rejects.toMatchObject({code:"COMPETITION_NOT_FOUND"});
    const previous=repo.competitions.get(created.id)!;
    repo.competitions.set(created.id,{...previous,published:true,status:"REGISTRATION_OPEN"});
    expect((await svc.getPublic(created.id)).rewards).toEqual(prizes);
    const modified=await svc.replaceRewards(owner,created.id,[prizes[0]!]);
    expect(modified?.rewards).toHaveLength(1);
    expect((await svc.getPublic(created.id)).rewards).toEqual([prizes[0]!]);
    await svc.replaceRewards(owner,created.id,[]);
    expect((await svc.getPublic(created.id)).rewards).toEqual([]);
  });
  it("rejects different-venue owner, expired owner subscription and locked competitions",async()=>{
    const {repo,owner,svc}=setup();
    const first=await svc.create(owner,template);
    const other= randomUUID();
    repo.seedVenue(other,{subscriptionStatus:"ACTIVE",activeUntil:new Date("2026-12-31T00:00:00Z")});
    await expect(svc.replaceRewards(other,first.id,prizes))
      .rejects.toMatchObject({code:"COMPETITION_ACCESS_DENIED"});
    const row=repo.competitions.get(first.id)!;
    repo.competitions.set(first.id,{...row,status:"ARCHIVED"});
    await expect(svc.replaceRewards(owner,first.id,prizes))
      .rejects.toMatchObject({code:"COMPETITION_REWARDS_LOCKED"});
    repo.competitions.set(first.id,{...row,status:"CANCELLED"});
    await expect(svc.replaceRewards(owner,first.id,prizes))
      .rejects.toMatchObject({code:"COMPETITION_REWARDS_LOCKED"});
    const venue=repo.venues.get(owner)!;
    repo.venues.set(owner,{...venue,subscription:{status:"EXPIRED",activeUntil:null,trialEndsAt:null}});
    await expect(svc.replaceRewards(owner,first.id,prizes))
      .rejects.toMatchObject({code:"SUBSCRIPTION_REQUIRED"});
  });
  it("validates reward categories, text lengths, max thirty and duplicate titles",()=>{
    expect(competitionRewardsUpdateRequestSchema.parse({rewards:prizes})).toEqual({rewards:prizes});
    for(const rewards of [
      [...prizes,{...prizes[0]!,title:"champion"}],
      [{...prizes[0]!,category:"ANYTHING"}],
      [{...prizes[0]!,prize:""}],
      [{...prizes[0]!,title:"x"}],
      Array.from({length:31},(_,i)=>({...prizes[0]!,title:`Award ${i}`})),
    ]){
      expect(competitionRewardsUpdateRequestSchema.safeParse({rewards}).success).toBe(false);
    }
    expect(competitionRewardsUpdateRequestSchema.safeParse({rewards:[
      {...prizes[0]!,title:"Best Player",category:"TEAM"},
      {...prizes[0]!,title:"Best Player",category:"INDIVIDUAL"},
    ]}).success).toBe(true);
  });
});
