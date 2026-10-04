import type { CompetitionCreateRequest } from "@leaguekick/contracts";
import { describe, expect, it } from "vitest";
import { CompetitionService } from "../src/modules/competition/competition.service.js";
import { FakeCompetitionRepository } from "./fake-competition-repository.js";

const NOW=new Date("2026-10-04T00:00:00.000Z");

function input(format:"KNOCKOUT"|"GROUP_KNOCKOUT"):CompetitionCreateRequest{
  return {
    name:format==="KNOCKOUT"?"Kabul Cup":"Kabul Groups Cup",
    description:"",
    format,
    maxTeams:8,
    registrationFeeAfn:0,
    winPoints:3,
    drawPoints:1,
    lossPoints:0,
    tieBreakOrder:["POINTS","GOAL_DIFFERENCE","GOALS_FOR","HEAD_TO_HEAD","ADMIN"],
    groupCount:format==="GROUP_KNOCKOUT"?2:null,
    qualifiersPerGroup:format==="GROUP_KNOCKOUT"?1:null,
    startsAt:null,
    endsAt:null,
  };
}

async function acceptTeams(
  service:CompetitionService,
  repository:FakeCompetitionRepository,
  ownerId:string,
  competitionId:string,
  count:number,
){
  const result=[] as Array<{id:string;manager:string}>;
  for(let index=0;index<count;index+=1){
    const manager=`00000000-0000-4000-8000-${String(index+10).padStart(12,"0")}`;
    const team=repository.seedTeam(manager,`Team ${index+1}`);
    await service.apply(manager,competitionId,{teamId:team.id});
    await service.decideRegistration(ownerId,competitionId,team.id,{status:"ACCEPTED",seed:index+1});
    result.push({id:team.id,manager});
  }
  return result;
}

async function schedule(
  service:CompetitionService,
  ownerId:string,
  competitionId:string,
  matchId:string,
  areaId:string,
  offsetHours:number,
){
  return service.scheduleMatch(ownerId,competitionId,matchId,{
    areaId,
    startsAt:new Date(NOW.getTime()+offsetHours*3_600_000).toISOString(),
    endsAt:new Date(NOW.getTime()+(offsetHours+1)*3_600_000).toISOString(),
  });
}

