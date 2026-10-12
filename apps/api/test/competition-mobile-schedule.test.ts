import {describe,expect,it} from "vitest";
import type {CompetitionMatchDto} from "@leaguekick/contracts";
import {
  formatFixtureSchedule,groupMatchesByRound,
} from "../../mobile/src/lib/competition-match-schedule.js";

function fixture(id:string,stage:CompetitionMatchDto["stage"],roundNumber:number,
  startsAt:string|null):CompetitionMatchDto{
  return {id,stage,roundNumber,startsAt} as CompetitionMatchDto;
}

describe("competition schedule round grouping",()=>{
  it("groups same-round fixtures even when different dates separate them",()=>{
    const matches=[
      fixture("r4a","LEAGUE",4,"2026-10-12T15:30:00Z"),
      fixture("r5a","LEAGUE",5,"2026-10-18T15:30:00Z"),
      fixture("r4b","LEAGUE",4,"2026-10-15T14:00:00Z"),
      fixture("r5b","LEAGUE",5,"2026-10-19T14:00:00Z"),
    ];
    const groups=groupMatchesByRound(matches);
    expect(groups.map(g=>g.key)).toEqual(["LEAGUE:4","LEAGUE:5"]);
    expect(groups[0]?.matches.map(m=>m.id)).toEqual(["r4a","r4b"]);
    expect(groups[1]?.matches.map(m=>m.id)).toEqual(["r5a","r5b"]);
    expect(matches.map(m=>m.id)).toEqual(["r4a","r5a","r4b","r5b"]);
  });
  it("keeps group-stage and knockout rounds distinct, even with the same round number",()=>{
    const grouped=groupMatchesByRound([
      fixture("groupA","GROUP",1,null),fixture("knockout","KNOCKOUT",1,null),
      fixture("groupB","GROUP",1,null),fixture("groupR2","GROUP",2,null),
    ]);
    expect(grouped.map(g=>g.key)).toEqual(["GROUP:1","KNOCKOUT:1","GROUP:2"]);
    expect(grouped[0]?.matches).toHaveLength(2);
    expect(groupMatchesByRound([])).toEqual([]);
  });
});

describe("competition fixture day and date",()=>{
  const now=new Date("2026-10-12T05:00:00Z");
  it("shows weekday and 12-hour AM/PM Kabul clock within seven days",()=>{
    const fmt=formatFixtureSchedule("2026-10-12T15:30:00Z","en",now);
    expect(fmt).toEqual({date:"Monday",time:"08:00 PM",nearby:true});
    expect(fmt?.date).not.toMatch(/[0-9]/);
  });
  it("shows calendar date plus clock for distant future and previous games",()=>{
    const later=formatFixtureSchedule("2026-11-01T13:30:00Z","en",now);
    const earlier=formatFixtureSchedule("2026-09-01T13:30:00Z","en",now);
    expect(later?.date).toMatch(/1 Nov 2026/);
    expect(later?.time).toBe("06:00 PM");
    expect(later?.nearby).toBe(false);
    expect(earlier?.date).toContain("2026");
    expect(earlier?.nearby).toBe(false);
  });
  it("shows weekday for matches in the last week and date at the 7-day boundary",()=>{
    expect(formatFixtureSchedule("2026-10-07T12:00:00Z","en",now)?.nearby).toBe(true);
    expect(formatFixtureSchedule(new Date(now.getTime()+7*86400000),"en",now)?.nearby).toBe(false);
  });
  it("supports English, Dari and Pashto without seconds or UTC offsets",()=>{
    for(const lang of ["en","fa-AF","ps-AF"] as const){
      const formatted=formatFixtureSchedule("2026-11-01T13:30:00Z",lang,now);
      expect(formatted?.date.length).toBeGreaterThan(0);
      expect(formatted?.time.length).toBeGreaterThan(0);
      expect(formatted?.time).not.toMatch(/GMT|UTC|\+04:30|:\d{2}:\d{2}/);
    }
  });
  it("doesn't invent a time when a match is unscheduled or invalid",()=>{
    expect(formatFixtureSchedule(null,"en",now)).toBeNull();
    expect(formatFixtureSchedule("not-a-date","en",now)).toBeNull();
  });
});
