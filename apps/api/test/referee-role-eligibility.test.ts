import {describe,expect,it} from "vitest";
import {canGrantRefereeToNormalUser,type RefereeCandidateState}
  from "../src/modules/owner/referee-eligibility.js";

const normal:RefereeCandidateState={
  status:"ACTIVE",assignedRoles:[],hasPlayerProfile:false,
  hasActiveTeamMembership:false,managesTeam:false,ownsVenue:false,
  hasPaidRoleSubscription:false,hasOtherRefereeGrant:false,
};

describe("Normal User only venue referee grants",()=>{
  it("accepts only an active base user with no other authority",()=>{
    expect(canGrantRefereeToNormalUser(normal)).toBe(true);
  });
  it.each(["PLAYER","TEAM_MANAGER","VENUE_OWNER","REFEREE","VENUE_STAFF",
    "COMPETITION_ADMIN","PLATFORM_ADMIN"] as const)(
    "rejects any existing explicit %s role",role=>{
      expect(canGrantRefereeToNormalUser({...normal,assignedRoles:[role]})).toBe(false);
    });
  it.each(["hasPlayerProfile","hasActiveTeamMembership","managesTeam",
    "ownsVenue","hasPaidRoleSubscription","hasOtherRefereeGrant"] as const)(
    "rejects hidden or derived authority: %s",flag=>{
      expect(canGrantRefereeToNormalUser({...normal,[flag]:true})).toBe(false);
    });
  it("rejects suspended, deleted and missing users",()=>{
    expect(canGrantRefereeToNormalUser({...normal,status:"SUSPENDED"})).toBe(false);
    expect(canGrantRefereeToNormalUser({...normal,status:"DELETED"})).toBe(false);
    expect(canGrantRefereeToNormalUser({...normal,status:null})).toBe(false);
  });
});
