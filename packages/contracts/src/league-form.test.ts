import { describe, expect, it } from "vitest";
import type { CompetitionMatchDto } from "./index";
import { lastFiveLeagueResults } from "./index";

const A="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C="cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function fixture(round:number,home:string,away:string,homeScore:number|null,awayScore:number|null,
  status:CompetitionMatchDto["status"]="COMPLETED",
  stage:CompetitionMatchDto["stage"]="LEAGUE"):CompetitionMatchDto{
  return {
    id:`00000000-0000-4000-8000-${String(round).padStart(12,"0")}`,
    competitionId:"dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    groupId:null,groupName:null,stage,roundNumber:round,slotNumber:1,
    homeTeamId:home,homeTeamName:"Home",awayTeamId:away,awayTeamName:"Away",
    areaId:null,areaName:null,startsAt:new Date(Date.UTC(2026,0,round)).toISOString(),
    endsAt:new Date(Date.UTC(2026,0,round,1)).toISOString(),
    status,homeScore,awayScore,winnerTeamId:null,
    nextMatchId:null,nextMatchSide:null,refereeUserId:null,
  };
}

describe("league last-five form (real completed matches only)",()=>{
  it("sorts recent scores oldest-to-newest, using the correct home or away perspective",()=>{
    const matches=[
      fixture(6,B,A,0,2), // win for A (away)
      fixture(1,A,B,2,1), // older win, excluded by last-five cap
      fixture(3,A,B,1,4), // loss
      fixture(5,A,B,5,1), // win
      fixture(2,A,B,0,0), // draw
      fixture(4,B,A,3,1,"CORRECTED"), // loss for A (away)
    ];
    expect(lastFiveLeagueResults(matches,A)).toEqual(["D","L","L","W","W"]);
    expect(lastFiveLeagueResults(matches,B)).toEqual(["D","W","W","L","L"]);
  });

  it("excludes in-progress, unscored, cancelled, and non-league games; never fabricates form",()=>{
    const matches=[
      fixture(1,A,B,1,1),fixture(2,A,B,null,null),
      fixture(3,A,B,2,0,"IN_PROGRESS"),
      fixture(4,A,B,2,0,"SCHEDULED"),
      fixture(5,A,B,2,0,"CANCELLED"),
      fixture(6,A,B,2,0,"COMPLETED","GROUP"),
      fixture(7,A,B,2,0,"COMPLETED","KNOCKOUT"),
      fixture(8,B,C,5,0),
    ];
    expect(lastFiveLeagueResults(matches,A)).toEqual(["D"]);
    expect(lastFiveLeagueResults(matches,C)).toEqual(["L"]);
    expect(lastFiveLeagueResults([],A)).toEqual([]);
  });

  it("uses round and slot order deterministically if match dates are missing",()=>{
    const noDate=[fixture(3,A,B,2,0),fixture(1,A,B,0,2),fixture(2,A,B,0,0)]
      .map(match=>({...match,startsAt:null,endsAt:null}));
    expect(lastFiveLeagueResults(noDate,A)).toEqual(["L","D","W"]);
  });
});
