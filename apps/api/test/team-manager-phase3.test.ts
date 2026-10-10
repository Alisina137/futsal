import {describe,it,expect} from "vitest";
import {aggregateCompletedMatches,assertFriendlyChallengeAllowed} from "../src/modules/team/team-manager-phase3.routes.js";

describe("Team Manager Phase 3 verified results",()=>{
  const team="11111111-1111-4111-8111-111111111111";
  const other="22222222-2222-4222-8222-222222222222";
  it("excludes underway or cancelled fixtures from official performance",()=>{
    const result=aggregateCompletedMatches([
      {homeTeamId:team,awayTeamId:other,homeScore:4,awayScore:1,status:"COMPLETED"},
      {homeTeamId:other,awayTeamId:team,homeScore:2,awayScore:2,status:"CORRECTED"},
      {homeTeamId:team,awayTeamId:other,homeScore:7,awayScore:0,status:"IN_PROGRESS"},
      {homeTeamId:team,awayTeamId:other,homeScore:null,awayScore:null,status:"SCHEDULED"},
    ],team);
    expect(result).toMatchObject({played:2,wins:1,draws:1,losses:0,goalsFor:6,
      goalsAgainst:3,goalDifference:3,winRate:50});
  });
  it("returns zero totals when a team has no finalized fixtures",()=>{
    expect(aggregateCompletedMatches([],team)).toEqual({played:0,wins:0,draws:0,losses:0,
      goalsFor:0,goalsAgainst:0,goalDifference:0,winRate:0});
  });
});
describe("Team Manager Phase 3 friendly challenge safety",()=>{
  const team="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222";
  const now=new Date("2026-10-10T06:00:00Z");
  it("rejects self-challenges and times less than 30 minutes away",()=>{
    expect(()=>assertFriendlyChallengeAllowed(team,team,new Date("2026-10-10T08:00:00Z"),now)).toThrow();
    expect(()=>assertFriendlyChallengeAllowed(team,other,new Date("2026-10-10T06:29:00Z"),now)).toThrow();
  });
  it("permits an opponent and future proposed time",()=>{
    expect(()=>assertFriendlyChallengeAllowed(team,other,new Date("2026-10-10T07:00:00Z"),now)).not.toThrow();
  });
});
