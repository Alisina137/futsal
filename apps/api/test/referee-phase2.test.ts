import {describe,it,expect} from "vitest";
import {effectiveSeconds,refereeChecksSchema,refereeEventSchema,reportPlayerStats,reportScore}
  from "../src/modules/referee/referee-phase2.routes.js";
const first="11111111-1111-4111-8111-111111111111";
const player="22222222-2222-4222-8222-222222222222";
const match={homeTeamId:first,awayTeamId:"33333333-3333-4333-8333-333333333333"};
const event=(kind:"GOAL"|"YELLOW_CARD"|"RED_CARD",side:"HOME"|"AWAY")=>({
  id:first,kind,side,playerUserId:player,elapsedSeconds:123,period:1,details:"",
});
describe("referee match reports",()=>{
  it("scores only goal events, not cautions or other match events",()=>{
    expect(reportScore([event("GOAL","HOME"),event("GOAL","AWAY"),event("YELLOW_CARD","AWAY")]))
      .toEqual({homeScore:1,awayScore:1});
  });
  it("attributes verified goal/card events to the correct team and player",()=>{
    const rows=reportPlayerStats([event("GOAL","HOME"),event("GOAL","HOME"),
      event("YELLOW_CARD","HOME"),event("RED_CARD","HOME")],match);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({teamId:first,playerUserId:player,
      appeared:true,goals:2,yellowCards:1,redCards:1,assists:0});
  });
  it("credits a documented goal assist only to a different player in the same team",()=>{
    const assist="44444444-4444-4444-8444-444444444444";
    const stats=reportPlayerStats([{...event("GOAL","HOME"),assistingUserId:assist}],match);
    expect(stats).toHaveLength(2);
    expect(stats.find(p=>p.playerUserId===player)?.goals).toBe(1);
    expect(stats.find(p=>p.playerUserId===assist)?.assists).toBe(1);
  });
  it("uses the saved server clock and never decrements after a pause",()=>{
    expect(effectiveSeconds({elapsedSeconds:81,period:1,runningSince:null},
      new Date("2026-10-10T11:00:00Z"))).toBe(81);
    expect(effectiveSeconds({elapsedSeconds:81,period:2,runningSince:"2026-10-10T11:00:00Z"},
      new Date("2026-10-10T11:00:09Z"))).toBe(90);
  });
  it("rejects malformed event descriptions, clock seconds and checklist values",()=>{
    const base={...event("GOAL","HOME")};
    expect(refereeEventSchema.safeParse(base).success).toBe(true);
    expect(refereeEventSchema.safeParse({...base,period:3}).success).toBe(false);
    expect(refereeEventSchema.safeParse({...base,kind:"UNKNOWN"}).success).toBe(false);
    expect(refereeEventSchema.safeParse({...base,details:"a".repeat(401)}).success).toBe(false);
    expect(refereeChecksSchema.safeParse({homePresent:true}).success).toBe(false);
  });
});
