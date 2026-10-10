import { randomUUID } from "node:crypto";
import { describe,expect,it } from "vitest";
import { TeamService } from "../src/modules/team/team.service.js";
import { FakeTeamRepository } from "./fake-team-repository.js";

describe("Team Manager Phase 1 join request preference",()=>{
  it("blocks unsolicited requests when invitations-only is enabled, without blocking them when reopened",async()=>{
    const repo=new FakeTeamRepository();
    const managerId=randomUUID(),playerId=randomUUID();
    repo.seedUser({id:managerId,displayName:"Manager",username:"manager",phoneE164:"+93700000001",roles:["TEAM_MANAGER"]});
    repo.seedUser({id:playerId,displayName:"Player",username:"player",phoneE164:"+93700000002",roles:["PLAYER"]});
    const service=new TeamService(repo,()=>new Date("2026-10-10T00:00:00.000Z"));
    const team=await service.createTeam(managerId,{name:"Kabul Stars",city:"Kabul",privacy:"PUBLIC"});
    repo.joinRequestsAllowed.set(team.id,false);
    await expect(service.requestToJoin(playerId,team.id)).rejects.toMatchObject({code:"TEAM_REQUESTS_DISABLED"});
    repo.joinRequestsAllowed.set(team.id,true);
    await expect(service.requestToJoin(playerId,team.id)).resolves.toMatchObject({status:"PENDING"});
  });
});
