import {randomUUID} from "node:crypto";
import {competitionDiscoveryQuerySchema,type CompetitionCreateRequest} from "@leaguekick/contracts";
import {describe,expect,it} from "vitest";
import {CompetitionService} from "../src/modules/competition/competition.service.js";
import {FakeCompetitionRepository} from "./fake-competition-repository.js";

const NOW=new Date("2026-10-14T10:00:00.000Z");
const base:CompetitionCreateRequest={
  name:"Competition privacy QA",description:"Regression",format:"LEAGUE",
  maxTeams:4,registrationFeeAfn:200,winPoints:3,drawPoints:1,lossPoints:0,
  tieBreakOrder:["POINTS","GOAL_DIFFERENCE","GOALS_FOR"],
  groupCount:null,qualifiersPerGroup:null,
  registrationClosesAt:new Date(NOW.getTime()+6*86400000).toISOString(),
  matchDurationMinutes:60,startsAt:new Date(NOW.getTime()+9*86400000).toISOString(),endsAt:null,
};
function setup(){
  const repo=new FakeCompetitionRepository(),owner=randomUUID(),otherOwner=randomUUID();
  repo.seedVenue(owner,{subscriptionStatus:"ACTIVE",activeUntil:new Date("2027-01-01T00:00:00Z")});
  repo.seedVenue(otherOwner,{subscriptionStatus:"ACTIVE",activeUntil:new Date("2027-01-01T00:00:00Z")});
  return {repo,owner,otherOwner,service:new CompetitionService(repo,()=>NOW)};
}
function registration(competitionId:string,team:{id:string;name:string;managerUserId:string},
  status:"ACCEPTED"|"APPLIED"){
  return {
    competitionId,teamId:team.id,teamName:team.name,logoUrl:null,
    managerUserId:team.managerUserId,teamPrivacy:"PUBLIC" as const,
    offlineVenueId:null,claimedAt:null,status,seed:null,groupId:null,groupName:null,
    feeStatus:"PAID" as const,feePaymentReference:"PRIVATE-BANK-REF-DO-NOT-EXPOSE",
    feeConfirmedAt:NOW,
  };
}
describe("Competition Phase 7 — cross-role, match and privacy regression",()=>{
  it("denies foreign organizer access to read, settings, branding and media; hides drafts",async()=>{
    const {repo,owner,otherOwner,service}=setup();
    const event=await service.create(owner,base);
    await expect(service.getOwner(otherOwner,event.id)).rejects.toMatchObject({code:"COMPETITION_ACCESS_DENIED"});
    await expect(service.update(otherOwner,event.id,{name:"Hacked"})).rejects.toMatchObject({code:"COMPETITION_ACCESS_DENIED"});
    await expect(service.listOwnerMedia(otherOwner,event.id)).rejects.toMatchObject({code:"COMPETITION_ACCESS_DENIED"});
    await expect(service.replaceRewards(otherOwner,event.id,[])).rejects.toMatchObject({code:"COMPETITION_ACCESS_DENIED"});
    await expect(service.getPublic(event.id)).rejects.toMatchObject({code:"COMPETITION_NOT_FOUND"});
    await expect(service.listPublicMedia(event.id)).rejects.toMatchObject({code:"COMPETITION_NOT_FOUND"});
    expect((await service.listOwner(otherOwner)).competitions.some(c=>c.id===event.id)).toBe(false);
    expect((await service.listPublic()).competitions.some(c=>c.id===event.id)).toBe(false);
    expect(repo.competitions.get(event.id)?.name).toBe(base.name);
  });
  it("never includes pending teams, payment references, or removed-team player stats in public results",async()=>{
    const {repo,owner,service}=setup();
    const event=await service.create(owner,base);
    const a=repo.seedTeam(randomUUID(),"Accepted Five");
    const b=repo.seedTeam(randomUUID(),"Applied Five");
    repo.registrations.set(event.id+":"+a.id,registration(event.id,a,"ACCEPTED"));
    repo.registrations.set(event.id+":"+b.id,registration(event.id,b,"APPLIED"));
    const matchId=randomUUID();
    repo.matches.set(matchId,{
      id:matchId,competitionId:event.id,groupId:null,groupName:null,stage:"LEAGUE",
      roundNumber:1,slotNumber:1,homeTeamId:a.id,homeTeamName:a.name,awayTeamId:b.id,
      awayTeamName:b.name,areaId:null,areaName:null,startsAt:null,endsAt:null,
      status:"COMPLETED",homeScore:2,awayScore:1,winnerTeamId:a.id,
      nextMatchId:null,nextMatchSide:null,refereeUserId:null,
    });
    const player=(teamId:string)=>({playerUserId:randomUUID(),teamId,teamName:teamId===a.id?a.name:b.name,
      publicDisplayName:"Player",appeared:true,goals:1,assists:0,yellowCards:0,redCards:0,
      cleanSheet:false,playerOfMatch:false});
    repo.playerMatchStats.set(matchId,[player(a.id),player(b.id)]);
    await service.changeState(owner,event.id,{action:"OPEN_REGISTRATION"});
    const publicEvent=await service.getPublic(event.id);
    expect(publicEvent.teams).toHaveLength(1);
    expect(publicEvent.teams[0]).toMatchObject({teamId:a.id,feePaymentReference:null});
    expect(JSON.stringify(publicEvent)).not.toContain("PRIVATE-BANK-REF");
    expect((await service.getOwner(owner,event.id)).teams).toHaveLength(2);
    const detail=await service.getPublicMatch(event.id,matchId);
    expect(detail.playerStats).toHaveLength(1);
    expect(detail.playerStats[0]?.teamId).toBe(a.id);
    await expect(service.getPublicMatch(event.id,randomUUID())).rejects.toMatchObject({code:"MATCH_NOT_FOUND"});
  });
  it("shows My Competitions for managers without memberships and for ACTIVE members, never outsiders",async()=>{
    const {repo,owner,service}=setup();
    const event=await service.create(owner,base);
    const manager=randomUUID(),member=randomUUID(),outsider=randomUUID();
    const team=repo.seedTeam(manager);
    repo.registrations.set(event.id+":"+team.id,registration(event.id,team,"APPLIED"));
    await service.changeState(owner,event.id,{action:"OPEN_REGISTRATION"});
    expect((await service.listMyPublic(manager)).competitions.map(x=>x.id)).toEqual([event.id]);
    expect((await service.listMyPublic(outsider)).competitions).toEqual([]);
    repo.activeMemberships.set(member,new Set([team.id]));
    expect((await service.listMyPublic(member)).competitions.map(x=>x.id)).toEqual([event.id]);
    repo.activeMemberships.delete(member);
    expect((await service.listMyPublic(member)).competitions).toEqual([]);
  });
  it("keeps filtered discovery pages consistent, private scopes authenticated, and draft counts hidden",async()=>{
    const {repo,owner,service}=setup();
    const ids:string[]=[];
    for(let index=0;index<19;index++){
      const event=await service.create(owner,{...base,name:`QA Cup ${String(index).padStart(2,"0")}`});
      if(index<15){
        const row=repo.competitions.get(event.id)!;
        repo.competitions.set(event.id,{...row,status:"REGISTRATION_OPEN",published:true});
        ids.push(event.id);
      }
    }
    const query=competitionDiscoveryQuerySchema.parse({q:"QA Cup",sort:"starting",limit:6});
    const pages=await Promise.all([1,2,3].map(page=>service.discoverPublic({...query,page})));
    expect(pages.map(x=>x.competitions.length)).toEqual([6,6,3]);
    expect(pages.every(x=>x.total===15)).toBe(true);
    expect(pages.map(x=>x.hasMore)).toEqual([true,true,false]);
    expect(new Set(pages.flatMap(p=>p.competitions.map(c=>c.id)))).toEqual(new Set(ids));
    for(const scope of ["mine","following","ongoingFollowedVenues"] as const)
      await expect(service.discoverPublic({...query,scope})).rejects.toMatchObject({statusCode:401});
  });
});
