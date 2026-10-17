import {describe,it,expect} from "vitest";
import {refereeMutationAuthorized,refereeEventSchema,refereeChecksSchema}
  from "../src/modules/referee/referee-phase2.routes.js";
import {refereeProfileSchema,availabilityAllows} from "../src/modules/referee/referee.routes.js";
const begins=new Date("2026-10-17T05:00:00.000Z");
const ends=new Date("2026-10-17T06:00:00.000Z");
const weekly=[{day:6,start:"09:00",end:"13:00"}];
describe("Referee Phase 8 security policy",()=>{
  it("requires an active actor, accepted invitation, and a current venue grant together",()=>{
    expect(refereeMutationAuthorized("ACTIVE","ACCEPTED",true)).toBe(true);
    for(const [actor,status,granted] of [
      ["SUSPENDED","ACCEPTED",true],["DELETED","ACCEPTED",true],
      ["ACTIVE","DECLINED",true],["ACTIVE","PENDING",true],
      ["ACTIVE","WITHDRAW_REQUESTED",true],["ACTIVE","ACCEPTED",false],
      [null,"ACCEPTED",true],["ACTIVE",null,true],
    ] as const)expect(refereeMutationAuthorized(actor,status,granted)).toBe(false);
  });
  it("pausing blocks acceptance even when date override is available",()=>{
    const exceptions=[{date:"2026-10-17",available:true}];
    expect(availabilityAllows(begins,ends,weekly,exceptions,true)).toBe(true);
    expect(availabilityAllows(begins,ends,weekly,exceptions,false)).toBe(false);
    expect(availabilityAllows(begins,ends,[],[])).toBe(false);
  });
  it("validates impossible and duplicate availability exceptions before writing",()=>{
    const base={level:null,experienceYears:2,biography:null,acceptingAssignments:true,
      weeklyAvailability:weekly,exceptions:[]};
    expect(refereeProfileSchema.safeParse(base).success).toBe(true);
    expect(refereeProfileSchema.safeParse({...base,exceptions:[
      {date:"2026-02-30",available:true}]}).success).toBe(false);
    expect(refereeProfileSchema.safeParse({...base,exceptions:[
      {date:"2026-10-17",available:true},{date:"2026-10-17",available:false}]}).success).toBe(false);
    expect(refereeProfileSchema.safeParse({...base,weeklyAvailability:[weekly[0],weekly[0]]}).success).toBe(false);
  });
  it("blocks malformed event IDs, invalid periods, and incomplete match checks",()=>{
    const evt={id:"11111111-1111-4111-8111-111111111111",kind:"GOAL",side:"HOME",
      playerUserId:null,period:1,elapsedSeconds:90,details:""};
    expect(refereeEventSchema.safeParse(evt).success).toBe(true);
    expect(refereeEventSchema.safeParse({...evt,id:"forged"}).success).toBe(false);
    expect(refereeEventSchema.safeParse({...evt,period:3}).success).toBe(false);
    expect(refereeEventSchema.safeParse({...evt,side:"VISITOR"}).success).toBe(false);
    expect(refereeChecksSchema.safeParse({homePresent:true}).success).toBe(false);
  });
});
