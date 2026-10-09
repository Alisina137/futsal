import {randomUUID} from "node:crypto";
import type {CompetitionCreateRequest,CompetitionMatchDto,CompetitionPublicMatchPlayer} from "@leaguekick/contracts";
import {describe,expect,it} from "vitest";
import {CompetitionService} from "../src/modules/competition/competition.service.js";
import {FakeCompetitionRepository} from "./fake-competition-repository.js";

const now=new Date("2026-10-09T06:00:00Z");
const input:CompetitionCreateRequest={
  name:"Kabul League",description:"Public competition details",format:"LEAGUE",maxTeams:4,
  registrationFeeAfn:0,winPoints:3,drawPoints:1,lossPoints:0,
  tieBreakOrder:["POINTS","GOAL_DIFFERENCE","GOALS_FOR","HEAD_TO_HEAD","ADMIN"],
  groupCount:null,qualifiersPerGroup:null,
  registrationClosesAt:new Date(now.getTime()+8*86400000).toISOString(),
  matchDurationMinutes:60,startsAt:null,endsAt:null,
};
const fixture=(competitionId:string,homeId:string,awayId:string,status:CompetitionMatchDto["status"]):CompetitionMatchDto=>({
  id:randomUUID(),competitionId,groupId:null,groupName:null,stage:"LEAGUE",
  roundNumber:1,slotNumber:1,homeTeamId:homeId,homeTeamName:"Blue",
  awayTeamId:awayId,awayTeamName:"Red",areaId:null,areaName:null,
  startsAt:now.toISOString(),endsAt:new Date(now.getTime()+3600000).toISOString(),
  status,homeScore:status==="COMPLETED"?2:null,awayScore:status==="COMPLETED"?1:null,
  winnerTeamId:status==="COMPLETED"?homeId:null,
  nextMatchId:null,nextMatchSide:null,refereeUserId:null,
});
function setup(){
  const repo=new FakeCompetitionRepository();
  const owner=randomUUID();repo.seedVenue(owner);
  const service=new CompetitionService(repo,()=>now);
  return {repo,owner,service};
}
describe("Public competition match detail visibility",()=>{
  it("only exposes published competition matches and their own recorded player statistics",async()=>{
    const {repo,owner,service}=setup();
    const competition=await service.create(owner,input);
    const other=await service.create(owner,{...input,name:"Other League"});
    const team1=repo.seedTeam(randomUUID(),"Blue");
    const team2=repo.seedTeam(randomUUID(),"Red");
    const match=fixture(competition.id,team1.id,team2.id,"COMPLETED");
    repo.matches.set(match.id,match);
    const otherMatch=fixture(other.id,team1.id,team2.id,"COMPLETED");
    repo.matches.set(otherMatch.id,otherMatch);
    const record=repo.competitions.get(competition.id)!;
    repo.competitions.set(competition.id,{...record,published:true,status:"IN_PROGRESS"});
    const player:CompetitionPublicMatchPlayer={
      playerUserId:randomUUID(),teamId:team1.id,teamName:"Blue",
      publicDisplayName:"Striker",appeared:true,goals:2,assists:1,
      yellowCards:0,redCards:0,cleanSheet:false,playerOfMatch:true,
    };
    repo.playerMatchStats.set(match.id,[player]);
    const response=await service.getPublicMatch(competition.id,match.id);
    expect(response.match.id).toBe(match.id);
    expect(response.playerStats).toEqual([player]);
    await expect(service.getPublicMatch(competition.id,otherMatch.id))
      .rejects.toMatchObject({code:"MATCH_NOT_FOUND"});
    await expect(service.getPublicMatch(other.id,otherMatch.id))
      .rejects.toMatchObject({code:"COMPETITION_NOT_FOUND"});
  });
  it("exposes no player events for unfinalized matches",async()=>{
    const {repo,owner,service}=setup();
    const competition=await service.create(owner,input);
    const match=fixture(competition.id,randomUUID(),randomUUID(),"IN_PROGRESS");
    repo.matches.set(match.id,match);
    const record=repo.competitions.get(competition.id)!;
    repo.competitions.set(competition.id,{...record,published:true,status:"IN_PROGRESS"});
    repo.playerMatchStats.set(match.id,[{
      playerUserId:randomUUID(),teamId:match.homeTeamId!,teamName:"Blue",
      publicDisplayName:"Unconfirmed",appeared:true,goals:1,assists:0,
      yellowCards:0,redCards:0,cleanSheet:false,playerOfMatch:false,
    }]);
    const result=await service.getPublicMatch(competition.id,match.id);
    expect(result.playerStats).toEqual([]);
    expect(result.match.status).toBe("IN_PROGRESS");
  });
});
