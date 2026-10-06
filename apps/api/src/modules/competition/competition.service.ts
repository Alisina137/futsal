import type {
  CompetitionCreateRequest,
  CompetitionFeeUpdateRequest,
  CompetitionInviteTeamRequest,
  CompetitionMediaPostCreateRequest,
  CompetitionMediaPostStatusRequest,
  CompetitionMatchResultRequest,
  CompetitionMatchScheduleRequest,
  CompetitionRegistrationDecisionRequest,
  CompetitionRegistrationResponseRequest,
  CompetitionSeedUpdateRequest,
  CompetitionStateRequest,
  CompetitionTeamRegisterRequest,
  CompetitionUpdateRequest,
} from "@leaguekick/contracts";
import { errors } from "../../lib/errors.js";
import type {
  CompetitionRecord,
  CompetitionRepository,
} from "./competition.types.js";
import {
  assignGroups,
  calculateStandings,
  generateKnockoutPlan,
  generateRoundRobin,
  qualifiedTeams,
} from "./competition.engine.js";
import { hasPremiumWriteAccess } from "../billing/entitlement.js";
import type { NotificationPublisher } from "../notifications/notification.types.js";

const REGISTRATION_MIN_WINDOW_MS = 72 * 60 * 60 * 1000;

export class CompetitionService {
  constructor(
    private readonly repository: CompetitionRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly notifications?: NotificationPublisher,
  ) {}

  private async notifyCompetition(
    competitionId: string,
    title: string,
    body: string,
    dedupeKey: string,
    extraUserIds: string[] = [],
  ) {
    if (!this.notifications) return;
    const followerUserIds = await this.repository.listCompetitionFollowerUserIds(competitionId);
    const userIds = [...new Set([...followerUserIds, ...extraUserIds])];
    if (userIds.length === 0) return;
    try {
      await this.notifications.competitionUpdate({
        competitionId,
        title,
        body,
        userIds,
        dedupeKey,
      });
    } catch {
      // Competition operations must not fail because notification delivery failed.
    }
  }

  private derive(competition: Awaited<ReturnType<CompetitionRepository["getCompetitionDto"]>>) {
    if (!competition) return null;

    const accepted = competition.teams
      .filter((team) => team.status === "ACCEPTED")
      .map((team) => ({ id: team.teamId, name: team.teamName, seed: team.seed }));

    if (competition.format === "LEAGUE") {
      const results = competition.matches
        .filter((match) =>
          match.stage === "LEAGUE" &&
          (match.status === "COMPLETED" || match.status === "CORRECTED") &&
          match.homeTeamId &&
          match.awayTeamId &&
          match.homeScore !== null &&
          match.awayScore !== null
        )
        .map((match) => ({
          homeTeamId: match.homeTeamId!,
          awayTeamId: match.awayTeamId!,
          homeScore: match.homeScore!,
          awayScore: match.awayScore!,
        }));

      return {
        ...competition,
        standings: calculateStandings(
          accepted,
          results,
          { win: competition.winPoints, draw: competition.drawPoints, loss: competition.lossPoints },
          competition.tieBreakOrder,
        ),
      };
    }

    if (competition.format === "GROUP_KNOCKOUT") {
      const groupKeys = [...new Set(
        competition.teams
          .filter((team) => team.status === "ACCEPTED" && team.groupId && team.groupName)
          .map((team) => `${team.groupId}|${team.groupName}`)
      )].sort();

      const standings = groupKeys.flatMap((key) => {
        const [groupId, groupName] = key.split("|") as [string,string];
        const groupTeams = competition.teams
          .filter((team) => team.status === "ACCEPTED" && team.groupId === groupId)
          .map((team) => ({ id: team.teamId, name: team.teamName, seed: team.seed }));
        const results = competition.matches
          .filter((match) =>
            match.stage === "GROUP" &&
            match.groupId === groupId &&
            (match.status === "COMPLETED" || match.status === "CORRECTED") &&
            match.homeTeamId &&
            match.awayTeamId &&
            match.homeScore !== null &&
            match.awayScore !== null
          )
          .map((match) => ({
            homeTeamId: match.homeTeamId!,
            awayTeamId: match.awayTeamId!,
            homeScore: match.homeScore!,
            awayScore: match.awayScore!,
          }));

        return calculateStandings(
          groupTeams,
          results,
          { win: competition.winPoints, draw: competition.drawPoints, loss: competition.lossPoints },
          competition.tieBreakOrder,
        ).map((row) => ({ ...row, groupId, groupName }));
      });

      return { ...competition, standings };
    }

    return { ...competition, standings: [] };
  }

  private async ownerVenue(ownerUserId: string) {
    const venue = await this.repository.getOwnerVenue(ownerUserId);
    if (!venue) throw errors.badRequest("VENUE_REQUIRED", "Complete venue setup first.");
    if (venue.status === "SUSPENDED") throw errors.forbidden("VENUE_SUSPENDED", "This venue is suspended.");
    if (!hasPremiumWriteAccess(venue.subscription, this.now())) {
      throw errors.forbidden("SUBSCRIPTION_REQUIRED", "An active Premium trial or subscription is required.");
    }
    return venue;
  }

  private async ownerCompetition(ownerUserId: string, competitionId: string) {
    const venue = await this.ownerVenue(ownerUserId);
    const competition = await this.repository.getCompetitionRecord(competitionId);
    if (!competition || competition.venueId !== venue.id) {
      throw errors.forbidden("COMPETITION_ACCESS_DENIED", "You cannot manage this competition.");
    }
    return { venue, competition };
  }