describe("Phase 6 knockout and group-to-knockout",()=>{
  it("handles a bye, advances winners, and protects a scheduled downstream bracket from silent correction",async()=>{
    const repository=new FakeCompetitionRepository();
    const ownerId="11111111-1111-4111-8111-111111111111";
    const venue=repository.seedVenue(ownerId);
    const service=new CompetitionService(repository,()=>NOW);
    const competition=await service.create(ownerId,input("KNOCKOUT"));
    await service.changeState(ownerId,competition.id,{action:"OPEN_REGISTRATION"});
    await acceptTeams(service,repository,ownerId,competition.id,3);
    await service.changeState(ownerId,competition.id,{action:"CLOSE_REGISTRATION"});
    await service.changeState(ownerId,competition.id,{action:"GENERATE_FIXTURES"});

    let view=await service.getOwner(ownerId,competition.id);
    const semi=view.matches.find((match)=>match.roundNumber===2)!;
    const finalBefore=view.matches.find((match)=>match.roundNumber===1)!;
    expect(view.matches).toHaveLength(2);
    expect([finalBefore.homeTeamId,finalBefore.awayTeamId].filter(Boolean)).toHaveLength(1);

    await schedule(service,ownerId,competition.id,semi.id,venue.areas[0]!.id,1);
    await service.enterResult(ownerId,competition.id,semi.id,{
      homeScore:2,awayScore:1,confirmImpact:false,playerStats:[],
    });

    view=await service.getOwner(ownerId,competition.id);
    const final=view.matches.find((match)=>match.roundNumber===1)!;
    expect(final.homeTeamId&&final.awayTeamId).toBeTruthy();

    await schedule(service,ownerId,competition.id,final.id,venue.areas[0]!.id,3);

    await expect(service.enterResult(ownerId,competition.id,semi.id,{
      homeScore:0,
      awayScore:1,
      correctionReason:"Official correction",
      confirmImpact:false,
      playerStats:[],
    })).rejects.toMatchObject({code:"IMPACT_CONFIRMATION_REQUIRED"});

    await service.enterResult(ownerId,competition.id,semi.id,{
      homeScore:0,
      awayScore:1,
      correctionReason:"Official correction",
      confirmImpact:true,
      playerStats:[],
    });

    view=await service.getOwner(ownerId,competition.id);
    const correctedFinal=view.matches.find((match)=>match.id===final.id)!;
    expect([correctedFinal.homeTeamId,correctedFinal.awayTeamId]).toContain(semi.awayTeamId);

    await service.enterResult(ownerId,competition.id,final.id,{
      homeScore:3,awayScore:2,confirmImpact:false,playerStats:[],
    });
    const completed=await service.changeState(ownerId,competition.id,{action:"COMPLETE"});
    expect(completed?.status).toBe("COMPLETED");
    expect(completed?.championTeamId).toBeTruthy();
  });

  it("derives group standings, snapshots qualifiers, and creates a knockout final",async()=>{
    const repository=new FakeCompetitionRepository();
    const ownerId="22222222-2222-4222-8222-222222222222";
    const venue=repository.seedVenue(ownerId);
    const service=new CompetitionService(repository,()=>NOW);
    const competition=await service.create(ownerId,input("GROUP_KNOCKOUT"));
    await service.changeState(ownerId,competition.id,{action:"OPEN_REGISTRATION"});
    await acceptTeams(service,repository,ownerId,competition.id,4);
    await service.changeState(ownerId,competition.id,{action:"CLOSE_REGISTRATION"});
    await service.changeState(ownerId,competition.id,{action:"GENERATE_FIXTURES"});

    let view=await service.getOwner(ownerId,competition.id);
    const groupMatches=view.matches.filter((match)=>match.stage==="GROUP");
    expect(groupMatches).toHaveLength(2);

    await schedule(service,ownerId,competition.id,groupMatches[0]!.id,venue.areas[0]!.id,1);
    await service.enterResult(ownerId,competition.id,groupMatches[0]!.id,{
      homeScore:2,awayScore:0,confirmImpact:false,playerStats:[],
    });

    await expect(service.changeState(ownerId,competition.id,{action:"GENERATE_KNOCKOUT"}))
      .rejects.toMatchObject({code:"GROUP_STAGE_INCOMPLETE"});

    await schedule(service,ownerId,competition.id,groupMatches[1]!.id,venue.areas[0]!.id,3);
    await service.enterResult(ownerId,competition.id,groupMatches[1]!.id,{
      homeScore:1,awayScore:0,confirmImpact:false,playerStats:[],
    });

    view=await service.getOwner(ownerId,competition.id);
    expect(view.standings).toHaveLength(4);
    expect(new Set(view.standings.map((row)=>row.groupName)).size).toBe(2);

    await service.changeState(ownerId,competition.id,{action:"GENERATE_KNOCKOUT"});
    view=await service.getOwner(ownerId,competition.id);
    const knockout=view.matches.filter((match)=>match.stage==="KNOCKOUT");
    expect(knockout).toHaveLength(1);
    expect(knockout[0]?.homeTeamId&&knockout[0]?.awayTeamId).toBeTruthy();

    await schedule(service,ownerId,competition.id,knockout[0]!.id,venue.areas[0]!.id,5);
    await service.enterResult(ownerId,competition.id,knockout[0]!.id,{
      homeScore:4,awayScore:3,confirmImpact:false,playerStats:[],
    });

    await expect(service.enterResult(ownerId,competition.id,groupMatches[0]!.id,{
      homeScore:0,
      awayScore:1,
      correctionReason:"Late group correction",
      confirmImpact:false,
      playerStats:[],
    })).rejects.toMatchObject({code:"GROUP_CORRECTION_IMPACT_CONFIRMATION_REQUIRED"});

    const completed=await service.changeState(ownerId,competition.id,{action:"COMPLETE"});
    expect(completed?.status).toBe("COMPLETED");
    expect(completed?.championTeamId).toBeTruthy();
  });

  it("rejects draws in knockout matches",async()=>{
    const repository=new FakeCompetitionRepository();
    const ownerId="33333333-3333-4333-8333-333333333333";
    const venue=repository.seedVenue(ownerId);
    const service=new CompetitionService(repository,()=>NOW);
    const competition=await service.create(ownerId,input("KNOCKOUT"));
    await service.changeState(ownerId,competition.id,{action:"OPEN_REGISTRATION"});
    await acceptTeams(service,repository,ownerId,competition.id,2);
    await service.changeState(ownerId,competition.id,{action:"CLOSE_REGISTRATION"});
    await service.changeState(ownerId,competition.id,{action:"GENERATE_FIXTURES"});
    const match=(await service.getOwner(ownerId,competition.id)).matches[0]!;
    await schedule(service,ownerId,competition.id,match.id,venue.areas[0]!.id,1);

    await expect(service.enterResult(ownerId,competition.id,match.id,{
      homeScore:1,awayScore:1,confirmImpact:false,playerStats:[],
    })).rejects.toMatchObject({code:"KNOCKOUT_DRAW_NOT_ALLOWED"});
  });
});
