import type { CompetitionCreateRequest } from "@leaguekick/contracts";
import { describe, expect, it } from "vitest";
import { CompetitionService } from "../src/modules/competition/competition.service.js";
import { FakeCompetitionRepository } from "./fake-competition-repository.js";

const NOW = new Date("2026-10-04T00:00:00.000Z");

function setup(options?:{subscriptionStatus?:"TRIAL"|"ACTIVE"|"EXPIRED"|"CANCELLED";trialEndsAt?:Date}) {
  const repository=new FakeCompetitionRepository();
  const ownerId="11111111-1111-4111-8111-111111111111";
  const venue=repository.seedVenue(ownerId,{
    ...(options?.subscriptionStatus !== undefined ? { subscriptionStatus: options.subscriptionStatus } : {}),
    ...(options?.trialEndsAt !== undefined ? { trialEndsAt: options.trialEndsAt } : {}),
  });
  const service=new CompetitionService(repository,()=>NOW);
  return {repository,service,ownerId,venue};
}

function input(overrides:Partial<CompetitionCreateRequest>={}):CompetitionCreateRequest{
  const base:CompetitionCreateRequest={
    name:"Kabul League",
    description:"City futsal league",
    format:"LEAGUE" as const,
    maxTeams:4,
    registrationFeeAfn:0,
    winPoints:3,
    drawPoints:1,
    lossPoints:0,
    tieBreakOrder:["POINTS","GOAL_DIFFERENCE","GOALS_FOR"],
    groupCount:null,
    qualifiersPerGroup:null,
    registrationClosesAt:new Date(NOW.getTime()+4*24*60*60*1000).toISOString(),
    matchDurationMinutes:60,
    startsAt:null,
    endsAt:null,
  };
  return {...base,...overrides};
}

