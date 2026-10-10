import { describe,it,expect } from "vitest";
import { assertEligibleSelection,assertRosterEditable } from "../src/modules/team/team-manager-phase2.routes.js";

const open={status:"REGISTRATION_CLOSED",registrationStatus:"ACCEPTED",
  registrationClosesAt:new Date("2026-10-20T00:00:00Z"),startsAt:new Date("2026-10-22T00:00:00Z")};

describe("Phase 2 Team Manager roster and lineup boundaries",()=>{
  it("permits accepted team roster changes before the organizer deadline",()=>{
    expect(()=>assertRosterEditable(open,new Date("2026-10-18T00:00:00Z"))).not.toThrow();
  });
  it("locks roster at organizer deadline, not just at competition start",()=>{
    expect(()=>assertRosterEditable(open,new Date("2026-10-20T00:00:00Z"))).toThrowError();
  });
  it("rejects unaccepted and already started competitions",()=>{
    expect(()=>assertRosterEditable({...open,registrationStatus:"INVITED"},new Date("2026-10-18T00:00:00Z"))).toThrow();
    expect(()=>assertRosterEditable({...open,status:"IN_PROGRESS"},new Date("2026-10-18T00:00:00Z"))).toThrow();
  });
  it("accepts only active members selected for the exact competition",()=>{
    expect(()=>assertEligibleSelection(["a"],["a","b"],["a"])).not.toThrow();
    expect(()=>assertEligibleSelection(["b"],["a","b"],["a"])).toThrow();
    expect(()=>assertEligibleSelection(["c"],["a","b"],["a","c"])).toThrow();
  });
});