  private assertCompetitionSchedule(input: {
    registrationClosesAt: Date | null;
    startsAt: Date | null;
    endsAt: Date | null;
  }) {
    if (
      input.registrationClosesAt
      && input.startsAt
      && input.startsAt.getTime() <= input.registrationClosesAt.getTime()
    ) {
      throw errors.badRequest(
        "COMPETITION_START_BEFORE_REGISTRATION_CLOSE",
        "Competition start must be after the registration deadline.",
      );
    }
    if (input.startsAt && input.endsAt && input.endsAt.getTime() <= input.startsAt.getTime()) {
      throw errors.badRequest(
        "COMPETITION_END_BEFORE_START",
        "Competition end must be after the competition start.",
      );
    }
  }

  private assertRegistrationReleaseWindow(competition: Pick<
    CompetitionRecord,
    "registrationClosesAt" | "startsAt" | "endsAt"
  >, releaseAt: Date) {
    if (!competition.registrationClosesAt) {
      throw errors.badRequest(
        "REGISTRATION_DEADLINE_REQUIRED",
        "Choose a registration deadline before opening registration.",
      );
    }
    if (competition.registrationClosesAt.getTime() < releaseAt.getTime() + REGISTRATION_MIN_WINDOW_MS) {
      throw errors.badRequest(
        "REGISTRATION_WINDOW_TOO_SHORT",
        "Registration must remain open for at least 72 hours after release.",
      );
    }
    this.assertCompetitionSchedule(competition);
  }

  private assertRegistrationMutable(competition: CompetitionRecord) {
    if (!["DRAFT", "REGISTRATION_OPEN", "REGISTRATION_CLOSED"].includes(competition.status)) {
      throw errors.conflict("COMPETITION_ALREADY_SCHEDULED", "Registration can no longer be changed.");
    }
  }

  async listPublic() {
    const competitions = await this.repository.listPublicCompetitions();
    return {
      generatedAt: this.now().toISOString(),
      competitions: competitions.filter((item) => item.status !== "DRAFT" && item.status !== "CANCELLED"),
    };
  }

  async getPublic(competitionId: string) {
    const record = await this.repository.getCompetitionRecord(competitionId);
    if (!record || !record.published || record.status === "DRAFT") {
      throw errors.badRequest("COMPETITION_NOT_FOUND", "Competition not found.");
    }
    const competition = this.derive(await this.repository.getCompetitionDto(competitionId));
    if (!competition) throw errors.badRequest("COMPETITION_NOT_FOUND", "Competition not found.");
    return {
      ...competition,
      teams: competition.teams
        .filter((team) => team.status === "ACCEPTED")
        .map((team) => ({
          ...team,
          feePaymentReference: null,
        })),
    };
  }

  async listOwner(ownerUserId: string) {
    await this.ownerVenue(ownerUserId);
    return { competitions: await this.repository.listOwnerCompetitions(ownerUserId) };
  }

  async getOwner(ownerUserId: string, competitionId: string) {
    await this.ownerCompetition(ownerUserId, competitionId);
    const competition = this.derive(await this.repository.getCompetitionDto(competitionId));
    if (!competition) throw errors.badRequest("COMPETITION_NOT_FOUND", "Competition not found.");
    return competition;
  }

  async create(ownerUserId: string, input: CompetitionCreateRequest) {
    const venue = await this.ownerVenue(ownerUserId);
    if (input.format === "GROUP_KNOCKOUT") {
      const groups = input.groupCount ?? 0;
      const qualifiers = input.qualifiersPerGroup ?? 0;
      if (groups * qualifiers < 2) {
        throw errors.badRequest("INVALID_GROUP_QUALIFICATION", "Group qualification must produce at least two knockout teams.");
      }
      if (groups > input.maxTeams) {
        throw errors.badRequest("INVALID_GROUP_COUNT", "Group count cannot exceed the team limit.");
      }
    }

    this.assertCompetitionSchedule({
      registrationClosesAt: input.registrationClosesAt ? new Date(input.registrationClosesAt) : null,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
    });

    return this.repository.createCompetition({
      venueId: venue.id,
      createdByUserId: ownerUserId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      format: input.format,
      maxTeams: input.maxTeams,
      registrationFeeAfn: input.registrationFeeAfn,
      winPoints: input.winPoints,
      drawPoints: input.drawPoints,
      lossPoints: input.lossPoints,
      tieBreakOrder: input.tieBreakOrder,
      groupCount: input.format === "GROUP_KNOCKOUT" ? input.groupCount ?? null : null,
      qualifiersPerGroup: input.format === "GROUP_KNOCKOUT" ? input.qualifiersPerGroup ?? null : null,
      registrationClosesAt: input.registrationClosesAt ? new Date(input.registrationClosesAt) : null,
      matchDurationMinutes: input.matchDurationMinutes,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      now: this.now(),
    });
  }

  async duplicate(ownerUserId: string, competitionId: string) {
    const { venue, competition } = await this.ownerCompetition(ownerUserId, competitionId);
    const duplicated = await this.repository.createCompetition({
      venueId: venue.id,
      createdByUserId: ownerUserId,
      name: `${competition.name} Copy`.slice(0, 140),
      description: competition.description,
      format: competition.format,
      maxTeams: competition.maxTeams,
      registrationFeeAfn: competition.registrationFeeAfn,
      winPoints: competition.winPoints,
      drawPoints: competition.drawPoints,
      lossPoints: competition.lossPoints,
      tieBreakOrder: competition.tieBreakOrder,
      groupCount: competition.format === "GROUP_KNOCKOUT" ? competition.groupCount : null,
      qualifiersPerGroup: competition.format === "GROUP_KNOCKOUT" ? competition.qualifiersPerGroup : null,
      registrationClosesAt: competition.registrationClosesAt,
      matchDurationMinutes: competition.matchDurationMinutes,
      startsAt: null,
      endsAt: null,
      now: this.now(),
    });
    return duplicated;
  }

