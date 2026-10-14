import {randomUUID} from "node:crypto";
import {describe,expect,it} from "vitest";
import {TeamService} from "../src/modules/team/team.service.js";
import {FakeTeamRepository} from "./fake-team-repository.js";

function setup(){
  const repo=new FakeTeamRepository();
  const manager=randomUUID(),basic=randomUUID(),unverified=randomUUID(),
    player=randomUUID(),referee=randomUUID(),owner=randomUUID();
  for(const [id,roles,verified] of [
    [manager,["TEAM_MANAGER"],true],
    [basic,[],true],
    [unverified,[],false],
    [player,["PLAYER"],true],
    [referee,["REFEREE"],true],
    [owner,["VENUE_OWNER"],true],
  ] as Array<[string,Array<"TEAM_MANAGER"|"PLAYER"|"REFEREE"|"VENUE_OWNER">,boolean]>){
    repo.seedUser({id,displayName:id,username:id.slice(0,8),phoneE164:"+93700000000",
      roles,emailVerified:verified});
  }
  const teams=new TeamService(repo,()=>new Date("2026-10-14T08:00:00.000Z"));
  return {repo,teams,manager,basic,unverified,player,referee,owner};
}
describe("Profile participation eligibility",()=>{
  it("lets only email-verified role-free users send join requests",async()=>{
    const f=setup();
    const team=await f.teams.createTeam(f.manager,{name:"Verified Joiners",city:"Kabul",
      privacy:"PUBLIC"} as never);
    await expect(f.teams.requestToJoin(f.unverified,team.id))
      .rejects.toMatchObject({code:"EMAIL_VERIFICATION_REQUIRED"});
    for(const actor of [f.player,f.referee,f.owner,f.manager]){
      await expect(f.teams.requestToJoin(actor,team.id))
        .rejects.toMatchObject({code:"TEAM_JOIN_BASIC_ACCOUNT_REQUIRED"});
    }
    expect(f.repo.joinRequests.size).toBe(0);
    const result=await f.teams.requestToJoin(f.basic,team.id);
    expect(result).toMatchObject({teamId:team.id,requesterUserId:f.basic,status:"PENDING"});
    expect(f.repo.joinRequests.size).toBe(1);
    expect(await f.teams.requestToJoin(f.basic,team.id)).toMatchObject({id:result.id});
    expect(f.repo.joinRequests.size).toBe(1);
  });
  it("rechecks email verification at request time, not just at profile render",async()=>{
    const f=setup();
    const team=await f.teams.createTeam(f.manager,{name:"No stale access",city:"Kabul",
      privacy:"PUBLIC"} as never);
    const seeded=f.repo.users.get(f.basic)!;
    seeded.emailVerified=false;
    await expect(f.teams.requestToJoin(f.basic,team.id))
      .rejects.toMatchObject({code:"EMAIL_VERIFICATION_REQUIRED"});
    seeded.emailVerified=true;
    await expect(f.teams.requestToJoin(f.basic,team.id))
      .resolves.toMatchObject({status:"PENDING"});
    seeded.roles=["PLAYER"];
    await expect(f.teams.requestToJoin(f.basic,team.id))
      .rejects.toMatchObject({code:"TEAM_JOIN_BASIC_ACCOUNT_REQUIRED"});
  });
});
