import { describe, expect, it } from "vitest";
import {
  assignGroups,
  calculateStandings,
  generateKnockoutPlan,
  generateRoundRobin,
  qualifiedTeams,
} from "../src/modules/competition/competition.engine.js";

describe("Phase 6 competition engine", () => {
  it("generates deterministic round-robin fixtures for odd and even team counts", () => {
    const four = generateRoundRobin(["a","b","c","d"]);
    expect(four).toHaveLength(6);
    expect(new Set(four.map((match) => [match.homeTeamId, match.awayTeamId].sort().join(":"))).size).toBe(6);

    const three = generateRoundRobin(["a","b","c"]);
    expect(three).toHaveLength(3);
    expect(new Set(three.map((match) => [match.homeTeamId, match.awayTeamId].sort().join(":"))).size).toBe(3);
  });

  it("recalculates standings deterministically from persisted results", () => {
    const standings = calculateStandings(
      [
        { id:"a",name:"Alpha",seed:1 },
        { id:"b",name:"Beta",seed:2 },
        { id:"c",name:"City",seed:3 },
      ],
      [
        { homeTeamId:"a",awayTeamId:"b",homeScore:2,awayScore:0 },
        { homeTeamId:"b",awayTeamId:"c",homeScore:1,awayScore:1 },
        { homeTeamId:"c",awayTeamId:"a",homeScore:3,awayScore:1 },
      ],
      { win:3,draw:1,loss:0 },
      ["POINTS","GOAL_DIFFERENCE","GOALS_FOR","HEAD_TO_HEAD","ADMIN"],
    );

    expect(standings.map((row) => row.teamId)).toEqual(["c","a","b"]);
    expect(standings[0]).toMatchObject({ played:2,wins:1,draws:1,points:4 });
    expect(standings[1]).toMatchObject({ played:2,wins:1,losses:1,points:3 });
  });

  it("generates knockout progression links and handles byes without fake matches", () => {
    const plan = generateKnockoutPlan([
      { id:"a",name:"A",seed:1 },
      { id:"b",name:"B",seed:2 },
      { id:"c",name:"C",seed:3 },
    ]);
    expect(plan.some((match) => match.roundNumber === 2 && match.homeTeamId && match.awayTeamId)).toBe(true);
    expect(plan.some((match) => match.roundNumber === 1)).toBe(true);
    expect(plan.every((match) => match.homeTeamId !== null || match.awayTeamId !== null || match.roundNumber === 1)).toBe(true);
  });

  it("distributes byes safely for five-team knockout brackets", () => {
    const plan = generateKnockoutPlan([
      {id:"a",name:"A",seed:1},{id:"b",name:"B",seed:2},{id:"c",name:"C",seed:3},
      {id:"d",name:"D",seed:4},{id:"e",name:"E",seed:5},
    ]);

    const final = plan.find((match) => match.roundNumber === 1);
    expect(final).toBeTruthy();
    expect(plan.filter((match) => match.roundNumber === 3)).toHaveLength(1);
    expect(plan.filter((match) => match.roundNumber === 2)).toHaveLength(2);
    expect(plan).toHaveLength(4);
    expect(plan.every((match) => match.homeTeamId !== null || match.awayTeamId !== null || match.roundNumber < 3)).toBe(true);

    const linked = plan.filter((match) => match.nextKey);
    expect(linked.every((match) => plan.some((candidate) => candidate.key === match.nextKey))).toBe(true);
  });

  it("assigns groups deterministically and qualifies the requested count", () => {
    const groups = assignGroups([
      {id:"a",name:"A",seed:1},{id:"b",name:"B",seed:2},
      {id:"c",name:"C",seed:3},{id:"d",name:"D",seed:4},
    ],2);
    expect(groups.get(0)?.map((team)=>team.id)).toEqual(["a","d"]);
    expect(groups.get(1)?.map((team)=>team.id)).toEqual(["b","c"]);

    const qualified = qualifiedTeams(new Map([
      ["A",[
        {position:1,teamId:"a",teamName:"A",played:1,wins:1,draws:0,losses:0,goalsFor:1,goalsAgainst:0,goalDifference:1,points:3},
        {position:2,teamId:"d",teamName:"D",played:1,wins:0,draws:0,losses:1,goalsFor:0,goalsAgainst:1,goalDifference:-1,points:0},
      ]],
      ["B",[
        {position:1,teamId:"b",teamName:"B",played:1,wins:1,draws:0,losses:0,goalsFor:2,goalsAgainst:0,goalDifference:2,points:3},
        {position:2,teamId:"c",teamName:"C",played:1,wins:0,draws:0,losses:1,goalsFor:0,goalsAgainst:2,goalDifference:-2,points:0},
      ]],
    ]),1);
    expect(qualified).toEqual(["a","b"]);
  });
});
