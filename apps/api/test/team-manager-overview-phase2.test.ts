import {describe,expect,it} from "vitest";
import {summarizeOfficialTeamMatches} from "../src/modules/team/team-manager-phase1.routes.js";

type Match=Parameters<typeof summarizeOfficialTeamMatches>[0][number];
const now=new Date("2026-10-16T09:00:00.000Z");
const match=(id:string,overrides:Partial<Match>):Match=>({
  id,competitionId:"competition-one",homeTeamId:"team-a",awayTeamId:"team-b",
  homeScore:null,awayScore:null,startsAt:null,status:"SCHEDULED",...overrides,
});

describe("Team Manager Phase 2 official dashboard statistics",()=>{
  it("counts only finished official matches with recorded scores",()=>{
    const record=summarizeOfficialTeamMatches([
      match("win",{homeScore:3,awayScore:1,status:"COMPLETED"}),
      match("draw",{homeScore:1,awayScore:1,status:"CORRECTED"}),
      match("loss",{homeScore:1,awayScore:2,status:"COMPLETED"}),
      match("away-win",{homeTeamId:"team-b",awayTeamId:"team-a",homeScore:0,awayScore:2,status:"COMPLETED"}),
      match("no-scores",{homeScore:null,awayScore:null,status:"COMPLETED"}),
      match("in-progress",{homeScore:2,awayScore:0,status:"IN_PROGRESS"}),
    ],"team-a",now);
    expect(record).toMatchObject({played:4,wins:2,draws:1,losses:1,winRate:50,upcoming:0,next:null});
  });
  it("only schedules future fixtures and sorts next match chronologically",()=>{
    const record=summarizeOfficialTeamMatches([
      match("late",{startsAt:new Date("2026-10-20T09:00:00.000Z")}),
      match("postponed",{status:"POSTPONED",startsAt:new Date("2026-10-17T09:00:00.000Z")}),
      match("cancelled",{status:"CANCELLED",startsAt:new Date("2026-10-17T09:00:00.000Z")}),
      match("earliest",{startsAt:new Date("2026-10-18T09:00:00.000Z")}),
      match("past",{startsAt:new Date("2026-10-01T09:00:00.000Z")}),
    ],"team-a",now);
    expect(record.upcoming).toBe(2);
    expect(record.next?.id).toBe("earliest");
  });
  it("never invents a win rate or next fixture for an empty team",()=>{
    expect(summarizeOfficialTeamMatches([],"team-a",now)).toMatchObject({
      played:0,wins:0,draws:0,losses:0,upcoming:0,winRate:0,next:null,
    });
  });
});
