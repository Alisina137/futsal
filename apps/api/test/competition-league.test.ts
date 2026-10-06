import type { CompetitionCreateRequest } from "@leaguekick/contracts";
import { describe, expect, it } from "vitest";
import { CompetitionService } from "../src/modules/competition/competition.service.js";
import { FakeCompetitionRepository } from "./fake-competition-repository.js";

const NOW=new Date("2026-10-04T00:00:00.000Z");

function createInput():CompetitionCreateRequest{
  return {
    name:"Kabul League",
    description:"",
    format:"LEAGUE" as const,
    maxTeams:6,
    registrationFeeAfn:0,
    winPoints:3,
    drawPoints:1,
    lossPoints:0,
    tieBreakOrder:["POINTS","GOAL_DIFFERENCE","GOALS_FOR","HEAD_TO_HEAD","ADMIN"],
    groupCount:null,
    qualifiersPerGroup:null,
    registrationClosesAt:new Date(NOW.getTime()+4*24*60*60*1000).toISOString(),
    matchDurationMinutes:60,
    startsAt:null,
    endsAt:null,
  };
}

describe("Phase 6 league lifecycle",()=>{
  it("generates fixtures, recalculates standings from results, audits corrections by policy, and completes only when all fixtures finish",async()=>{
    const repository=new FakeCompetitionRepository();
    const ownerId="11111111-1111-4111-8111-111111111111";
    const venue=repository.seedVenue(ownerId);
    const service=new CompetitionService(repository,()=>NOW);

    const managers=[
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444",
    ];
    const teams=managers.map((manager,index)=>repository.seedTeam(manager,`Team ${index+1}`));

    const competition=await service.create(ownerId,createInput());
    await service.changeState(ownerId,competition.id,{action:"OPEN_REGISTRATION"});

    for(let index=0;index<teams.length;index+=1){
      await service.apply(managers[index]!,competition.id,{teamId:teams[index]!.id});
      await service.decideRegistration(ownerId,competition.id,teams[index]!.id,{status:"ACCEPTED",seed:index+1});
    }

    await service.changeState(ownerId,competition.id,{action:"CLOSE_REGISTRATION"});
    const generated=await service.changeState(ownerId,competition.id,{action:"GENERATE_FIXTURES"});
    expect(generated?.status).toBe("SCHEDULED");

    let ownerView=await service.getOwner(ownerId,competition.id);
    expect(ownerView.matches).toHaveLength(3);

    for(let index=0;index<ownerView.matches.length;index+=1){
      const match=ownerView.matches[index]!;
      await service.scheduleMatch(ownerId,competition.id,match.id,{
        areaId:venue.areas[0]!.id,
        startsAt:new Date(NOW.getTime()+(index+1)*3_600_000).toISOString(),
        endsAt:new Date(NOW.getTime()+(index+1)*3_600_000+60*60_000).toISOString(),
      });
    }

    ownerView=await service.getOwner(ownerId,competition.id);
    const [first,second,third]=ownerView.matches.sort((a,b)=>a.roundNumber-b.roundNumber||a.slotNumber-b.slotNumber);

    await service.enterResult(ownerId,competition.id,first!.id,{
      homeScore:2,awayScore:0,confirmImpact:false,playerStats:[],
    });

    await expect(service.changeState(ownerId,competition.id,{action:"COMPLETE"}))
      .rejects.toMatchObject({code:"MATCHES_INCOMPLETE"});

    await expect(service.enterResult(ownerId,competition.id,first!.id,{
      homeScore:1,awayScore:1,confirmImpact:false,playerStats:[],
    })).rejects.toMatchObject({code:"CORRECTION_REASON_REQUIRED"});

    await service.enterResult(ownerId,competition.id,first!.id,{
      homeScore:1,awayScore:1,correctionReason:"Official score correction",confirmImpact:false,playerStats:[],
    });
    await service.enterResult(ownerId,competition.id,second!.id,{
      homeScore:3,awayScore:1,confirmImpact:false,playerStats:[],
    });
    await service.enterResult(ownerId,competition.id,third!.id,{
      homeScore:0,awayScore:2,confirmImpact:false,playerStats:[],
    });

    ownerView=await service.getOwner(ownerId,competition.id);
    expect(ownerView.status).toBe("IN_PROGRESS");
    expect(ownerView.standings).toHaveLength(3);
    expect(ownerView.standings.every((row)=>row.played===2)).toBe(true);
    expect(ownerView.standings.reduce((sum,row)=>sum+row.points,0)).toBeGreaterThan(0);

    const completed=await service.changeState(ownerId,competition.id,{action:"COMPLETE"});
    expect(completed?.status).toBe("COMPLETED");
  });
});
