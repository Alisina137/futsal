import {randomUUID} from "node:crypto";
import {describe,expect,it} from "vitest";
import {TeamService} from "../src/modules/team/team.service.js";
import {FakeTeamRepository} from "./fake-team-repository.js";

const now=new Date("2026-10-13T12:00:00Z");
function createFixture(){
  const repo=new FakeTeamRepository();
  const manager=randomUUID(),player=randomUUID(),referee=randomUUID();
  repo.seedUser({id:manager,displayName:"Team manager",username:"boss",email:"boss@example.com",
    phoneE164:"+93700123451",roles:["TEAM_MANAGER"]});
  repo.seedUser({id:player,displayName:"Future player",username:"striker",email:"PLAYER@EXAMPLE.COM",
    phoneE164:"+93700123452",roles:["PLAYER"]});
  repo.seedUser({id:referee,displayName:"Referee",username:"official",email:"ref@example.com",
    phoneE164:"+93700123453",roles:["REFEREE"]});
  const service=new TeamService(repo,()=>now);
  return {repo,service,manager,player,referee};
}
async function ownedTeam(fixture:ReturnType<typeof createFixture>){
  return fixture.service.createTeam(fixture.manager,{name:"Kabul Five",city:"Kabul",
    privacy:"PUBLIC"});
}
describe("Teams Phase 6 — end-to-end service authorization and privacy",()=>{
  it("resolves invitations through normalized email without losing username lookups",async()=>{
    const f=createFixture();
    expect((await f.service.resolveInviteTarget("  Player@Example.COM  "))?.id).toBe(f.player);
    expect((await f.service.resolveInviteTarget("striker"))?.id).toBe(f.player);
    expect(await f.service.resolveInviteTarget("invalid@")).toBeNull();
    expect(await f.service.resolveInviteTarget("not-here@example.com")).toBeNull();
    const team=await ownedTeam(f);
    const invitation=await f.service.createInvitation(f.manager,team.id,{
      identifier:"PLAYER@EXAMPLE.com",role:"PLAYER",shirtNumber:10,
    });
    expect(invitation.invitedUserId).toBe(f.player);
    const accepted=await f.service.acceptInvitation(f.player,invitation.id);
    expect(accepted.status).toBe("ACCEPTED");
    expect((await f.service.getRoster(f.player,team.id)).members.some(m=>m.userId===f.player)).toBe(true);
  });

  it("keeps private player identity out of the anonymous public team roster",async()=>{
    const f=createFixture(),team=await ownedTeam(f);
    await f.service.getOwnProfile(f.player);
    f.repo.memberships.set(team.id+":"+f.player,{
      teamId:team.id,userId:f.player,role:"PLAYER",shirtNumber:9,
      status:"ACTIVE",joinedAt:now,leftAt:null,
    });
    await f.service.updateOwnProfile(f.player,{visibility:"PRIVATE"});
    const publicTeam=await f.service.getPublicTeam(team.id);
    expect(publicTeam.rosterCount).toBe(2);
    expect(publicTeam.members.map(m=>m.userId)).not.toContain(f.player);
    const privateRoster=await f.service.getRoster(f.player,team.id);
    expect(privateRoster.members.map(m=>m.userId)).toContain(f.player);
  });

  it("does not allow a pending invite to convert a referee into a player",async()=>{
    const f=createFixture(),team=await ownedTeam(f);
    const invite=await f.service.createInvitation(f.manager,team.id,{
      identifier:"ref@example.com",role:"PLAYER",shirtNumber:null,
    });
    await expect(f.service.acceptInvitation(f.referee,invite.id)).rejects.toMatchObject({
      code:"REFEREE_ROLE_EXCLUSIVE",
    });
    expect(f.repo.memberships.has(team.id+":"+f.referee)).toBe(false);
  });

  it("rejects an invitation to a team archived before acceptance",async()=>{
    const f=createFixture(),team=await ownedTeam(f);
    const invite=await f.service.createInvitation(f.manager,team.id,{
      identifier:"player@example.com",role:"PLAYER",shirtNumber:null,
    });
    f.repo.teams.set(team.id,{...f.repo.teams.get(team.id)!,status:"ARCHIVED"});
    await expect(f.service.acceptInvitation(f.player,invite.id)).rejects.toMatchObject({
      code:"INVITATION_UNAVAILABLE",
    });
  });

  it("does not let a stale invitation overwrite an existing captain/member role",async()=>{
    const f=createFixture(),team=await ownedTeam(f);
    const invite=await f.service.createInvitation(f.manager,team.id,{
      identifier:"striker",role:"PLAYER",shirtNumber:12,
    });
    f.repo.memberships.set(team.id+":"+f.player,{
      teamId:team.id,userId:f.player,role:"CAPTAIN",shirtNumber:7,status:"ACTIVE",
      joinedAt:now,leftAt:null,
    });
    await expect(f.service.acceptInvitation(f.player,invite.id)).rejects.toMatchObject({
      code:"INVITATION_UNAVAILABLE",
    });
    expect(f.repo.memberships.get(team.id+":"+f.player)).toMatchObject({
      role:"CAPTAIN",shirtNumber:7,status:"ACTIVE",
    });
  });
});
