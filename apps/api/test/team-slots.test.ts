import {describe,it,expect} from "vitest";
import {EXTRA_TEAM_PRICE_AFN,isPaid} from "../src/modules/team/team-slots.js";
describe("per-team billing entitlement",()=>{
  const now=new Date("2026-10-10T08:00:00.000Z");
  it("only considers an active paid subscription with a future deadline valid",()=>{
    expect(isPaid({status:"ACTIVE",activeUntil:new Date("2026-10-11T08:00:00Z")},now)).toBe(true);
    expect(isPaid({status:"ACTIVE",activeUntil:now},now)).toBe(false);
    expect(isPaid({status:"PENDING",activeUntil:new Date("2027-10-11T08:00:00Z")},now)).toBe(false);
    expect(isPaid({status:"EXPIRED",activeUntil:new Date("2027-10-11T08:00:00Z")},now)).toBe(false);
    expect(isPaid({status:"CANCELLED",activeUntil:null},now)).toBe(false);
    expect(isPaid(undefined,now)).toBe(false);
  });
  it("additional team subscription is a separate paid monthly entitlement",()=>{
    expect(EXTRA_TEAM_PRICE_AFN).toBe(300);
  });
});
