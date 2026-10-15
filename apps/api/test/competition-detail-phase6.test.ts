import {randomUUID} from "node:crypto";
import type {CompetitionCreateRequest} from "@leaguekick/contracts";
import {describe,it,expect} from "vitest";
import {CompetitionService} from "../src/modules/competition/competition.service.js";
import {FakeCompetitionRepository} from "./fake-competition-repository.js";

const now=new Date("2026-10-15T06:00:00.000Z");
const input:CompetitionCreateRequest={
  name:"Public Phase 6 Cup",description:"Public aggregate regression",format:"LEAGUE",maxTeams:4,
  registrationFeeAfn:0,winPoints:3,drawPoints:1,lossPoints:0,
  tieBreakOrder:["POINTS","GOAL_DIFFERENCE","GOALS_FOR","HEAD_TO_HEAD","ADMIN"],
  groupCount:null,qualifiersPerGroup:null,
  registrationClosesAt:"2026-10-20T06:00:00.000Z",
  matchDurationMinutes:60,startsAt:null,endsAt:null,
};

describe("Competition Detail Phase 6: safe public team disciplinary aggregates",()=>{
  it("only releases accepted team totals, no identity or private team fee reference",async()=>{
    const repo=new FakeCompetitionRepository();
    const owner=randomUUID();
    repo.seedVenue(owner,{subscriptionStatus:"ACTIVE",activeUntil:new Date("2027-01-01")});
    const service=new CompetitionService(repo,()=>now);
    const competition=await service.create(owner,input);
    const accepted=repo.seedTeam(randomUUID(),"Accepted");
    const removed=repo.seedTeam(randomUUID(),"Removed");
    for(const [team,status] of [[accepted,"ACCEPTED"],[removed,"WITHDRAWN"]] as const){
      repo.registrations.set(`${competition.id}:${team.id}`,{
        competitionId:competition.id,teamId:team.id,teamName:team.name,logoUrl:null,
        managerUserId:team.managerUserId,teamPrivacy:"PUBLIC",offlineVenueId:null,claimedAt:null,
        status,seed:null,groupId:null,groupName:null,feeStatus:"UNPAID",
        feePaymentReference:"SECRET-PAYMENT",feeConfirmedAt:null,
      });
    }
    const record=repo.competitions.get(competition.id)!;
    repo.competitions.set(competition.id,{...record,published:true,status:"IN_PROGRESS"});
    const fetchDto=repo.getCompetitionDto.bind(repo);
    repo.getCompetitionDto=async id=>{
      const dto=await fetchDto(id);
      return dto?{...dto,teamDisciplineStats:[
        {teamId:accepted.id,yellowCards:2,redCards:1},
        {teamId:removed.id,yellowCards:10,redCards:5},
      ]}:null;
    };
    const publicDto=await service.getPublic(competition.id);
    expect(publicDto.teams.map(t=>t.teamId)).toEqual([accepted.id]);
    expect(publicDto.teamDisciplineStats).toEqual([
      {teamId:accepted.id,yellowCards:2,redCards:1},
    ]);
    expect(publicDto.teams[0]?.feePaymentReference).toBeNull();
    expect(JSON.stringify(publicDto.teamDisciplineStats)).not.toContain("SECRET");
    expect(JSON.stringify(publicDto.teamDisciplineStats)).not.toContain("playerUserId");
  });
});
