import {describe,expect,it} from "vitest";
import {assertCanLeaveTeam,preferencesSchema,selectedTeamId} from "../src/modules/team/player-dashboard-phase1.routes.js";
describe("Player Dashboard Phase 1",()=>{
  it("uses a saved team only while membership is active and falls back safely",()=>{
    expect(selectedTeamId(["a","b"],"b")).toBe("b");
    expect(selectedTeamId(["a","b"],"left-team")).toBe("a");
    expect(selectedTeamId([],null)).toBeNull();
    expect(selectedTeamId([],"stale")).toBeNull();
  });
  it("allows regular members to leave but blocks managers and inactive memberships",()=>{
    expect(()=>assertCanLeaveTeam(false,true)).not.toThrow();
    expect(()=>assertCanLeaveTeam(true,true)).toThrowError(/Transfer team management/);
    expect(()=>assertCanLeaveTeam(false,false)).toThrowError(/not an active member/);
  });
  it("validates optional profile preferences and default team with strict input",()=>{
    expect(preferencesSchema.parse({biography:"Futsal player",preferredFoot:"LEFT",defaultTeamId:null}))
      .toMatchObject({preferredFoot:"LEFT",biography:"Futsal player"});
    expect(preferencesSchema.safeParse({preferredFoot:"UNKNOWN"}).success).toBe(false);
    expect(preferencesSchema.safeParse({biography:"x".repeat(501)}).success).toBe(false);
    expect(preferencesSchema.safeParse({defaultTeamId:"another-tenant"}).success).toBe(false);
    expect(preferencesSchema.safeParse({role:"PLATFORM_ADMIN"}).success).toBe(false);
  });
});