describe("Phase 6 competition setup and registration",()=>{
  it("blocks competition creation when Premium entitlement is expired",async()=>{
    const {service,ownerId}=setup({
      subscriptionStatus:"TRIAL",
      trialEndsAt:new Date("2026-10-03T23:59:59.000Z"),
    });
    await expect(service.create(ownerId,input())).rejects.toMatchObject({
      code:"SUBSCRIPTION_REQUIRED",
      statusCode:403,
    });
  });

  it("keeps drafts private and publishes when registration opens",async()=>{
    const {service,ownerId}=setup();
    const created=await service.create(ownerId,input());

    await expect(service.getPublic(created.id)).rejects.toMatchObject({code:"COMPETITION_NOT_FOUND"});

    const opened=await service.changeState(ownerId,created.id,{action:"OPEN_REGISTRATION"});
    expect(opened?.status).toBe("REGISTRATION_OPEN");
    expect(opened?.published).toBe(true);

    const publicCompetition=await service.getPublic(created.id);
    expect(publicCompetition.id).toBe(created.id);
  });

  it("requires a registration deadline and at least a 72-hour registration window",async()=>{
    const {service,ownerId}=setup();

    const missingDeadline=await service.create(ownerId,input({registrationClosesAt:null}));
    await expect(
      service.changeState(ownerId,missingDeadline.id,{action:"OPEN_REGISTRATION"}),
    ).rejects.toMatchObject({code:"REGISTRATION_DEADLINE_REQUIRED",statusCode:400});

    const shortWindow=await service.create(ownerId,input({
      registrationClosesAt:new Date(NOW.getTime()+72*60*60*1000-1).toISOString(),
    }));
    await expect(
      service.changeState(ownerId,shortWindow.id,{action:"OPEN_REGISTRATION"}),
    ).rejects.toMatchObject({code:"REGISTRATION_WINDOW_TOO_SHORT",statusCode:400});

    const exactWindow=await service.create(ownerId,input({
      registrationClosesAt:new Date(NOW.getTime()+72*60*60*1000).toISOString(),
    }));
    const opened=await service.changeState(ownerId,exactWindow.id,{action:"OPEN_REGISTRATION"});
    expect(opened?.status).toBe("REGISTRATION_OPEN");
  });

  it("enforces deadline, start, and end ordering across competition updates",async()=>{
    const {service,ownerId}=setup();
    const deadline=new Date(NOW.getTime()+4*24*60*60*1000);
    const start=new Date(deadline.getTime()+60*60*1000);
    const end=new Date(start.getTime()+2*60*60*1000);
    const created=await service.create(ownerId,input({
      registrationClosesAt:deadline.toISOString(),
      startsAt:start.toISOString(),
      endsAt:end.toISOString(),
    }));

    await expect(service.update(ownerId,created.id,{
      startsAt:new Date(deadline.getTime()-1).toISOString(),
    })).rejects.toMatchObject({code:"COMPETITION_START_BEFORE_REGISTRATION_CLOSE"});

    await expect(service.update(ownerId,created.id,{
      endsAt:new Date(start.getTime()-1).toISOString(),
    })).rejects.toMatchObject({code:"COMPETITION_END_BEFORE_START"});

    await service.changeState(ownerId,created.id,{action:"OPEN_REGISTRATION"});
    await expect(service.update(ownerId,created.id,{
      registrationClosesAt:new Date(NOW.getTime()+71*60*60*1000).toISOString(),
    })).rejects.toMatchObject({code:"REGISTRATION_WINDOW_TOO_SHORT"});
  });

  it("allows only the current team manager to apply",async()=>{
    const {service,repository,ownerId}=setup();
    const managerId="22222222-2222-4222-8222-222222222222";
    const outsiderId="33333333-3333-4333-8333-333333333333";
    const team=repository.seedTeam(managerId,"Blue Five");
    const created=await service.create(ownerId,input());
    await service.changeState(ownerId,created.id,{action:"OPEN_REGISTRATION"});

    await expect(service.apply(outsiderId,created.id,{teamId:team.id})).rejects.toMatchObject({
      code:"TEAM_MANAGER_REQUIRED",
      statusCode:403,
    });

    const registration=await service.apply(managerId,created.id,{teamId:team.id});
    expect(registration?.status).toBe("APPLIED");
  });

  it("enforces accepted-team capacity for applications and invitations",async()=>{
    const {service,repository,ownerId}=setup();
    const managerA="44444444-4444-4444-8444-444444444444";
    const managerB="55555555-5555-4555-8555-555555555555";
    const teamA=repository.seedTeam(managerA,"A");
    const teamB=repository.seedTeam(managerB,"B");
    const created=await service.create(ownerId,input({maxTeams:1}));
    await service.changeState(ownerId,created.id,{action:"OPEN_REGISTRATION"});

    await service.apply(managerA,created.id,{teamId:teamA.id});
    const accepted=await service.decideRegistration(ownerId,created.id,teamA.id,{status:"ACCEPTED",seed:1});
    expect(accepted?.status).toBe("ACCEPTED");

    await service.apply(managerB,created.id,{teamId:teamB.id});
    await expect(
      service.decideRegistration(ownerId,created.id,teamB.id,{status:"ACCEPTED",seed:2}),
    ).rejects.toMatchObject({code:"COMPETITION_FULL",statusCode:409});
  });

  it("supports owner invite and manager response without bypassing manager scope",async()=>{
    const {service,repository,ownerId}=setup();
    const managerId="66666666-6666-4666-8666-666666666666";
    const outsiderId="77777777-7777-4777-8777-777777777777";
    const team=repository.seedTeam(managerId,"Invited Five");
    const created=await service.create(ownerId,input());
    await service.changeState(ownerId,created.id,{action:"OPEN_REGISTRATION"});

    const otherVenueOwner="88888888-8888-4888-8888-888888888888";
    repository.seedVenue(otherVenueOwner);
    await expect(service.inviteTeam(otherVenueOwner,created.id,{teamId:team.id,seed:1}))
      .rejects.toMatchObject({code:"COMPETITION_ACCESS_DENIED",statusCode:403});

    const invitation=await service.inviteTeam(ownerId,created.id,{teamId:team.id,seed:1});
    expect(invitation?.status).toBe("INVITED");

    await expect(
      service.respondInvitation(outsiderId,created.id,team.id,{status:"ACCEPTED"}),
    ).rejects.toMatchObject({code:"TEAM_MANAGER_REQUIRED"});

    const accepted=await service.respondInvitation(managerId,created.id,team.id,{status:"ACCEPTED"});
    expect(accepted?.status).toBe("ACCEPTED");
  });

  it("validates group-to-knockout configuration before creation",async()=>{
    const {service,ownerId}=setup();
    await expect(service.create(ownerId,input({
      format:"GROUP_KNOCKOUT",
      maxTeams:8,
      groupCount:2,
      qualifiersPerGroup:0 as never,
    }))).rejects.toMatchObject({code:"INVALID_GROUP_QUALIFICATION"});
  });
});
