import {describe,it,expect} from "vitest";
import {availabilityAllows,kabulDateParts,refereeProfileSchema} from "../src/modules/referee/referee.routes.js";
const local=(iso:string)=>new Date(iso);
describe("referee availability in Kabul",()=>{
  it("interprets local weekday and clock correctly across UTC date boundary",()=>{
    expect(kabulDateParts(local("2026-10-09T20:00:00Z"))).toMatchObject({date:"2026-10-10",day:6,clock:"00:30"});
  });
  it("allows unrestricted schedules; blocks explicit weekly gaps",()=>{
    const start=local("2026-10-10T07:00:00Z"),end=local("2026-10-10T08:00:00Z");
    expect(availabilityAllows(start,end,[],[])).toBe(true);
    expect(availabilityAllows(start,end,[{day:6,start:"10:00",end:"13:00"}],[])).toBe(true);
    expect(availabilityAllows(start,end,[{day:6,start:"13:00",end:"18:00"}],[])).toBe(false);
  });
  it("honors special-date blocks and overrides",()=>{
    const start=local("2026-10-10T07:00:00Z"),end=local("2026-10-10T08:00:00Z");
    expect(availabilityAllows(start,end,[],[{date:"2026-10-10",available:false}])).toBe(false);
    expect(availabilityAllows(start,end,[{day:6,start:"15:00",end:"19:00"}],
      [{date:"2026-10-10",available:true}])).toBe(true);
  });
  it("validates profile availability ranges and experience",()=>{
    const base={level:null,experienceYears:1,biography:null,weeklyAvailability:[],exceptions:[]};
    expect(refereeProfileSchema.safeParse(base).success).toBe(true);
    expect(refereeProfileSchema.safeParse({...base,experienceYears:-1}).success).toBe(false);
    expect(refereeProfileSchema.safeParse({...base,
      weeklyAvailability:[{day:6,start:"20:00",end:"12:00"}]}).success).toBe(false);
  });
});
