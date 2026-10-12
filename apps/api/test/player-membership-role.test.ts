import {describe,expect,it} from "vitest";
import {rolesWithActiveTeamPlayer} from "../src/modules/auth/player-role-from-teams.js";

describe("Player role derives from active team membership",()=>{
  it("keeps a normal requester Normal until manager accepts their join request",()=>{
    expect(rolesWithActiveTeamPlayer([],false)).toEqual([]);
    expect(rolesWithActiveTeamPlayer([],true)).toEqual(["PLAYER"]);
  });
  it("removes a derived Player role after the last active player membership ends",()=>{
    expect(rolesWithActiveTeamPlayer([],false)).toEqual([]);
  });
  it("preserves explicitly assigned Player roles without requiring a team",()=>{
    expect(rolesWithActiveTeamPlayer(["PLAYER"],false)).toEqual(["PLAYER"]);
    expect(rolesWithActiveTeamPlayer(["PLAYER"],true)).toEqual(["PLAYER"]);
  });
  it("keeps manager and venue-owner access without automatically granting Player",()=>{
    expect(rolesWithActiveTeamPlayer(["TEAM_MANAGER"],false)).toEqual(["TEAM_MANAGER"]);
    expect(rolesWithActiveTeamPlayer(["VENUE_OWNER"],false)).toEqual(["VENUE_OWNER"]);
    expect(rolesWithActiveTeamPlayer(["VENUE_OWNER"],true)).toEqual(["VENUE_OWNER","PLAYER"]);
  });
  it("never combines automatically earned Player with referee or admin",()=>{
    expect(rolesWithActiveTeamPlayer(["REFEREE"],true)).toEqual(["REFEREE"]);
    expect(rolesWithActiveTeamPlayer(["PLATFORM_ADMIN"],true)).toEqual(["PLATFORM_ADMIN"]);
  });
  it("deduplicates existing grants",()=>{
    expect(rolesWithActiveTeamPlayer(["PLAYER","PLAYER"],true)).toEqual(["PLAYER"]);
  });
});
