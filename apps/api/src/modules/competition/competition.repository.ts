import type {
  CompetitionDto,
  CompetitionListItemDto,
  CompetitionMatchDto,
  CompetitionMediaPostDto,
  CompetitionTeamDto,
} from "@leaguekick/contracts";
import type { Database } from "@leaguekick/database";
import {
  auditLogs,
  bookings,
  competitionGroups,
  competitionMatches,
  competitions,
  competitionTeams,
  playerMatchStats,
  playerProfiles,
  socialFollows,
  socialPosts,
  teamMemberships,
  teams,
  users,
  venueAreas,
  venueBlocks,
  venueReferees,
  venueSubscriptions,
  venues,
} from "@leaguekick/database";
import { and, count, desc, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import { errors } from "../../lib/errors.js";
import type {
  CompetitionRecord,
  CompetitionRepository,
  CompetitionTeamRecord,
  CompetitionVenueRecord,
} from "./competition.types.js";

function toRecord(row: typeof competitions.$inferSelect): CompetitionRecord {
  return {
    id: row.id,
    venueId: row.venueId,
    createdByUserId: row.createdByUserId,
    name: row.name,
    description: row.description,
    format: row.format,
    status: row.status,
    published: row.published,
    maxTeams: row.maxTeams,
    registrationFeeAfn: row.registrationFeeAfn,
    winPoints: row.winPoints,
    drawPoints: row.drawPoints,
    lossPoints: row.lossPoints,
    tieBreakOrder: row.tieBreakOrder as CompetitionRecord["tieBreakOrder"],
    groupCount: row.groupCount,
    qualifiersPerGroup: row.qualifiersPerGroup,
    registrationClosesAt: row.registrationClosesAt,
    matchDurationMinutes: row.matchDurationMinutes,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    materialPlayStartedAt: row.materialPlayStartedAt,
  };
}

export class DrizzleCompetitionRepository implements CompetitionRepository {
  constructor(private readonly db: Database) {}

  async getOwnerVenue(ownerUserId: string): Promise<CompetitionVenueRecord | null> {
    const [venue] = await this.db.select().from(venues)
      .where(eq(venues.ownerUserId, ownerUserId))
      .limit(1);
    if (!venue) return null;

    const [areas, subscriptionRows] = await Promise.all([
      this.db.select({
        id: venueAreas.id,
        name: venueAreas.name,
        active: venueAreas.active,
      }).from(venueAreas).where(eq(venueAreas.venueId, venue.id)),
      this.db.select().from(venueSubscriptions)
        .where(eq(venueSubscriptions.venueId, venue.id))
        .limit(1),
    ]);

    const subscription = subscriptionRows[0];
    return {
      id: venue.id,
      ownerUserId: venue.ownerUserId,
      name: venue.name,
      status: venue.status,
      areas,
      subscription: subscription ? {
        status: subscription.status,
        trialEndsAt: subscription.trialEndsAt,
        activeUntil: subscription.activeUntil,
      } : null,
    };
  }

  async isVenueReferee(venueId: string, userId: string) {
    const [row] = await this.db.select({ userId: venueReferees.userId })
      .from(venueReferees)
      .innerJoin(users, eq(venueReferees.userId, users.id))
      .where(and(
        eq(venueReferees.venueId, venueId),
        eq(venueReferees.userId, userId),
        eq(users.status, "ACTIVE"),
      ))
      .limit(1);
    return Boolean(row);
  }

  async getCompetitionRecord(competitionId: string) {
    const [row] = await this.db.select().from(competitions)
      .where(eq(competitions.id, competitionId))
      .limit(1);
    return row ? toRecord(row) : null;
  }

  async listCompetitionTeams(competitionId: string): Promise<CompetitionTeamRecord[]> {
    const rows = await this.db.select({
      competitionId: competitionTeams.competitionId,
      teamId: competitionTeams.teamId,
      teamName: teams.name,
      logoUrl: teams.logoUrl,
      managerUserId: teams.managerUserId,
      teamPrivacy: teams.privacy,
      status: competitionTeams.status,
      seed: competitionTeams.seed,
      groupId: competitionTeams.groupId,
      groupName: competitionGroups.name,
      feeStatus: competitionTeams.feeStatus,
      feePaymentReference: competitionTeams.feePaymentReference,
      feeConfirmedAt: competitionTeams.feeConfirmedAt,
    }).from(competitionTeams)
      .innerJoin(teams, eq(competitionTeams.teamId, teams.id))
      .leftJoin(competitionGroups, eq(competitionTeams.groupId, competitionGroups.id))
      .where(eq(competitionTeams.competitionId, competitionId));

    return rows;
  }

  private async listMatchDtos(competitionId: string): Promise<CompetitionMatchDto[]> {
    const rows = await this.db.select({
      match: competitionMatches,
      groupName: competitionGroups.name,
      areaName: venueAreas.name,
    }).from(competitionMatches)
      .leftJoin(competitionGroups, eq(competitionMatches.groupId, competitionGroups.id))
      .leftJoin(venueAreas, eq(competitionMatches.areaId, venueAreas.id))
      .where(eq(competitionMatches.competitionId, competitionId));

    const teamRows = await this.db.select({
      id: teams.id,
      name: teams.name,
    }).from(competitionTeams)
      .innerJoin(teams, eq(competitionTeams.teamId, teams.id))
      .where(eq(competitionTeams.competitionId, competitionId));
    const teamNames = new Map(teamRows.map((row) => [row.id, row.name]));

    return rows.map(({ match, groupName, areaName }) => ({
      id: match.id,
      competitionId: match.competitionId,
      groupId: match.groupId,
      groupName: groupName ?? null,
      stage: match.stage,
      roundNumber: match.roundNumber,
      slotNumber: match.slotNumber,
      homeTeamId: match.homeTeamId,
      homeTeamName: match.homeTeamId ? teamNames.get(match.homeTeamId) ?? null : null,
      awayTeamId: match.awayTeamId,
      awayTeamName: match.awayTeamId ? teamNames.get(match.awayTeamId) ?? null : null,
      areaId: match.areaId,
      areaName: areaName ?? null,
      startsAt: match.startsAt?.toISOString() ?? null,
      endsAt: match.endsAt?.toISOString() ?? null,
      status: match.status,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      winnerTeamId: match.winnerTeamId,
      nextMatchId: match.nextMatchId,
      nextMatchSide: match.nextMatchSide === "HOME" || match.nextMatchSide === "AWAY" ? match.nextMatchSide : null,
      refereeUserId: match.refereeUserId,
    }));
  }

  private async listPlayerStats(competitionId: string): Promise<CompetitionDto["playerStats"]> {
    const rows = await this.db.select({
      playerUserId: playerMatchStats.playerUserId,
      publicDisplayName: playerProfiles.publicDisplayName,
      fallbackName: users.displayName,
      teamId: playerMatchStats.teamId,
      teamName: teams.name,
      appearances: sql<number>`sum(case when ${playerMatchStats.appeared} then 1 else 0 end)`,
      goals: sql<number>`sum(${playerMatchStats.goals})`,
      assists: sql<number>`sum(${playerMatchStats.assists})`,
      yellowCards: sql<number>`sum(${playerMatchStats.yellowCards})`,
      redCards: sql<number>`sum(${playerMatchStats.redCards})`,
      cleanSheets: sql<number>`sum(case when ${playerMatchStats.cleanSheet} then 1 else 0 end)`,
      playerOfMatchAwards: sql<number>`sum(case when ${playerMatchStats.playerOfMatch} then 1 else 0 end)`,
    }).from(playerMatchStats)
      .innerJoin(competitionMatches, eq(playerMatchStats.matchId, competitionMatches.id))
      .innerJoin(users, eq(playerMatchStats.playerUserId, users.id))
      .leftJoin(playerProfiles, eq(playerMatchStats.playerUserId, playerProfiles.userId))
      .innerJoin(teams, eq(playerMatchStats.teamId, teams.id))
      .where(eq(competitionMatches.competitionId, competitionId))
      .groupBy(
        playerMatchStats.playerUserId,
        playerProfiles.publicDisplayName,
        users.displayName,
        playerMatchStats.teamId,
        teams.name,
      );

    return rows.map((row) => ({
      playerUserId: row.playerUserId,
      publicDisplayName: row.publicDisplayName ?? row.fallbackName,
      teamId: row.teamId,
      teamName: row.teamName,
      appearances: Number(row.appearances ?? 0),
      goals: Number(row.goals ?? 0),
      assists: Number(row.assists ?? 0),
      yellowCards: Number(row.yellowCards ?? 0),
      redCards: Number(row.redCards ?? 0),
      cleanSheets: Number(row.cleanSheets ?? 0),
      playerOfMatchAwards: Number(row.playerOfMatchAwards ?? 0),
    }));
  }

  async getCompetitionDto(competitionId: string): Promise<CompetitionDto | null> {
    const [row] = await this.db.select({
      competition: competitions,
      venueName: venues.name,
    }).from(competitions)
      .innerJoin(venues, eq(competitions.venueId, venues.id))
      .where(eq(competitions.id, competitionId))
      .limit(1);
    if (!row) return null;

    const [teamRows, matches, playerStats] = await Promise.all([
      this.listCompetitionTeams(competitionId),
      this.listMatchDtos(competitionId),
      this.listPlayerStats(competitionId),
    ]);

    const teamsDto: CompetitionTeamDto[] = teamRows.map((team) => ({
      teamId: team.teamId,
      teamName: team.teamName,
      logoUrl: team.logoUrl,
      status: team.status,
      seed: team.seed,
      groupId: team.groupId,
      groupName: team.groupName,
      feeStatus: team.feeStatus,
      feePaymentReference: team.feePaymentReference,
      feeConfirmedAt: team.feeConfirmedAt?.toISOString() ?? null,
    }));

    const finalMatch = matches
      .filter((match) => match.stage === "KNOCKOUT" && match.roundNumber === 1)
      .sort((a, b) => a.slotNumber - b.slotNumber)[0];

    return {
      id: row.competition.id,
      venueId: row.competition.venueId,
      venueName: row.venueName,
      name: row.competition.name,
      description: row.competition.description,
      format: row.competition.format,
      status: row.competition.status,
      published: row.competition.published,
      maxTeams: row.competition.maxTeams,
      registrationFeeAfn: row.competition.registrationFeeAfn,
      winPoints: row.competition.winPoints,
      drawPoints: row.competition.drawPoints,
      lossPoints: row.competition.lossPoints,
      tieBreakOrder: row.competition.tieBreakOrder as CompetitionDto["tieBreakOrder"],
      groupCount: row.competition.groupCount,
      qualifiersPerGroup: row.competition.qualifiersPerGroup,
      registrationClosesAt: row.competition.registrationClosesAt?.toISOString() ?? null,
      matchDurationMinutes: row.competition.matchDurationMinutes,
      startsAt: row.competition.startsAt?.toISOString() ?? null,
      endsAt: row.competition.endsAt?.toISOString() ?? null,
      teams: teamsDto,
      matches,
      standings: [],
      playerStats,
      championTeamId: finalMatch?.winnerTeamId ?? null,
    };
  }

  private async listItems(where: ReturnType<typeof eq>): Promise<CompetitionListItemDto[]> {
    const rows = await this.db.select({
      competition: competitions,
      venueName: venues.name,
    }).from(competitions)
      .innerJoin(venues, eq(competitions.venueId, venues.id))
      .where(where);

    const items: CompetitionListItemDto[] = [];
    for (const row of rows) {
      const [accepted] = await this.db.select({ value: count() }).from(competitionTeams).where(and(
        eq(competitionTeams.competitionId, row.competition.id),
        eq(competitionTeams.status, "ACCEPTED"),
      ));
      items.push({
        id: row.competition.id,
        venueId: row.competition.venueId,
        venueName: row.venueName,
        name: row.competition.name,
        description: row.competition.description,
        format: row.competition.format,
        status: row.competition.status,
        published: row.competition.published,
        maxTeams: row.competition.maxTeams,
        registrationFeeAfn: row.competition.registrationFeeAfn,
        winPoints: row.competition.winPoints,
        drawPoints: row.competition.drawPoints,
        lossPoints: row.competition.lossPoints,
        tieBreakOrder: row.competition.tieBreakOrder as CompetitionListItemDto["tieBreakOrder"],
        groupCount: row.competition.groupCount,
        qualifiersPerGroup: row.competition.qualifiersPerGroup,
        registrationClosesAt: row.competition.registrationClosesAt?.toISOString() ?? null,
        matchDurationMinutes: row.competition.matchDurationMinutes,
        startsAt: row.competition.startsAt?.toISOString() ?? null,
        endsAt: row.competition.endsAt?.toISOString() ?? null,
        acceptedTeams: Number(accepted?.value ?? 0),
      });
    }
    return items.sort((a, b) => (a.startsAt ?? a.name).localeCompare(b.startsAt ?? b.name));
  }

  async listOwnerCompetitions(ownerUserId: string) {
    return this.listItems(eq(venues.ownerUserId, ownerUserId));
  }

  async listPublicCompetitions() {
    return this.listItems(eq(competitions.published, true));
  }

  async createCompetition(input: Parameters<CompetitionRepository["createCompetition"]>[0]) {
    const [created] = await this.db.insert(competitions).values({
      venueId: input.venueId,
      createdByUserId: input.createdByUserId,
      name: input.name,
      description: input.description,
      format: input.format,
      status: "DRAFT",
      published: false,
      maxTeams: input.maxTeams,
      registrationFeeAfn: input.registrationFeeAfn,
      winPoints: input.winPoints,
      drawPoints: input.drawPoints,
      lossPoints: input.lossPoints,
      tieBreakOrder: input.tieBreakOrder,
      groupCount: input.groupCount,
      qualifiersPerGroup: input.qualifiersPerGroup,
      registrationClosesAt: input.registrationClosesAt,
      matchDurationMinutes: input.matchDurationMinutes,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      createdAt: input.now,
      updatedAt: input.now,
    }).returning({ id: competitions.id });
    if (!created) throw new Error("Competition could not be created.");
    return (await this.getCompetitionDto(created.id))!;
  }

  async updateCompetition(competitionId: string, input: Parameters<CompetitionRepository["updateCompetition"]>[1]) {
    const patch: Partial<typeof competitions.$inferInsert> = { updatedAt: input.updatedAt };
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description;
    if (input.format !== undefined) patch.format = input.format;
    if (input.maxTeams !== undefined) patch.maxTeams = input.maxTeams;
    if (input.registrationFeeAfn !== undefined) patch.registrationFeeAfn = input.registrationFeeAfn;
    if (input.winPoints !== undefined) patch.winPoints = input.winPoints;
    if (input.drawPoints !== undefined) patch.drawPoints = input.drawPoints;
    if (input.lossPoints !== undefined) patch.lossPoints = input.lossPoints;
    if (input.tieBreakOrder !== undefined) patch.tieBreakOrder = input.tieBreakOrder;
    if (input.groupCount !== undefined) patch.groupCount = input.groupCount;
    if (input.qualifiersPerGroup !== undefined) patch.qualifiersPerGroup = input.qualifiersPerGroup;
    if (input.registrationClosesAt !== undefined) patch.registrationClosesAt = input.registrationClosesAt;
    if (input.matchDurationMinutes !== undefined) patch.matchDurationMinutes = input.matchDurationMinutes;
    if (input.startsAt !== undefined) patch.startsAt = input.startsAt;
    if (input.endsAt !== undefined) patch.endsAt = input.endsAt;
    await this.db.update(competitions).set(patch).where(eq(competitions.id, competitionId));
    return this.getCompetitionDto(competitionId);
  }

  async setCompetitionState(competitionId: string, input: Parameters<CompetitionRepository["setCompetitionState"]>[1]) {
    const patch: Partial<typeof competitions.$inferInsert> = { updatedAt: input.updatedAt };
    if (input.status !== undefined) patch.status = input.status;
    if (input.published !== undefined) patch.published = input.published;
    if (input.publishedAt !== undefined) patch.publishedAt = input.publishedAt;
    if (input.materialPlayStartedAt !== undefined) patch.materialPlayStartedAt = input.materialPlayStartedAt;
    if (input.completedAt !== undefined) patch.completedAt = input.completedAt;
    if (input.archivedAt !== undefined) patch.archivedAt = input.archivedAt;
    await this.db.update(competitions).set(patch).where(eq(competitions.id, competitionId));
    return this.getCompetitionDto(competitionId);
  }

  async getTeam(teamId: string) {
    const [row] = await this.db.select({
      id: teams.id,
      name: teams.name,
      managerUserId: teams.managerUserId,
      status: teams.status,
    }).from(teams).where(eq(teams.id, teamId)).limit(1);
    return row ?? null;
  }

  async getRegistration(competitionId: string, teamId: string) {
    const rows = await this.listCompetitionTeams(competitionId);
    return rows.find((item) => item.teamId === teamId) ?? null;
  }

  async applyTeam(input: Parameters<CompetitionRepository["applyTeam"]>[0]) {
    const existing = await this.getRegistration(input.competitionId, input.teamId);
    if (existing) {
      await this.db.update(competitionTeams).set({
        status: "APPLIED",
        appliedByUserId: input.managerUserId,
        respondedByUserId: null,
        respondedAt: null,
        updatedAt: input.now,
      }).where(and(
        eq(competitionTeams.competitionId, input.competitionId),
        eq(competitionTeams.teamId, input.teamId),
      ));
      return;
    }
    await this.db.insert(competitionTeams).values({
      competitionId: input.competitionId,
      teamId: input.teamId,
      status: "APPLIED",
      appliedByUserId: input.managerUserId,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  async inviteTeam(input: Parameters<CompetitionRepository["inviteTeam"]>[0]) {
    const existing = await this.getRegistration(input.competitionId, input.teamId);
    if (existing) {
      await this.db.update(competitionTeams).set({
        status: "INVITED",
        seed: input.seed,
        respondedByUserId: null,
        respondedAt: null,
        updatedAt: input.now,
      }).where(and(
        eq(competitionTeams.competitionId, input.competitionId),
        eq(competitionTeams.teamId, input.teamId),
      ));
      return;
    }
    await this.db.insert(competitionTeams).values({
      competitionId: input.competitionId,
      teamId: input.teamId,
      status: "INVITED",
      seed: input.seed,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  async decideRegistration(input: Parameters<CompetitionRepository["decideRegistration"]>[0]) {
    await this.db.update(competitionTeams).set({
      status: input.status,
      seed: input.seed,
      respondedByUserId: input.ownerUserId,
      respondedAt: input.now,
      updatedAt: input.now,
    }).where(and(
      eq(competitionTeams.competitionId, input.competitionId),
      eq(competitionTeams.teamId, input.teamId),
    ));
  }

  async respondToInvitation(input: Parameters<CompetitionRepository["respondToInvitation"]>[0]) {
    await this.db.update(competitionTeams).set({
      status: input.status,
      respondedByUserId: input.managerUserId,
      respondedAt: input.now,
      updatedAt: input.now,
    }).where(and(
      eq(competitionTeams.competitionId, input.competitionId),
      eq(competitionTeams.teamId, input.teamId),
      eq(competitionTeams.status, "INVITED"),
    ));
  }

  async withdrawTeam(input: Parameters<CompetitionRepository["withdrawTeam"]>[0]) {
    await this.db.update(competitionTeams).set({
      status: "WITHDRAWN",
      respondedByUserId: input.managerUserId,
      respondedAt: input.now,
      updatedAt: input.now,
    }).where(and(
      eq(competitionTeams.competitionId, input.competitionId),
      eq(competitionTeams.teamId, input.teamId),
    ));
  }

  async countAcceptedTeams(competitionId: string) {
    const [row] = await this.db.select({ value: count() }).from(competitionTeams).where(and(
      eq(competitionTeams.competitionId, competitionId),
      eq(competitionTeams.status, "ACCEPTED"),
    ));
    return Number(row?.value ?? 0);
  }

  async hasCompletedMatch(competitionId: string) {
    const [row] = await this.db.select({ id: competitionMatches.id }).from(competitionMatches).where(and(
      eq(competitionMatches.competitionId, competitionId),
      inArray(competitionMatches.status, ["COMPLETED", "CORRECTED"]),
    )).limit(1);
    return Boolean(row);
  }


  async replaceGroupStage(
    competitionId: string,
    groups: Array<{
      name: string;
      sortOrder: number;
      teamIds: string[];
      fixtures: Array<{ roundNumber: number; slotNumber: number; homeTeamId: string; awayTeamId: string }>;
    }>,
    now: Date,
  ) {
    await this.db.transaction(async (tx) => {
      const [played] = await tx.select({ id: competitionMatches.id }).from(competitionMatches).where(and(
        eq(competitionMatches.competitionId, competitionId),
        inArray(competitionMatches.status, ["IN_PROGRESS", "COMPLETED", "CORRECTED"]),
      )).limit(1);
      if (played) throw errors.conflict("FIXTURES_LOCKED", "Group fixtures cannot be regenerated after play begins.");

      await tx.delete(competitionMatches).where(eq(competitionMatches.competitionId, competitionId));
      await tx.update(competitionTeams).set({ groupId: null, qualifiedAt: null, updatedAt: now })
        .where(eq(competitionTeams.competitionId, competitionId));
      await tx.delete(competitionGroups).where(eq(competitionGroups.competitionId, competitionId));

      for (const group of groups) {
        const [created] = await tx.insert(competitionGroups).values({
          competitionId,
          name: group.name,
          sortOrder: group.sortOrder,
          createdAt: now,
        }).returning({ id: competitionGroups.id });
        if (!created) throw new Error("Competition group could not be created.");

        for (const teamId of group.teamIds) {
          await tx.update(competitionTeams).set({ groupId: created.id, updatedAt: now }).where(and(
            eq(competitionTeams.competitionId, competitionId),
            eq(competitionTeams.teamId, teamId),
            eq(competitionTeams.status, "ACCEPTED"),
          ));
        }

        if (group.fixtures.length > 0) {
          await tx.insert(competitionMatches).values(group.fixtures.map((fixture) => ({
            competitionId,
            groupId: created.id,
            stage: "GROUP" as const,
            roundNumber: fixture.roundNumber,
            slotNumber: fixture.slotNumber,
            homeTeamId: fixture.homeTeamId,
            awayTeamId: fixture.awayTeamId,
            status: "UNSCHEDULED" as const,
            createdAt: now,
            updatedAt: now,
          })));
        }
      }
    });
  }

  async replaceKnockoutStage(
    competitionId: string,
    matches: Array<{
      key: string;
      roundNumber: number;
      slotNumber: number;
      homeTeamId: string | null;
      awayTeamId: string | null;
      nextKey: string | null;
      nextSide: "HOME" | "AWAY" | null;
    }>,
    qualifiedTeamIds: string[],
    now: Date,
  ) {
    await this.db.transaction(async (tx) => {
      const [started] = await tx.select({ id: competitionMatches.id }).from(competitionMatches).where(and(
        eq(competitionMatches.competitionId, competitionId),
        eq(competitionMatches.stage, "KNOCKOUT"),
        inArray(competitionMatches.status, ["IN_PROGRESS", "COMPLETED", "CORRECTED"]),
      )).limit(1);
      if (started) throw errors.conflict("KNOCKOUT_LOCKED", "Knockout bracket cannot be rebuilt after knockout play begins.");

      await tx.delete(competitionMatches).where(and(
        eq(competitionMatches.competitionId, competitionId),
        eq(competitionMatches.stage, "KNOCKOUT"),
      ));
      await tx.update(competitionTeams).set({ qualifiedAt: null, updatedAt: now })
        .where(eq(competitionTeams.competitionId, competitionId));
      for (const teamId of qualifiedTeamIds) {
        await tx.update(competitionTeams).set({ qualifiedAt: now, updatedAt: now }).where(and(
          eq(competitionTeams.competitionId, competitionId),
          eq(competitionTeams.teamId, teamId),
        ));
      }

      const ids = new Map<string,string>();
      for (const match of matches) {
        const [created] = await tx.insert(competitionMatches).values({
          competitionId,
          stage: "KNOCKOUT",
          roundNumber: match.roundNumber,
          slotNumber: match.slotNumber,
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
          status: "UNSCHEDULED",
          nextMatchSide: match.nextSide,
          createdAt: now,
          updatedAt: now,
        }).returning({ id: competitionMatches.id });
        if (!created) throw new Error("Knockout match could not be created.");
        ids.set(match.key, created.id);
      }

      for (const match of matches) {
        const id = ids.get(match.key)!;
        await tx.update(competitionMatches).set({
          nextMatchId: match.nextKey ? ids.get(match.nextKey) ?? null : null,
          updatedAt: now,
        }).where(eq(competitionMatches.id, id));
      }
    });
  }

  async groupStageCompleted(competitionId: string) {
    const rows = await this.db.select({ status: competitionMatches.status }).from(competitionMatches).where(and(
      eq(competitionMatches.competitionId, competitionId),
      eq(competitionMatches.stage, "GROUP"),
    ));
    return rows.length > 0 && rows.every((row) => row.status === "COMPLETED" || row.status === "CORRECTED");
  }

  async knockoutStarted(competitionId: string) {
    const [row] = await this.db.select({ id: competitionMatches.id }).from(competitionMatches).where(and(
      eq(competitionMatches.competitionId, competitionId),
      eq(competitionMatches.stage, "KNOCKOUT"),
      inArray(competitionMatches.status, ["IN_PROGRESS", "COMPLETED", "CORRECTED"]),
    )).limit(1);
    return Boolean(row);
  }

  async knockoutCompleted(competitionId: string) {
    const rows = await this.db.select({ status: competitionMatches.status }).from(competitionMatches).where(and(
      eq(competitionMatches.competitionId, competitionId),
      eq(competitionMatches.stage, "KNOCKOUT"),
    ));
    return rows.length > 0 && rows.every((row) => row.status === "COMPLETED" || row.status === "CORRECTED");
  }

  async advanceKnockoutWinner(matchId: string, winnerTeamId: string, now: Date) {
    await this.db.transaction(async (tx) => {
      const [match] = await tx.select().from(competitionMatches).where(eq(competitionMatches.id, matchId)).limit(1);
      if (!match || !match.nextMatchId || !match.nextMatchSide) return;
      const patch = match.nextMatchSide === "HOME"
        ? { homeTeamId: winnerTeamId, updatedAt: now }
        : { awayTeamId: winnerTeamId, updatedAt: now };
      await tx.update(competitionMatches).set(patch).where(eq(competitionMatches.id, match.nextMatchId));
    });
  }

  async replaceKnockoutParticipant(matchId: string, winnerTeamId: string, now: Date) {
    return this.advanceKnockoutWinner(matchId, winnerTeamId, now);
  }

  async replaceLeagueFixtures(
    competitionId: string,
    fixtures: Array<{ roundNumber: number; slotNumber: number; homeTeamId: string; awayTeamId: string }>,
    now: Date,
  ) {
    await this.db.transaction(async (tx) => {
      const [played] = await tx.select({ id: competitionMatches.id }).from(competitionMatches).where(and(
        eq(competitionMatches.competitionId, competitionId),
        inArray(competitionMatches.status, ["COMPLETED", "CORRECTED", "IN_PROGRESS"]),
      )).limit(1);
      if (played) throw errors.conflict("FIXTURES_LOCKED", "Fixtures cannot be regenerated after play begins.");

      await tx.delete(competitionMatches).where(eq(competitionMatches.competitionId, competitionId));
      if (fixtures.length > 0) {
        await tx.insert(competitionMatches).values(fixtures.map((fixture) => ({
          competitionId,
          stage: "LEAGUE" as const,
          roundNumber: fixture.roundNumber,
          slotNumber: fixture.slotNumber,
          homeTeamId: fixture.homeTeamId,
          awayTeamId: fixture.awayTeamId,
          status: "UNSCHEDULED" as const,
          createdAt: now,
          updatedAt: now,
        })));
      }
    });
  }

  async getMatch(matchId: string) {
    const [row] = await this.db.select({ competitionId: competitionMatches.competitionId })
      .from(competitionMatches)
      .where(eq(competitionMatches.id, matchId))
      .limit(1);
    if (!row) return null;
    const matches = await this.listMatchDtos(row.competitionId);
    return matches.find((match) => match.id === matchId) ?? null;
  }

  async saveMatchResult(input: Parameters<CompetitionRepository["saveMatchResult"]>[0]) {
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.competitionId}))`);

      const [match] = await tx.select().from(competitionMatches).where(and(
        eq(competitionMatches.id, input.matchId),
        eq(competitionMatches.competitionId, input.competitionId),
      )).limit(1);
      if (!match || !match.homeTeamId || !match.awayTeamId) {
        throw errors.badRequest("MATCH_NOT_READY", "This match does not have two teams.");
      }

      for (const stat of input.playerStats) {
        if (stat.teamId !== match.homeTeamId && stat.teamId !== match.awayTeamId) {
          throw errors.badRequest("STAT_TEAM_MISMATCH", "Player statistics must belong to a team in this match.");
        }
        const [membership] = await tx.select({ userId: teamMemberships.userId }).from(teamMemberships).where(and(
          eq(teamMemberships.teamId, stat.teamId),
          eq(teamMemberships.userId, stat.playerUserId),
          eq(teamMemberships.status, "ACTIVE"),
        )).limit(1);
        if (!membership) {
          throw errors.badRequest("STAT_PLAYER_NOT_ON_TEAM", "A player statistic references someone outside the active roster.");
        }
      }

      const before = {
        status: match.status,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        winnerTeamId: match.winnerTeamId,
      };
      const correction = match.status === "COMPLETED" || match.status === "CORRECTED";

      await tx.delete(playerMatchStats).where(eq(playerMatchStats.matchId, input.matchId));
      if (input.playerStats.length > 0) {
        await tx.insert(playerMatchStats).values(input.playerStats.map((stat) => ({
          matchId: input.matchId,
          playerUserId: stat.playerUserId,
          teamId: stat.teamId,
          appeared: stat.appeared,
          goals: stat.goals,
          assists: stat.assists,
          yellowCards: stat.yellowCards,
          redCards: stat.redCards,
          cleanSheet: stat.cleanSheet,
          playerOfMatch: stat.playerOfMatch,
          updatedAt: input.now,
        })));
      }

      await tx.update(competitionMatches).set({
        status: correction ? "CORRECTED" : "COMPLETED",
        homeScore: input.homeScore,
        awayScore: input.awayScore,
        winnerTeamId: input.winnerTeamId,
        resultEnteredByUserId: input.actorUserId,
        resultEnteredAt: input.now,
        correctionReason: input.correctionReason,
        updatedAt: input.now,
      }).where(eq(competitionMatches.id, input.matchId));

      if (correction) {
        await tx.insert(auditLogs).values({
          actorUserId: input.actorUserId,
          action: "COMPETITION_RESULT_CORRECTED",
          targetType: "competition_match",
          targetId: input.matchId,
          metadata: {
            competitionId: input.competitionId,
            before,
            after: {
              homeScore: input.homeScore,
              awayScore: input.awayScore,
              winnerTeamId: input.winnerTeamId,
            },
            reason: input.correctionReason,
          },
          createdAt: input.now,
        });
      }
    });

    const match = await this.getMatch(input.matchId);
    if (!match) throw new Error("Match could not be loaded after result save.");
    return match;
  }

  async allRequiredMatchesCompleted(competitionId: string) {
    const rows = await this.db.select({ status: competitionMatches.status }).from(competitionMatches)
      .where(eq(competitionMatches.competitionId, competitionId));
    return rows.length > 0 && rows.every((row) => row.status === "COMPLETED" || row.status === "CORRECTED");
  }

  async scheduleMatchAtomic(input: Parameters<CompetitionRepository["scheduleMatchAtomic"]>[0]) {
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.areaId}))`);

      const [area] = await tx.select({ id: venueAreas.id }).from(venueAreas).where(and(
        eq(venueAreas.id, input.areaId),
        eq(venueAreas.venueId, input.venueId),
        eq(venueAreas.active, true),
      )).limit(1);
      if (!area) throw errors.badRequest("AREA_NOT_AVAILABLE", "This playing area is unavailable.");

      const [booking] = await tx.select({ id: bookings.id }).from(bookings).where(and(
        eq(bookings.areaId, input.areaId),
        inArray(bookings.status, ["PENDING", "CONFIRMED"]),
        lt(bookings.startsAt, input.endsAt),
        gt(bookings.endsAt, input.startsAt),
      )).limit(1);
      if (booking) throw errors.conflict("SLOT_UNAVAILABLE", "That time is occupied by a booking.");

      const [block] = await tx.select({ id: venueBlocks.id }).from(venueBlocks).where(and(
        eq(venueBlocks.areaId, input.areaId),
        lt(venueBlocks.startsAt, input.endsAt),
        gt(venueBlocks.endsAt, input.startsAt),
      )).limit(1);
      if (block) throw errors.conflict("SLOT_UNAVAILABLE", "That time is blocked.");

      const [match] = await tx.select({ id: competitionMatches.id }).from(competitionMatches).where(and(
        eq(competitionMatches.areaId, input.areaId),
        ne(competitionMatches.id, input.matchId),
        inArray(competitionMatches.status, ["SCHEDULED", "IN_PROGRESS"]),
        lt(competitionMatches.startsAt, input.endsAt),
        gt(competitionMatches.endsAt, input.startsAt),
      )).limit(1);
      if (match) throw errors.conflict("SLOT_UNAVAILABLE", "That time is occupied by another competition match.");

      const [ownedMatch] = await tx.select({ id: competitionMatches.id }).from(competitionMatches).where(and(
        eq(competitionMatches.id, input.matchId),
        eq(competitionMatches.competitionId, input.competitionId),
      )).limit(1);
      if (!ownedMatch) throw errors.badRequest("MATCH_NOT_FOUND", "Competition match not found.");

      await tx.update(competitionMatches).set({
        venueId: input.venueId,
        areaId: input.areaId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        refereeUserId: input.refereeUserId,
        status: "SCHEDULED",
        updatedAt: input.updatedAt,
      }).where(eq(competitionMatches.id, input.matchId));
    });
  }
}
