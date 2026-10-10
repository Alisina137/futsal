import {describe,expect,it} from "vitest";
import {careerAwards,careerTotals,kabulMonthKey,kabulYear,officialMatchResult,
  uniqueOfficialRecords,type CareerRecord,type CareerChampion} from "../src/modules/team/player-career.js";
const make=(index:number,patch:Partial<CareerRecord>={}):CareerRecord=>({
  matchId:"match-"+index,teamId:"team-A",teamName:"Old Team",
  competitionId:"competition-A",competitionName:"Autumn Cup",
  recordedAt:new Date(Date.UTC(2025,0,5+index,18)).toISOString(),
  startsAt:new Date(Date.UTC(2025,0,5+index,18)).toISOString(),
  goals:0,assists:0,yellowCards:0,redCards:0,
  cleanSheet:false,playerOfMatch:false,homeScore:1,awayScore:0,result:"WIN",...patch,
});
describe("Player career: official statistics and historical records",()=>{
  it("counts official appearances, goals, assists, cards and outcomes once",()=>{
    const rows=[make(1,{goals:2,assists:1,playerOfMatch:true,yellowCards:1}),
      make(2,{teamId:"team-B",teamName:"Current Team",goals:1,redCards:1,result:"LOSS",cleanSheet:true}),
      make(2,{goals:99}),make(3,{result:"DRAW"}),make(4,{result:"UNKNOWN"})];
    expect(careerTotals(rows)).toEqual({
      matches:4,goals:3,assists:1,yellowCards:1,redCards:1,
      cleanSheets:1,playerOfMatch:1,wins:1,draws:1,losses:1,
      unknownResults:1,winRate:33,
    });
    expect(uniqueOfficialRecords(rows)).toHaveLength(4);
  });
  it("keeps career records from former teams, including when no active team exists",()=>{
    expect(careerTotals([make(1),make(2,{teamId:"old-team"})]).matches).toBe(2);
    expect(careerTotals([]).matches).toBe(0);
  });
  it("calculates result from the player's side only, never guessing incomplete scores",()=>{
    expect(officialMatchResult("a","b","a",4,1)).toBe("WIN");
    expect(officialMatchResult("a","b","b",4,1)).toBe("LOSS");
    expect(officialMatchResult("a","b","b",1,1)).toBe("DRAW");
    expect(officialMatchResult("a","b","a",null,1)).toBe("UNKNOWN");
    expect(officialMatchResult("a","b","not-a-team",5,1)).toBe("UNKNOWN");
  });
  it("uses Kabul calendar at midnight/year rollover, not UTC year",()=>{
    const timestamp="2025-12-31T20:20:00.000Z";
    expect(kabulYear(timestamp)).toBe(2026);
    expect(kabulMonthKey(timestamp)).toBe("2026-01");
  });
});
describe("Player achievements: verified career milestones",()=>{
  const champion:CareerChampion={
    competitionId:"competition-A",competitionName:"Autumn Cup",
    teamId:"team-A",teamName:"Old Team",achievedAt:"2025-10-15T12:00:00Z",
  };
  it("awards a champion only with an official appearance for their champion team",()=>{
    expect(careerAwards([], [champion])).toHaveLength(0);
    const otherTeam=make(1,{teamId:"team-B"});
    expect(careerAwards([otherTeam],[champion]).some(a=>a.kind==="CHAMPION")).toBe(false);
    const won=careerAwards([make(1)], [champion,champion]);
    expect(won.filter(a=>a.kind==="CHAMPION")).toHaveLength(1);
    expect(won.find(a=>a.kind==="CHAMPION")).toMatchObject({verified:true,teamId:"team-A"});
  });
  it("honors the first match, first goal, 10 matches, 25 goals and official player of match",()=>{
    const rows=Array.from({length:10},(_,i)=>make(i,{goals:3,playerOfMatch:i===0}));
    const a=careerAwards(rows,[]);
    expect(a.map(v=>v.label)).toEqual(expect.arrayContaining([
      "FIRST_MATCH","FIRST_GOAL","TEN_MATCHES","TWENTY_FIVE_GOALS","PLAYER_OF_MATCH",
    ]));
    expect(a.filter(v=>v.label==="TWENTY_FIVE_GOALS")).toHaveLength(1);
    expect(a.every(v=>v.verified)).toBe(true);
  });
  it("does not automatically award advertised prizes or unsupported individual trophies",()=>{
    const a=careerAwards([make(1)],[]);
    expect(a.map(x=>x.label)).not.toContain("TOP_SCORER");
    expect(a.map(x=>x.label)).not.toContain("BEST_GOALKEEPER");
    expect(a.some(x=>x.kind==="CHAMPION")).toBe(false);
  });
});
