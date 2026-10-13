import {randomUUID} from "node:crypto";
import type {CompetitionCreateRequest} from "@leaguekick/contracts";
import {describe,expect,it} from "vitest";
import {CompetitionService} from "../src/modules/competition/competition.service.js";
import {FakeCompetitionRepository} from "./fake-competition-repository.js";

const NOW=new Date("2026-10-14T09:00:00Z");
const input:CompetitionCreateRequest={
  name:"Kabul Cup",description:"",format:"LEAGUE",maxTeams:4,
  registrationFeeAfn:500,winPoints:3,drawPoints:1,lossPoints:0,
  tieBreakOrder:["POINTS","GOAL_DIFFERENCE","GOALS_FOR"],
  groupCount:null,qualifiersPerGroup:null,
  registrationClosesAt:new Date(NOW.getTime()+5*86400000).toISOString(),
  matchDurationMinutes:60,startsAt:null,endsAt:null,
};
describe("Competition directory Phase 1 — authenticated My Competitions",()=>{
  it("returns only published competitions involving the requested user's own team",async()=>{
    const repo=new FakeCompetitionRepository(),owner=randomUUID();
    repo.seedVenue(owner,{subscriptionStatus:"ACTIVE",activeUntil:new Date("2027-01-01T00:00:00Z")});
    const managerA=randomUUID(),managerB=randomUUID(),unrelated=randomUUID();
    const teamA=repo.seedTeam(managerA,"Team A"),teamB=repo.seedTeam(managerB,"Team B");
    const service=new CompetitionService(repo,()=>NOW);
    const competitionA=await service.create(owner,input);
    const competitionB=await service.create(owner,{...input,name:"Other League"});
    const draft=await service.create(owner,{...input,name:"Secret Draft"});
    for(const id of [competitionA.id,competitionB.id]){
      const existing=repo.competitions.get(id)!;
      repo.competitions.set(id,{...existing,status:"REGISTRATION_OPEN",published:true});
    }
    repo.registrations.set(competitionA.id+":"+teamA.id,{
      competitionId:competitionA.id,teamId:teamA.id,teamName:teamA.name,logoUrl:null,
      managerUserId:managerA,teamPrivacy:"PUBLIC",offlineVenueId:null,claimedAt:null,
      status:"APPLIED",seed:null,groupId:null,groupName:null,feeStatus:"UNPAID",
      feePaymentReference:null,feeConfirmedAt:null,
    });
    repo.registrations.set(competitionB.id+":"+teamB.id,{
      competitionId:competitionB.id,teamId:teamB.id,teamName:teamB.name,logoUrl:null,
      managerUserId:managerB,teamPrivacy:"PUBLIC",offlineVenueId:null,claimedAt:null,
      status:"ACCEPTED",seed:null,groupId:null,groupName:null,feeStatus:"PAID",
      feePaymentReference:null,feeConfirmedAt:null,
    });
    const publicList=await service.listPublic();
    expect(publicList.competitions.map(c=>c.id)).toEqual(expect.arrayContaining([
      competitionA.id,competitionB.id,
    ]));
    expect(publicList.competitions.map(c=>c.id)).not.toContain(draft.id);

    const mineA=await service.listMyPublic(managerA);
    expect(mineA.competitions.map(c=>c.id)).toEqual([competitionA.id]);
    expect(mineA.competitions[0]).toMatchObject({acceptedTeams:0,maxTeams:4,registrationFeeAfn:500});
    const mineB=await service.listMyPublic(managerB);
    expect(mineB.competitions.map(c=>c.id)).toEqual([competitionB.id]);
    const none=await service.listMyPublic(unrelated);
    expect(none.competitions).toEqual([]);
  });
});
