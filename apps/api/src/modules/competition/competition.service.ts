import type {
  CompetitionCreateRequest,
  CompetitionInviteTeamRequest,
  CompetitionRegistrationDecisionRequest,
  CompetitionRegistrationResponseRequest,
  CompetitionStateRequest,
  CompetitionTeamRegisterRequest,
  CompetitionUpdateRequest,
} from "@leaguekick/contracts";
import { errors } from "../../lib/errors.js";
import type {
  CompetitionRecord,
  CompetitionRepository,
  CompetitionVenueRecord,
} from "./competition.types.js";

function entitlement(venue: CompetitionVenueRecord, now: Date) {
  const sub = venue.subscription;
  if (!sub) return false;
  if (sub.status === "TRIAL") return Boolean(sub.trialEndsAt && sub.trialEndsAt.getTime() > now.getTime());
  if (sub.status === "ACTIVE") return !sub.activeUntil || sub.activeUntil.getTime() > now.getTime();
  return false;
}

export class CompetitionService {
  constructor(
    private readonly repository: CompetitionRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async ownerVenue(ownerUserId: string) {
    const venue = await this.repository.getOwnerVenue(ownerUserId);
    if (!venue) throw errors.badRequest("VENUE_REQUIRED", "Complete venue setup first.");
    if (venue.status === "SUSPENDED") throw errors.forbidden("VENUE_SUSPENDED", "This venue is suspended.");
    if (!entitlement(venue, this.now())) {
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
    const competition = await this.repository.getCompetitionDto(competitionId);
    if (!competition) throw errors.badRequest("COMPETITION_NOT_FOUND", "Competition not found.");
    return {
      ...competition,
      teams: competition.teams.filter((team) => team.status === "ACCEPTED"),
    };
  }

  async listOwner(ownerUserId: string) {
    await this.ownerVenue(ownerUserId);
    return { competitions: await this.repository.listOwnerCompetitions(ownerUserId) };
  }

  async getOwner(ownerUserId: string, competitionId: string) {
    await this.ownerCompetition(ownerUserId, competitionId);
    const competition = await this.repository.getCompetitionDto(competitionId);
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
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      now: this.now(),
    });
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
      ...(input.startsAt !== undefined ? { startsAt: input.startsAt ? new Date(input.startsAt) : null } : {}),
      ...(input.endsAt !== undefined ? { endsAt: input.endsAt ? new Date(input.endsAt) : null } : {}),
      updatedAt: this.now(),
    });
    if (!updated) throw errors.badRequest("COMPETITION_NOT_FOUND", "Competition not found.");
    return updated;
  }

  async changeState(ownerUserId: string, competitionId: string, input: CompetitionStateRequest) {
    const { competition } = await this.ownerCompetition(ownerUserId, competitionId);
    const now = this.now();

    if (input.action === "OPEN_REGISTRATION") {
      if (competition.status !== "DRAFT" && competition.status !== "REGISTRATION_CLOSED") {
        throw errors.conflict("INVALID_COMPETITION_STATE", "Registration cannot be opened from the current state.");
      }
      return this.repository.setCompetitionState(competitionId, {
        status: "REGISTRATION_OPEN",
        published: true,
        publishedAt: now,
        updatedAt: now,
      });
    }

    if (input.action === "CLOSE_REGISTRATION") {
      if (competition.status !== "REGISTRATION_OPEN") {
        throw errors.conflict("INVALID_COMPETITION_STATE", "Registration is not open.");
      }
      return this.repository.setCompetitionState(competitionId, {
        status: "REGISTRATION_CLOSED",
        updatedAt: now,
      });
    }

    if (input.action === "PUBLISH") {
      if (competition.status === "DRAFT") {
        throw errors.conflict("DRAFT_IS_PRIVATE", "Open registration before publishing this competition.");
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

    if (input.action === "CANCEL") {
      if (competition.status === "COMPLETED" || competition.status === "ARCHIVED") {
        throw errors.conflict("INVALID_COMPETITION_STATE", "This competition can no longer be cancelled.");
      }
      return this.repository.setCompetitionState(competitionId, {
        status: "CANCELLED",
        updatedAt: now,
      });
    }

    throw errors.badRequest("ACTION_NOT_AVAILABLE_YET", "This competition action is handled after fixture generation.");
  }

  async apply(userId: string, competitionId: string, input: CompetitionTeamRegisterRequest) {
    const competition = await this.repository.getCompetitionRecord(competitionId);
    if (!competition || !competition.published || competition.status !== "REGISTRATION_OPEN") {
      throw errors.conflict("REGISTRATION_CLOSED", "Competition registration is not open.");
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
