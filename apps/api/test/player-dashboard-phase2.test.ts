import {describe,expect,it} from "vitest";
import {playerMatchSelection,playerScheduleOverlap} from "../src/modules/team/player-dashboard-phase2.routes.js";

describe("Player Dashboard Phase 2 privacy and player selection",()=>{
  const player="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222";
  it("never exposes other members' manager-controlled lineup as the requesting player's status",()=>{
    expect(playerMatchSelection(undefined,player)).toBe("NOT_PUBLISHED");
    expect(playerMatchSelection({starters:[other],substitutes:[]},player)).toBe("NOT_SELECTED");
    expect(playerMatchSelection({starters:[player],substitutes:[]},player)).toBe("STARTER");
    expect(playerMatchSelection({starters:[other],substitutes:[player]},player)).toBe("SUBSTITUTE");
  });
});
describe("Player Dashboard Phase 2 calendar conflict boundaries",()=>{
  it("detects actual overlap but not adjacent events",()=>{
    const one={startsAt:"2026-10-10T10:00:00.000Z",endsAt:"2026-10-10T11:30:00.000Z"};
    expect(playerScheduleOverlap(one,{startsAt:"2026-10-10T11:00:00.000Z",endsAt:"2026-10-10T12:00:00.000Z"})).toBe(true);
    expect(playerScheduleOverlap(one,{startsAt:"2026-10-10T11:30:00.000Z",endsAt:"2026-10-10T12:00:00.000Z"})).toBe(false);
    expect(playerScheduleOverlap(one,{startsAt:"2026-10-10T08:30:00.000Z",endsAt:"2026-10-10T10:00:00.000Z"})).toBe(false);
  });
});
