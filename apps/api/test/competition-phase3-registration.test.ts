import {randomUUID} from "node:crypto";
import type {CompetitionCreateRequest} from "@leaguekick/contracts";
import {describe,expect,it} from "vitest";
import {CompetitionService} from "../src/modules/competition/competition.service.js";
import {FakeCompetitionRepository} from "./fake-competition-repository.js";

const NOW=new Date("2026-10-14T07:00:00.000Z");
const input:CompetitionCreateRequest={
  name:"Kabul Cup",description:"Registration integration",format:"LEAGUE",maxTeams:2,
  registrationFeeAfn:500,winPoints:3,drawPoints:1,lossPoints:0,
  tieBreakOrder:["POINTS","GOAL_DIFFERENCE","GOALS_FOR"],
  groupCount:null,qualifiersPerGroup:null,
  registrationClosesAt:new Date(NOW.getTime()+6*86400000).toISOString(),
  matchDurationMinutes:60,
  startsAt:new Date(NOW.getTime()+9*86400000).toISOString(),endsAt:null,
};
async function setup(maxTeams=2){
  const repository=new FakeCompetitionRepository(),owner=randomUUID();
  repository.seedVenue(owner,{subscriptionStatus:"ACTIVE",activeUntil:new Date("2027-01-01T00:00:00Z")});
  const service=new CompetitionService(repository,()=>NOW);
  const competition=await service.create(owner,{...input,maxTeams});
  const row=repository.competitions.get(competition.id)!;
  repository.competitions.set(competition.id,{...row,status:"REGISTRATION_OPEN",published:true});
  const managers=[randomUUID(),randomUUID(),randomUUID()];
  const teams=managers.map((id,index)=>repository.seedTeam(id,`Player Team ${index+1}`));
  return {repository,service,owner,competition,managers,teams};
}
describe("Competition Phase 3 — participation, registration, invitation and capacity",()=>{
  it("scopes current and historical status to the manager or active team member only",async()=>{
    const {repository,service,competition,managers,teams}=await setup();
    await service.apply(managers[0]!,competition.id,{teamId:teams[0]!.id});
    await repository.inviteTeam({
      competitionId:competition.id,teamId:teams[1]!.id,ownerUserId:"unused",
      seed:null,now:NOW,
    });
    const outsider=managers[2]!;
    expect((await service.myParticipations(outsider)).participations).toEqual([]);
    const mine=(await service.myParticipations(managers[0]!)).participations;
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      teamId:teams[0]!.id,status:"APPLIED",feeStatus:"UNPAID",isManager:true,canWithdraw:true,
    });
    expect(mine[0]).not.toHaveProperty("feePaymentReference");
    const invited=(await service.myParticipations(managers[1]!,competition.id)).participations;
    expect(invited).toMatchObject([{teamId:teams[1]!.id,status:"INVITED",
      canRespond:true,isManager:true}]);
    repository.activeMemberships.set(outsider,new Set([teams[0]!.id]));
    expect((await service.myParticipations(outsider)).participations).toMatchObject([
      {teamId:teams[0]!.id,status:"APPLIED",isManager:false,canRespond:false,canWithdraw:false},
    ]);
    await expect(service.withdraw(outsider,competition.id,teams[0]!.id))
      .rejects.toMatchObject({code:"TEAM_MANAGER_REQUIRED"});
    const row=repository.competitions.get(competition.id)!;
    repository.competitions.set(competition.id,{...row,published:false});
    expect((await service.myParticipations(managers[0]!)).participations).toEqual([]);
  });
  it("accepts manager consent, enforces capacity, supports decline, withdraw and server-side rechecks",async()=>{
    const {repository,service,owner,competition,managers,teams}=await setup(1);
    await repository.inviteTeam({
      competitionId:competition.id,teamId:teams[0]!.id,ownerUserId:owner,
      seed:1,now:NOW,
    });
    await expect(service.respondInvitation(managers[1]!,competition.id,teams[0]!.id,
      {status:"ACCEPTED"})).rejects.toMatchObject({code:"TEAM_MANAGER_REQUIRED"});
    await service.respondInvitation(managers[0]!,competition.id,teams[0]!.id,
      {status:"ACCEPTED"});
    expect((await service.myParticipations(managers[0]!)).participations[0]?.status)
      .toBe("ACCEPTED");
    await expect(service.apply(managers[1]!,competition.id,{teamId:teams[1]!.id}))
      .rejects.toMatchObject({code:"COMPETITION_FULL"});
    await repository.inviteTeam({competitionId:competition.id,teamId:teams[1]!.id,
      ownerUserId:owner,seed:null,now:NOW});
    await expect(service.respondInvitation(managers[1]!,competition.id,teams[1]!.id,
      {status:"ACCEPTED"})).rejects.toMatchObject({code:"COMPETITION_FULL"});
    await service.respondInvitation(managers[1]!,competition.id,teams[1]!.id,
      {status:"REJECTED"});
    expect((await service.myParticipations(managers[1]!)).participations[0]?.status)
      .toBe("REJECTED");
    await service.withdraw(managers[0]!,competition.id,teams[0]!.id);
    expect((await service.myParticipations(managers[0]!)).participations[0]?.status)
      .toBe("WITHDRAWN");
    await service.apply(managers[1]!,competition.id,{teamId:teams[1]!.id});
    await service.decideRegistration(owner,competition.id,teams[1]!.id,{status:"ACCEPTED",seed:1});
    expect((await service.myParticipations(managers[1]!)).participations[0]?.status)
      .toBe("ACCEPTED");
    expect(await repository.countAcceptedTeams(competition.id)).toBe(1);
    await expect(service.decideRegistration(owner,competition.id,teams[0]!.id,{
      status:"ACCEPTED",seed:2,
    })).rejects.toMatchObject({code:"REGISTRATION_NOT_PENDING"});
  });
  it("shows invitations after closure but stops actions once fixtures begin",async()=>{
    const {repository,service,owner,competition,managers,teams}=await setup();
    await repository.inviteTeam({competitionId:competition.id,teamId:teams[0]!.id,
      ownerUserId:owner,seed:1,now:NOW});
    let row=repository.competitions.get(competition.id)!;
    repository.competitions.set(competition.id,{...row,status:"REGISTRATION_CLOSED"});
    expect((await service.myParticipations(managers[0]!)).participations[0]?.canRespond).toBe(true);
    row=repository.competitions.get(competition.id)!;
    repository.competitions.set(competition.id,{...row,status:"SCHEDULED"});
    expect((await service.myParticipations(managers[0]!)).participations[0]?.canRespond).toBe(false);
    await expect(service.respondInvitation(managers[0]!,competition.id,teams[0]!.id,{
      status:"ACCEPTED",
    })).rejects.toMatchObject({code:"COMPETITION_ALREADY_SCHEDULED"});
  });
});
