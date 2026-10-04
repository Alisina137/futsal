import type {
  CompetitionStandingRowDto,
  CompetitionTieBreak,
} from "@leaguekick/contracts";

export type EngineTeam = {
  id: string;
  name: string;
  seed?: number | null;
};

export type EngineResult = {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
};

export type PointsConfig = {
  win: number;
  draw: number;
  loss: number;
};

export type RoundRobinFixture = {
  roundNumber: number;
  slotNumber: number;
  homeTeamId: string;
  awayTeamId: string;
};

export type KnockoutPlanMatch = {
  key: string;
  roundNumber: number;
  slotNumber: number;
  homeTeamId: string | null;
  awayTeamId: string | null;
  nextKey: string | null;
  nextSide: "HOME" | "AWAY" | null;
};

export function generateRoundRobin(teamIds: string[]): RoundRobinFixture[] {
  if (teamIds.length < 2) return [];
  const slots = [...teamIds];
  if (slots.length % 2 === 1) slots.push("__BYE__");

  const fixtures: RoundRobinFixture[] = [];
  const rounds = slots.length - 1;

  for (let round = 0; round < rounds; round += 1) {
    let slotNumber = 1;
    for (let i = 0; i < slots.length / 2; i += 1) {
      const a = slots[i]!;
      const b = slots[slots.length - 1 - i]!;
      if (a !== "__BYE__" && b !== "__BYE__") {
        const swap = (round + i) % 2 === 1;
        fixtures.push({
          roundNumber: round + 1,
          slotNumber,
          homeTeamId: swap ? b : a,
          awayTeamId: swap ? a : b,
        });
        slotNumber += 1;
      }
    }
    const fixed = slots[0]!;
    const rotating = slots.slice(1);
    rotating.unshift(rotating.pop()!);
    slots.splice(0, slots.length, fixed, ...rotating);
  }

  return fixtures;
}

function nextPowerOfTwo(value: number) {
  let result = 1;
  while (result < value) result *= 2;
  return result;
}

export function generateKnockoutPlan(teams: EngineTeam[]): KnockoutPlanMatch[] {
  if (teams.length < 2) return [];

  const ordered = [...teams].sort((a, b) => {
    const seedA = a.seed ?? Number.MAX_SAFE_INTEGER;
    const seedB = b.seed ?? Number.MAX_SAFE_INTEGER;
    return seedA - seedB || a.id.localeCompare(b.id);
  });

  const bracketSize = nextPowerOfTwo(ordered.length);
  const rounds = Math.log2(bracketSize);
  const leaves: Array<string | null> = Array.from({ length: bracketSize }, (_, index) => ordered[index]?.id ?? null);
  const matches = new Map<string, KnockoutPlanMatch>();

  for (let round = rounds; round >= 2; round -= 1) {
    const matchCount = 2 ** (round - 1);
    for (let slot = 1; slot <= matchCount; slot += 1) {
      const key = `r${round}s${slot}`;
      const nextKey = round === 2 ? "r1s1" : `r${round - 1}s${Math.ceil(slot / 2)}`;
      matches.set(key, {
        key,
        roundNumber: round,
        slotNumber: slot,
        homeTeamId: null,
        awayTeamId: null,
        nextKey,
        nextSide: slot % 2 === 1 ? "HOME" : "AWAY",
      });
    }
  }

  matches.set("r1s1", {
    key: "r1s1",
    roundNumber: 1,
    slotNumber: 1,
    homeTeamId: null,
    awayTeamId: null,
    nextKey: null,
    nextSide: null,
  });

  const firstRound = rounds;
  const firstRoundMatchCount = bracketSize / 2;
  for (let slot = 1; slot <= firstRoundMatchCount; slot += 1) {
    const key = `r${firstRound}s${slot}`;
    const home = leaves[(slot - 1) * 2] ?? null;
    const away = leaves[(slot - 1) * 2 + 1] ?? null;
    const match = matches.get(key)!;

    if (home && away) {
      match.homeTeamId = home;
      match.awayTeamId = away;
      continue;
    }

    const byeWinner = home ?? away;
    if (byeWinner && match.nextKey && match.nextSide) {
      const next = matches.get(match.nextKey)!;
      if (match.nextSide === "HOME") next.homeTeamId = byeWinner;
      else next.awayTeamId = byeWinner;
      matches.delete(key);
    } else {
      matches.delete(key);
    }
  }

  return [...matches.values()].sort((a, b) =>
    b.roundNumber - a.roundNumber || a.slotNumber - b.slotNumber
  );
}