  async update(ownerUserId: string, competitionId: string, input: CompetitionUpdateRequest) {
    const { competition } = await this.ownerCompetition(ownerUserId, competitionId);
    if (competition.materialPlayStartedAt || await this.repository.hasCompletedMatch(competitionId)) {
      if (input.format !== undefined && input.format !== competition.format) {
        throw errors.conflict("FORMAT_LOCKED", "Competition format cannot change after material play begins.");
      }
    }

    const nextFormat = input.format ?? competition.format;
    const nextGroupCount = input.groupCount !== undefined ? input.groupCount : competition.groupCount;
    const nextQualifiers = input.qualifiersPerGroup !== undefined ? input.qualifiersPerGroup : competition.qualifiersPerGroup;
    const nextMaxTeams = input.maxTeams ?? competition.maxTeams;
    if (nextFormat === "GROUP_KNOCKOUT") {
      if (!nextGroupCount || !nextQualifiers || nextGroupCount * nextQualifiers < 2 || nextGroupCount > nextMaxTeams) {
        throw errors.badRequest("INVALID_GROUP_CONFIGURATION", "Enter a valid group and qualification configuration.");
      }
    }

    const accepted = await this.repository.countAcceptedTeams(competitionId);
    if (input.maxTeams !== undefined && input.maxTeams < accepted) {
      throw errors.conflict("TEAM_LIMIT_BELOW_ACCEPTED", "Team limit cannot be lower than accepted registrations.");
    }

    const nextRegistrationClosesAt = input.registrationClosesAt !== undefined
      ? (input.registrationClosesAt ? new Date(input.registrationClosesAt) : null)
      : competition.registrationClosesAt;
    const nextStartsAt = input.startsAt !== undefined
      ? (input.startsAt ? new Date(input.startsAt) : null)
      : competition.startsAt;
    const nextEndsAt = input.endsAt !== undefined
      ? (input.endsAt ? new Date(input.endsAt) : null)
      : competition.endsAt;

    this.assertCompetitionSchedule({
      registrationClosesAt: nextRegistrationClosesAt,
      startsAt: nextStartsAt,
      endsAt: nextEndsAt,
    });

    if (competition.status === "REGISTRATION_OPEN") {
      this.assertRegistrationReleaseWindow(
        {
          registrationClosesAt: nextRegistrationClosesAt,
          startsAt: nextStartsAt,
          endsAt: nextEndsAt,
        },
        competition.publishedAt ?? this.now(),
      );
    }

    const updated = await this.repository.updateCompetition(competitionId, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description.trim() || null } : {}),
      ...(input.format !== undefined ? { format: input.format } : {}),
      ...(input.maxTeams !== undefined ? { maxTeams: input.maxTeams } : {}),
      ...(input.registrationFeeAfn !== undefined ? { registrationFeeAfn: input.registrationFeeAfn } : {}),
      ...(input.winPoints !== undefined ? { winPoints: input.winPoints } : {}),
      ...(input.drawPoints !== undefined ? { drawPoints: input.drawPoints } : {}),
      ...(input.lossPoints !== undefined ? { lossPoints: input.lossPoints } : {}),
      ...(input.tieBreakOrder !== undefined ? { tieBreakOrder: input.tieBreakOrder } : {}),
      ...(input.groupCount !== undefined ? { groupCount: nextFormat === "GROUP_KNOCKOUT" ? input.groupCount : null } : {}),
      ...(input.qualifiersPerGroup !== undefined ? { qualifiersPerGroup: nextFormat === "GROUP_KNOCKOUT" ? input.qualifiersPerGroup : null } : {}),
      ...(input.registrationClosesAt !== undefined ? { registrationClosesAt: input.registrationClosesAt ? new Date(input.registrationClosesAt) : null } : {}),
      ...(input.matchDurationMinutes !== undefined ? { matchDurationMinutes: input.matchDurationMinutes } : {}),
      ...(input.startsAt !== undefined ? { startsAt: input.startsAt ? new Date(input.startsAt) : null } : {}),
      ...(input.endsAt !== undefined ? { endsAt: input.endsAt ? new Date(input.endsAt) : null } : {}),
      updatedAt: this.now(),
    });
    if (!updated) throw errors.badRequest("COMPETITION_NOT_FOUND", "Competition not found.");
    return updated;
  }

  async remove(ownerUserId: string, competitionId: string) {
    const { competition } = await this.ownerCompetition(ownerUserId, competitionId);
    if (!["DRAFT", "CANCELLED"].includes(competition.status)) {
      throw errors.conflict("COMPETITION_DELETE_BLOCKED", "Only draft or cancelled competitions can be deleted.");
    }
    if (await this.repository.hasCompletedMatch(competitionId)) {
      throw errors.conflict("COMPETITION_HISTORY_REQUIRED", "A competition with completed matches must be kept for history.");
    }
    const deleted = await this.repository.deleteCompetition(competitionId);
    if (!deleted) throw errors.badRequest("COMPETITION_NOT_FOUND", "Competition not found.");
    return { deleted: true };
  }


  async removeTeam(ownerUserId: string, competitionId: string, teamId: string) {
    const { competition } = await this.ownerCompetition(ownerUserId, competitionId);
    if (!["DRAFT", "REGISTRATION_OPEN", "REGISTRATION_CLOSED"].includes(competition.status)) {
      throw errors.conflict("COMPETITION_TEAM_LOCKED", "Teams cannot be removed after fixtures are generated.");
    }
    if (competition.materialPlayStartedAt || await this.repository.hasCompletedMatch(competitionId)) {
      throw errors.conflict("COMPETITION_TEAM_HISTORY_REQUIRED", "Teams cannot be removed after competition play begins.");
    }
    const registration = await this.repository.getRegistration(competitionId, teamId);
    if (!registration) throw errors.badRequest("REGISTRATION_NOT_FOUND", "Competition team registration not found.");
    await this.repository.removeTeamByOwner({
      competitionId,
      teamId,
      ownerUserId,
      now: this.now(),
    });
    const team = await this.repository.getTeam(teamId);
    if (team) {
      await this.notifyCompetition(
        competitionId,
        competition.name,
        `${team.name} was removed from the competition.`,
        `competition-team-removed:${competitionId}:${teamId}:${this.now().getTime()}`,
        [team.managerUserId],
      );
    }
    return { registration: await this.repository.getRegistration(competitionId, teamId) };
  }

  async updateSeed(
    ownerUserId: string,
    competitionId: string,
    teamId: string,
    input: CompetitionSeedUpdateRequest,
  ) {
    const { competition } = await this.ownerCompetition(ownerUserId, competitionId);
    this.assertRegistrationMutable(competition);
    const registration = await this.repository.getRegistration(competitionId, teamId);
    if (!registration || registration.status !== "ACCEPTED") {
      throw errors.badRequest("ACCEPTED_TEAM_REQUIRED", "Only an accepted competition team can be seeded.");
    }
    await this.repository.decideRegistration({
      competitionId,
      teamId,
      ownerUserId,
      status: "ACCEPTED",
      seed: input.seed,
      now: this.now(),
    });
    return this.repository.getRegistration(competitionId, teamId);
  }

  async updateFee(
    ownerUserId: string,
    competitionId: string,
    teamId: string,
    input: CompetitionFeeUpdateRequest,
  ) {
    await this.ownerCompetition(ownerUserId, competitionId);
    const registration = await this.repository.getRegistration(competitionId, teamId);
    if (!registration) throw errors.badRequest("REGISTRATION_NOT_FOUND", "Competition team registration not found.");

    const next = await this.repository.updateTeamFee({
      competitionId,
      teamId,
      ownerUserId,
      status: input.status,
      paymentReference: input.paymentReference?.trim() || null,
      now: this.now(),
    });
    if (!next) throw errors.badRequest("REGISTRATION_NOT_FOUND", "Competition team registration not found.");

    const team = await this.repository.getTeam(teamId);
    if (team) {
      await this.notifyCompetition(
        competitionId,
        "Competition payment updated",
        `${team.name}: ${input.status.toLowerCase()} fee status.`,
        `competition-fee:${competitionId}:${teamId}:${input.status}`,
        [team.managerUserId],
      );
    }
    return next;
  }

  async listOwnerMedia(ownerUserId: string, competitionId: string) {
    await this.ownerCompetition(ownerUserId, competitionId);
    return { posts: await this.repository.listCompetitionMedia(competitionId, true) };
  }

  async listPublicMedia(competitionId: string) {
    const competition = await this.repository.getCompetitionRecord(competitionId);
    if (!competition || !competition.published || competition.status === "DRAFT") {
      throw errors.badRequest("COMPETITION_NOT_FOUND", "Competition not found.");
    }
    return { posts: await this.repository.listCompetitionMedia(competitionId, false) };
  }

  async createMediaPost(
    ownerUserId: string,
    competitionId: string,
    input: CompetitionMediaPostCreateRequest,
  ) {
    const { competition } = await this.ownerCompetition(ownerUserId, competitionId);
    if (competition.status === "ARCHIVED" || competition.status === "CANCELLED") {
      throw errors.conflict("COMPETITION_MEDIA_LOCKED", "Archived or cancelled competitions cannot publish new media.");
    }
    const post = await this.repository.createCompetitionMediaPost({
      competitionId,
      ownerUserId,
      body: input.body.trim(),
      imageUrl: input.imageUrl?.trim() || null,
      now: this.now(),
    });
    await this.notifyCompetition(
      competitionId,
      competition.name,
      "A competition you follow published a new update.",
      `competition-media:${post.id}`,
    );
    return post;
  }

  async setMediaStatus(
    ownerUserId: string,
    competitionId: string,
    postId: string,
    input: CompetitionMediaPostStatusRequest,
  ) {
    await this.ownerCompetition(ownerUserId, competitionId);
    const post = await this.repository.setCompetitionMediaStatus({
      competitionId,
      postId,
      published: input.published,
      now: this.now(),
    });
    if (!post) throw errors.badRequest("COMPETITION_MEDIA_NOT_FOUND", "Competition media post not found.");
    return post;
  }

  async changeState(ownerUserId: string, competitionId: string, input: CompetitionStateRequest) {
    const { competition } = await this.ownerCompetition(ownerUserId, competitionId);
    const now = this.now();

    if (input.action === "OPEN_REGISTRATION") {
      if (competition.status !== "DRAFT" && competition.status !== "REGISTRATION_CLOSED") {
        throw errors.conflict("INVALID_COMPETITION_STATE", "Registration cannot be opened from the current state.");
      }
      this.assertRegistrationReleaseWindow(competition, now);
      const updated = await this.repository.setCompetitionState(competitionId, {
        status: "REGISTRATION_OPEN",
        published: true,
        publishedAt: now,
        updatedAt: now,
      });
      await this.notifyCompetition(
        competitionId,
        competition.name,
        "Registration is now open.",
        `competition-registration-open:${competitionId}:${now.getTime()}`,
      );
      return updated;
    }

    if (input.action === "CLOSE_REGISTRATION") {
      if (competition.status !== "REGISTRATION_OPEN") {
        throw errors.conflict("INVALID_COMPETITION_STATE", "Registration is not open.");
      }
      const updated = await this.repository.setCompetitionState(competitionId, {
        status: "REGISTRATION_CLOSED",
        updatedAt: now,
      });
      await this.notifyCompetition(
        competitionId,
        competition.name,
        "Registration has closed.",
        `competition-registration-closed:${competitionId}:${now.getTime()}`,
      );
      return updated;
    }

    if (input.action === "PUBLISH") {
      if (competition.status === "DRAFT") {
        throw errors.conflict("DRAFT_IS_PRIVATE", "Open registration before publishing this competition.");
      }
      if (competition.status === "REGISTRATION_OPEN") {
        this.assertRegistrationReleaseWindow(competition, now);
      }
      return this.repository.setCompetitionState(competitionId, {
        published: true,
        publishedAt: now,
        updatedAt: now,
      });
    }

    if (input.action === "UNPUBLISH") {
      if (competition.status === "IN_PROGRESS" || competition.status === "COMPLETED") {
        throw errors.conflict("PUBLIC_HISTORY_REQUIRED", "An active or completed competition cannot be unpublished.");
      }
      return this.repository.setCompetitionState(competitionId, {
        published: false,
        publishedAt: null,
        updatedAt: now,
      });
    }

    if (input.action === "GENERATE_FIXTURES") {
      if (competition.status !== "REGISTRATION_CLOSED") {
        throw errors.conflict("REGISTRATION_MUST_BE_CLOSED", "Close registration before generating fixtures.");
      }
      const accepted = (await this.repository.listCompetitionTeams(competitionId))
        .filter((team) => team.status === "ACCEPTED")
        .sort((a,b) => (a.seed ?? Number.MAX_SAFE_INTEGER) - (b.seed ?? Number.MAX_SAFE_INTEGER) || a.teamId.localeCompare(b.teamId));
      if (accepted.length < 2) {
        throw errors.badRequest("NOT_ENOUGH_TEAMS", "At least two accepted teams are required.");
      }

      if (competition.format === "LEAGUE") {
        await this.repository.replaceLeagueFixtures(
          competitionId,
          generateRoundRobin(accepted.map((team) => team.teamId)),
          now,
        );
      } else if (competition.format === "KNOCKOUT") {
        await this.repository.replaceKnockoutStage(
          competitionId,
          generateKnockoutPlan(accepted.map((team) => ({ id:team.teamId,name:team.teamName,seed:team.seed }))),
          accepted.map((team) => team.teamId),
          now,
        );
      } else {
        const groupCount = competition.groupCount ?? 0;
        if (groupCount < 2 || accepted.length < groupCount) {
          throw errors.badRequest("INVALID_GROUP_CONFIGURATION", "Not enough accepted teams for the configured groups.");
        }
        const assignments = assignGroups(
          accepted.map((team) => ({ id:team.teamId,name:team.teamName,seed:team.seed })),
          groupCount,
        );
        await this.repository.replaceGroupStage(
          competitionId,
          [...assignments.entries()].map(([index,groupTeams]) => ({
            name:String.fromCharCode(65+index),
            sortOrder:index+1,
            teamIds:groupTeams.map((team)=>team.id),
            fixtures:generateRoundRobin(groupTeams.map((team)=>team.id)),
          })),
          now,
        );
      }

      await this.repository.setCompetitionState(competitionId, {
        status: "SCHEDULED",
        updatedAt: now,
      });
      await this.notifyCompetition(
        competitionId,
        competition.name,
        "Fixtures have been generated.",
        `competition-fixtures:${competitionId}:${now.getTime()}`,
      );
      return this.getOwner(ownerUserId, competitionId);
    }

    if (input.action === "GENERATE_KNOCKOUT") {
      if (competition.format !== "GROUP_KNOCKOUT") {
        throw errors.badRequest("FORMAT_NOT_GROUP_KNOCKOUT", "Only group-to-knockout competitions use this action.");
      }
      if (!await this.repository.groupStageCompleted(competitionId)) {
        throw errors.conflict("GROUP_STAGE_INCOMPLETE", "Complete all group-stage matches first.");
      }
      const current = await this.getOwner(ownerUserId, competitionId);
      const grouped = new Map<string, typeof current.standings>();
      for (const row of current.standings) {
        if (!row.groupName) continue;
        const existing = grouped.get(row.groupName) ?? [];
        existing.push(row);
        grouped.set(row.groupName, existing);
      }
      const qualifierIds = qualifiedTeams(grouped, competition.qualifiersPerGroup ?? 1);
      if (qualifierIds.length < 2) {
        throw errors.badRequest("NOT_ENOUGH_QUALIFIERS", "At least two teams must qualify for knockout.");
      }
      const accepted = (await this.repository.listCompetitionTeams(competitionId))
        .filter((team) => team.status === "ACCEPTED" && qualifierIds.includes(team.teamId));
      await this.repository.replaceKnockoutStage(
        competitionId,
        generateKnockoutPlan(qualifierIds.map((teamId) => {
          const team = accepted.find((item)=>item.teamId===teamId)!;
          return { id:team.teamId,name:team.teamName,seed:team.seed };
        })),
        qualifierIds,
        now,
      );
      return this.getOwner(ownerUserId, competitionId);
    }

    if (input.action === "COMPLETE") {
      if (competition.status !== "IN_PROGRESS" && competition.status !== "SCHEDULED") {
        throw errors.conflict("INVALID_COMPETITION_STATE", "This competition is not ready for completion.");
      }
      if (competition.format === "GROUP_KNOCKOUT" && !await this.repository.knockoutCompleted(competitionId)) {
        throw errors.conflict("KNOCKOUT_INCOMPLETE", "Generate and complete the knockout stage before finishing the competition.");
      }
      if (!await this.repository.allRequiredMatchesCompleted(competitionId)) {
        throw errors.conflict("MATCHES_INCOMPLETE", "Complete all required matches before finishing the competition.");
      }
      await this.repository.setCompetitionState(competitionId, {
        status: "COMPLETED",
        completedAt: now,
        updatedAt: now,
      });
      await this.notifyCompetition(
        competitionId,
        competition.name,
        "The competition has been completed.",
        `competition-completed:${competitionId}`,
      );
      return this.getOwner(ownerUserId, competitionId);
    }

    if (input.action === "ARCHIVE") {
      if (competition.status !== "COMPLETED") {
        throw errors.conflict("COMPETITION_NOT_COMPLETED", "Only completed competitions can be archived.");
      }
      await this.repository.setCompetitionState(competitionId, {
        status: "ARCHIVED",
        archivedAt: now,
        updatedAt: now,
      });
      return this.getOwner(ownerUserId, competitionId);
    }

    if (input.action === "CANCEL") {
      if (competition.status === "COMPLETED" || competition.status === "ARCHIVED") {
        throw errors.conflict("INVALID_COMPETITION_STATE", "This competition can no longer be cancelled.");
      }
      const updated = await this.repository.setCompetitionState(competitionId, {
        status: "CANCELLED",
        updatedAt: now,
      });
      await this.notifyCompetition(
        competitionId,
        competition.name,
        "The competition has been cancelled.",
        `competition-cancelled:${competitionId}`,
      );
      return updated;
    }

    throw errors.badRequest("ACTION_NOT_AVAILABLE_YET", "This competition action is handled after fixture generation.");
  }

  async apply(userId: string, competitionId: string, input: CompetitionTeamRegisterRequest) {
    const competition = await this.repository.getCompetitionRecord(competitionId);
    if (!competition || !competition.published || competition.status !== "REGISTRATION_OPEN") {
      throw errors.conflict("REGISTRATION_CLOSED", "Competition registration is not open.");
    }
    if (competition.registrationClosesAt && competition.registrationClosesAt.getTime() <= this.now().getTime()) {
      throw errors.conflict("REGISTRATION_DEADLINE_PASSED", "The competition registration deadline has passed.");
    }
    const team = await this.repository.getTeam(input.teamId);
    if (!team || team.status !== "ACTIVE") throw errors.badRequest("TEAM_NOT_FOUND", "Team not found.");
    if (team.managerUserId !== userId) throw errors.forbidden("TEAM_MANAGER_REQUIRED", "Only the team manager can register this team.");

    const existing = await this.repository.getRegistration(competitionId, input.teamId);
    if (existing && ["APPLIED", "PENDING", "ACCEPTED", "INVITED"].includes(existing.status)) {
      throw errors.conflict("REGISTRATION_EXISTS", "This team already has an active registration record.");
    }

    await this.repository.applyTeam({
      competitionId,
      teamId: input.teamId,
      managerUserId: userId,
      now: this.now(),
    });
    return this.repository.getRegistration(competitionId, input.teamId);
  }

  async inviteTeam(ownerUserId: string, competitionId: string, input: CompetitionInviteTeamRequest) {
    const { competition } = await this.ownerCompetition(ownerUserId, competitionId);
    this.assertRegistrationMutable(competition);
    const team = await this.repository.getTeam(input.teamId);
    if (!team || team.status !== "ACTIVE") throw errors.badRequest("TEAM_NOT_FOUND", "Team not found.");
    const existing = await this.repository.getRegistration(competitionId, input.teamId);
    if (existing && ["INVITED", "APPLIED", "PENDING", "ACCEPTED"].includes(existing.status)) {
      throw errors.conflict("REGISTRATION_EXISTS", "This team already has an active registration record.");
    }
    await this.repository.inviteTeam({
      competitionId,
      teamId: input.teamId,
      ownerUserId,
      seed: input.seed ?? null,
      now: this.now(),
    });
    await this.notifyCompetition(
      competitionId,
      competition.name,
      `${team.name} was invited to the competition.`,
      `competition-invite:${competitionId}:${team.id}`,
      [team.managerUserId],
    );
    return this.repository.getRegistration(competitionId, input.teamId);
  }

  async decideRegistration(
    ownerUserId: string,
    competitionId: string,
    teamId: string,
    input: CompetitionRegistrationDecisionRequest,
  ) {
    const { competition } = await this.ownerCompetition(ownerUserId, competitionId);
    this.assertRegistrationMutable(competition);
    const registration = await this.repository.getRegistration(competitionId, teamId);
    if (!registration || !["APPLIED", "PENDING"].includes(registration.status)) {
      throw errors.badRequest("REGISTRATION_NOT_PENDING", "No pending application exists for this team.");
    }
    if (input.status === "ACCEPTED") {
      const accepted = await this.repository.countAcceptedTeams(competitionId);
      if (accepted >= competition.maxTeams) {
        throw errors.conflict("COMPETITION_FULL", "This competition has reached its team capacity.");
      }
    }
    await this.repository.decideRegistration({
      competitionId,
      teamId,
      ownerUserId,
      status: input.status,
      seed: input.seed ?? registration.seed,
      now: this.now(),
    });
    const team = await this.repository.getTeam(teamId);
    if (team) {
      await this.notifyCompetition(
        competitionId,
        competition.name,
        `${team.name} registration was ${input.status.toLowerCase()}.`,
        `competition-registration:${competitionId}:${teamId}:${input.status}`,
        [team.managerUserId],
      );
    }
    return this.repository.getRegistration(competitionId, teamId);
  }

  async respondInvitation(
    userId: string,
    competitionId: string,
    teamId: string,
    input: CompetitionRegistrationResponseRequest,
  ) {
    const competition = await this.repository.getCompetitionRecord(competitionId);
    if (!competition) throw errors.badRequest("COMPETITION_NOT_FOUND", "Competition not found.");
    this.assertRegistrationMutable(competition);
    const team = await this.repository.getTeam(teamId);
    if (!team || team.managerUserId !== userId) {
      throw errors.forbidden("TEAM_MANAGER_REQUIRED", "Only the team manager can respond to this invitation.");
    }
    const registration = await this.repository.getRegistration(competitionId, teamId);
    if (!registration || registration.status !== "INVITED") {
      throw errors.badRequest("INVITATION_NOT_FOUND", "Competition invitation not found.");
    }
    if (input.status === "ACCEPTED") {
      const accepted = await this.repository.countAcceptedTeams(competitionId);
      if (accepted >= competition.maxTeams) {
        throw errors.conflict("COMPETITION_FULL", "This competition has reached its team capacity.");
      }
    }
    await this.repository.respondToInvitation({
      competitionId,
      teamId,
      managerUserId: userId,
      status: input.status,
      now: this.now(),
    });
    return this.repository.getRegistration(competitionId, teamId);
  }

  async scheduleMatch(
    ownerUserId: string,
    competitionId: string,
    matchId: string,
    input: CompetitionMatchScheduleRequest,
  ) {
    const { venue, competition } = await this.ownerCompetition(ownerUserId, competitionId);
    if (!["SCHEDULED", "IN_PROGRESS"].includes(competition.status)) {
      throw errors.conflict("COMPETITION_NOT_SCHEDULED", "Generate fixtures before scheduling matches.");
    }
    const match = await this.repository.getMatch(matchId);
    if (!match || match.competitionId !== competitionId) {
      throw errors.badRequest("MATCH_NOT_FOUND", "Competition match not found.");
    }
    if (!match.homeTeamId || !match.awayTeamId) {
      throw errors.conflict("MATCH_TEAMS_PENDING", "This match is waiting for its teams.");
    }
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw errors.badRequest("INVALID_MATCH_INTERVAL", "Match end must be after start.");
    }
    if (startsAt.getTime() <= this.now().getTime()) {
      throw errors.badRequest("MATCH_IN_PAST", "Schedule the match in the future.");
    }
    if (input.refereeUserId && !await this.repository.isVenueReferee(venue.id, input.refereeUserId)) {
      throw errors.forbidden("VENUE_REFEREE_REQUIRED", "That user is not an active referee for this venue.");
    }

    await this.repository.scheduleMatchAtomic({
      competitionId,
      matchId,
      venueId: venue.id,
      areaId: input.areaId,
      startsAt,
      endsAt,
      refereeUserId: input.refereeUserId ?? null,
      updatedAt: this.now(),
    });
    const homeTeam = await this.repository.getTeam(match.homeTeamId);
    const awayTeam = await this.repository.getTeam(match.awayTeamId);
    await this.notifyCompetition(
      competitionId,
      competition.name,
      `${match.homeTeamName ?? "Home team"} vs ${match.awayTeamName ?? "Away team"} was scheduled.`,
      `competition-match-scheduled:${matchId}:${startsAt.toISOString()}`,
      [
        ...(homeTeam ? [homeTeam.managerUserId] : []),
        ...(awayTeam ? [awayTeam.managerUserId] : []),
        ...(input.refereeUserId ? [input.refereeUserId] : []),
      ],
    );
    return this.getOwner(ownerUserId, competitionId);
  }

  async enterResult(
    ownerUserId: string,
    competitionId: string,
    matchId: string,
    input: CompetitionMatchResultRequest,
  ) {
    const { competition } = await this.ownerCompetition(ownerUserId, competitionId);
    const match = await this.repository.getMatch(matchId);
    if (!match || match.competitionId !== competitionId) {
      throw errors.badRequest("MATCH_NOT_FOUND", "Competition match not found.");
    }
    if (!["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CORRECTED"].includes(match.status)) {
      throw errors.conflict("MATCH_NOT_READY", "Schedule this match before entering its result.");
    }
    if (!match.homeTeamId || !match.awayTeamId) {
      throw errors.conflict("MATCH_TEAMS_PENDING", "This match is waiting for its teams.");
    }
    if (match.stage === "KNOCKOUT" && input.homeScore === input.awayScore) {
      throw errors.badRequest("KNOCKOUT_DRAW_NOT_ALLOWED", "A knockout match requires a winner.");
    }

    const correction = match.status === "COMPLETED" || match.status === "CORRECTED";
    const confirmImpact = input.confirmImpact;
    const playerStats = input.playerStats;
    if (correction && !input.correctionReason?.trim()) {
      throw errors.badRequest("CORRECTION_REASON_REQUIRED", "Explain why the completed result is being corrected.");
    }
    if (playerStats.filter((stat) => stat.playerOfMatch).length > 1) {
      throw errors.badRequest("MULTIPLE_PLAYERS_OF_MATCH", "Only one player can be player of the match.");
    }

    const winnerTeamId =
      input.homeScore === input.awayScore
        ? null
        : input.homeScore > input.awayScore
          ? match.homeTeamId
          : match.awayTeamId;

    if (correction && match.stage === "KNOCKOUT" && match.winnerTeamId !== winnerTeamId && match.nextMatchId) {
      const downstream = await this.repository.getMatch(match.nextMatchId);
      if (downstream && ["IN_PROGRESS","COMPLETED","CORRECTED"].includes(downstream.status)) {
        throw errors.conflict("DOWNSTREAM_RESULT_LOCKED", "A later knockout match has already started or finished.");
      }
      if (downstream?.status === "SCHEDULED" && !confirmImpact) {
        throw errors.conflict("IMPACT_CONFIRMATION_REQUIRED", "Confirm the impact before changing a winner used by a scheduled next-round match.");
      }
    }

    const knockoutAlreadyStarted = match.stage === "GROUP"
      ? await this.repository.knockoutStarted(competitionId)
      : false;
    if (correction && match.stage === "GROUP" && knockoutAlreadyStarted && !confirmImpact) {
      throw errors.conflict(
        "GROUP_CORRECTION_IMPACT_CONFIRMATION_REQUIRED",
        "Knockout play has started. Confirm the impact before correcting a group result.",
      );
    }

    const before = await this.getOwner(ownerUserId, competitionId);
    const hadKnockoutSnapshot = before.matches.some((item)=>item.stage==="KNOCKOUT");

    const now = this.now();
    const saved = await this.repository.saveMatchResult({
      competitionId,
      matchId,
      actorUserId: ownerUserId,
      homeScore: input.homeScore,
      awayScore: input.awayScore,
      winnerTeamId,
      correctionReason: input.correctionReason?.trim() || null,
      playerStats,
      now,
    });

    if (match.stage === "KNOCKOUT" && winnerTeamId) {
      await this.repository.replaceKnockoutParticipant(matchId, winnerTeamId, now);
    }

    if (correction && match.stage === "GROUP" && hadKnockoutSnapshot && !knockoutAlreadyStarted) {
      const recalculated = await this.getOwner(ownerUserId, competitionId);
      const grouped = new Map<string, typeof recalculated.standings>();
      for (const row of recalculated.standings) {
        if (!row.groupName) continue;
        const list = grouped.get(row.groupName) ?? [];
        list.push(row);
        grouped.set(row.groupName,list);
      }
      const qualifierIds = qualifiedTeams(grouped, competition.qualifiersPerGroup ?? 1);
      const accepted = (await this.repository.listCompetitionTeams(competitionId))
        .filter((team)=>team.status==="ACCEPTED"&&qualifierIds.includes(team.teamId));
      await this.repository.replaceKnockoutStage(
        competitionId,
        generateKnockoutPlan(qualifierIds.map((teamId)=>{
          const team=accepted.find((item)=>item.teamId===teamId)!;
          return {id:team.teamId,name:team.teamName,seed:team.seed};
        })),
        qualifierIds,
        now,
      );
    }

    if (!competition.materialPlayStartedAt || competition.status === "SCHEDULED") {
      await this.repository.setCompetitionState(competitionId, {
        status: "IN_PROGRESS",
        materialPlayStartedAt: competition.materialPlayStartedAt ?? now,
        updatedAt: now,
      });
    }

    const homeTeam = await this.repository.getTeam(match.homeTeamId);
    const awayTeam = await this.repository.getTeam(match.awayTeamId);
    await this.notifyCompetition(
      competitionId,
      competition.name,
      `${match.homeTeamName ?? "Home team"} ${input.homeScore} - ${input.awayScore} ${match.awayTeamName ?? "Away team"}.`,
      `competition-match-result:${matchId}:${saved.status}:${now.getTime()}`,
      [
        ...(homeTeam ? [homeTeam.managerUserId] : []),
        ...(awayTeam ? [awayTeam.managerUserId] : []),
        ...(match.refereeUserId ? [match.refereeUserId] : []),
      ],
    );

    return {
      match: saved,
      competition: await this.getOwner(ownerUserId, competitionId),
    };
  }

  async withdraw(userId: string, competitionId: string, teamId: string) {
    const competition = await this.repository.getCompetitionRecord(competitionId);
    if (!competition) throw errors.badRequest("COMPETITION_NOT_FOUND", "Competition not found.");
    this.assertRegistrationMutable(competition);
    const team = await this.repository.getTeam(teamId);
    if (!team || team.managerUserId !== userId) {
      throw errors.forbidden("TEAM_MANAGER_REQUIRED", "Only the team manager can withdraw this team.");
    }
    const registration = await this.repository.getRegistration(competitionId, teamId);
    if (!registration || !["APPLIED", "ACCEPTED", "INVITED"].includes(registration.status)) {
      throw errors.badRequest("REGISTRATION_NOT_FOUND", "Active competition registration not found.");
    }
    await this.repository.withdrawTeam({ competitionId, teamId, managerUserId: userId, now: this.now() });
    return this.repository.getRegistration(competitionId, teamId);
  }
}