export function assignGroups(teams: EngineTeam[], groupCount: number): Map<number, EngineTeam[]> {
  if (groupCount < 1) throw new Error("GROUP_COUNT_REQUIRED");
  const ordered = [...teams].sort((a, b) => {
    const seedA = a.seed ?? Number.MAX_SAFE_INTEGER;
    const seedB = b.seed ?? Number.MAX_SAFE_INTEGER;
    return seedA - seedB || a.id.localeCompare(b.id);
  });

  const groups = new Map<number, EngineTeam[]>();
  for (let index = 0; index < groupCount; index += 1) groups.set(index, []);

  ordered.forEach((team, index) => {
    const row = Math.floor(index / groupCount);
    const withinRow = index % groupCount;
    const groupIndex = row % 2 === 0 ? withinRow : groupCount - 1 - withinRow;
    groups.get(groupIndex)!.push(team);
  });

  return groups;
}

export function calculateStandings(
  teams: EngineTeam[],
  results: EngineResult[],
  points: PointsConfig,
  tieBreakOrder: CompetitionTieBreak[],
): CompetitionStandingRowDto[] {
  const rows = new Map<string, CompetitionStandingRowDto>();

  teams.forEach((team) => {
    rows.set(team.id, {
      position: 0,
      teamId: team.id,
      teamName: team.name,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    });
  });

  for (const result of results) {
    const home = rows.get(result.homeTeamId);
    const away = rows.get(result.awayTeamId);
    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;
    home.goalsFor += result.homeScore;
    home.goalsAgainst += result.awayScore;
    away.goalsFor += result.awayScore;
    away.goalsAgainst += result.homeScore;

    if (result.homeScore > result.awayScore) {
      home.wins += 1;
      away.losses += 1;
      home.points += points.win;
      away.points += points.loss;
    } else if (result.awayScore > result.homeScore) {
      away.wins += 1;
      home.losses += 1;
      away.points += points.win;
      home.points += points.loss;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += points.draw;
      away.points += points.draw;
    }
  }

  for (const row of rows.values()) {
    row.goalDifference = row.goalsFor - row.goalsAgainst;
  }

  const byId = new Map(teams.map((team) => [team.id, team]));
  const headToHead = (a: string, b: string) => {
    let aPoints = 0;
    let bPoints = 0;
    let aGoalDiff = 0;
    let bGoalDiff = 0;
    for (const result of results) {
      const direct =
        (result.homeTeamId === a && result.awayTeamId === b) ||
        (result.homeTeamId === b && result.awayTeamId === a);
      if (!direct) continue;
      const aHome = result.homeTeamId === a;
      const aScore = aHome ? result.homeScore : result.awayScore;
      const bScore = aHome ? result.awayScore : result.homeScore;
      aGoalDiff += aScore - bScore;
      bGoalDiff += bScore - aScore;
      if (aScore > bScore) {
        aPoints += points.win;
        bPoints += points.loss;
      } else if (bScore > aScore) {
        bPoints += points.win;
        aPoints += points.loss;
      } else {
        aPoints += points.draw;
        bPoints += points.draw;
      }
    }
    return { aPoints, bPoints, aGoalDiff, bGoalDiff };
  };

  const sorted = [...rows.values()].sort((a, b) => {
    for (const criterion of tieBreakOrder) {
      if (criterion === "POINTS" && a.points !== b.points) return b.points - a.points;
      if (criterion === "GOAL_DIFFERENCE" && a.goalDifference !== b.goalDifference) return b.goalDifference - a.goalDifference;
      if (criterion === "GOALS_FOR" && a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;
      if (criterion === "HEAD_TO_HEAD") {
        const direct = headToHead(a.teamId, b.teamId);
        if (direct.aPoints !== direct.bPoints) return direct.bPoints - direct.aPoints;
        if (direct.aGoalDiff !== direct.bGoalDiff) return direct.bGoalDiff - direct.aGoalDiff;
      }
      if (criterion === "ADMIN") {
        const seedA = byId.get(a.teamId)?.seed ?? Number.MAX_SAFE_INTEGER;
        const seedB = byId.get(b.teamId)?.seed ?? Number.MAX_SAFE_INTEGER;
        if (seedA !== seedB) return seedA - seedB;
      }
    }
    return a.teamId.localeCompare(b.teamId);
  });

  return sorted.map((row, index) => ({ ...row, position: index + 1 }));
}

export function qualifiedTeams(
  groupStandings: Map<string, CompetitionStandingRowDto[]>,
  qualifiersPerGroup: number,
): string[] {
  return [...groupStandings.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([, rows]) => rows.slice(0, qualifiersPerGroup).map((row) => row.teamId));
}
