import type {
  OwnPlayerProfileDto,
  PlayerProfileUpdateRequest,
  PublicPlayerProfileDto,
  TeamCaptainRequest,
  TeamCreateRequest,
  TeamDto,
  TeamInviteRequest,
  TeamManagerTransferRequest,
  TeamMemberUpdateRequest,
  TeamUpdateRequest,
} from "@leaguekick/contracts";
import { normalizeAfghanistanPhone, normalizeUsername } from "@leaguekick/contracts";
import { errors } from "../../lib/errors.js";
import type { NotificationPublisher } from "../notifications/notification.types.js";
import type { TeamRepository } from "./team.types.js";

export class TeamService {
  constructor(
    private readonly repository: TeamRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly notifications?: NotificationPublisher,
  ) {}

  private async identity(userId: string) {
    const user = await this.repository.getUserIdentity(userId);
    if (!user) throw errors.unauthorized("ACCOUNT_UNAVAILABLE", "This account is unavailable.");
    return user;
  }

  private async team(teamId: string) {
    const team = await this.repository.getTeamRecord(teamId);
    if (!team || team.status !== "ACTIVE") throw errors.badRequest("TEAM_NOT_FOUND", "Team not found.");
    return team;
  }

  private async manager(teamId: string, userId: string) {
    const team = await this.team(teamId);
    if (team.managerUserId !== userId) {
      throw errors.forbidden("TEAM_MANAGER_REQUIRED", "Only this team's manager can perform that action.");
    }
    return team;
  }

  async getOwnProfile(userId: string): Promise<OwnPlayerProfileDto> {
    const user = await this.identity(userId);
    return this.repository.ensurePlayerProfile(userId, user.displayName, this.now());
  }

  async updateOwnProfile(userId: string, input: PlayerProfileUpdateRequest): Promise<OwnPlayerProfileDto> {
    const user = await this.identity(userId);
    await this.repository.ensurePlayerProfile(userId, user.displayName, this.now());
    return this.repository.updatePlayerProfile(userId, {
      ...(input.publicDisplayName !== undefined ? { publicDisplayName: input.publicDisplayName.trim() } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl.trim() || null } : {}),
      ...(input.position !== undefined ? { position: input.position } : {}),
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
      updatedAt: this.now(),
    });
  }

  async getPublicPlayer(playerId: string): Promise<PublicPlayerProfileDto> {
    const profile = await this.repository.getPublicPlayerProfile(playerId);
    if (!profile) throw errors.badRequest("PLAYER_PROFILE_NOT_PUBLIC", "This player profile is not public.");
    return profile;
  }

  async createTeam(userId: string, input: TeamCreateRequest): Promise<TeamDto> {
    const user = await this.identity(userId);
    await this.repository.ensurePlayerProfile(userId, user.displayName, this.now());
    return this.repository.createTeam({
      name: input.name.trim(),
      city: input.city.trim(),
      logoUrl: input.logoUrl?.trim() || null,
      privacy: input.privacy,
      managerUserId: userId,
      now: this.now(),
    });
  }

  async getPublicTeam(teamId: string): Promise<TeamDto> {
    const team = await this.team(teamId);
    const dto = await this.repository.getTeam(teamId, team.privacy === "PUBLIC");
    if (!dto) throw errors.badRequest("TEAM_NOT_FOUND", "Team not found.");
    return dto;
  }

  async listMyTeams(userId: string) {
    await this.identity(userId);
    return { teams: await this.repository.listUserTeams(userId) };
  }

  async getRoster(userId: string, teamId: string): Promise<TeamDto> {
    await this.identity(userId);
    const membership = await this.repository.getMembership(teamId, userId);
    if (!membership || membership.status !== "ACTIVE") {
      throw errors.forbidden("TEAM_MEMBER_REQUIRED", "Only active team members can view this roster.");
    }
    const team = await this.repository.getTeam(teamId, true);
    if (!team || team.status !== "ACTIVE") throw errors.badRequest("TEAM_NOT_FOUND", "Team not found.");
    return team;
  }

  async updateTeam(userId: string, teamId: string, input: TeamUpdateRequest) {
    await this.manager(teamId, userId);
    const updated = await this.repository.updateTeam(teamId, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.city !== undefined ? { city: input.city.trim() } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl.trim() || null } : {}),
      ...(input.privacy !== undefined ? { privacy: input.privacy } : {}),
      updatedAt: this.now(),
    });
    if (!updated) throw errors.badRequest("TEAM_NOT_FOUND", "Team not found.");
    return updated;
  }

  async updateMember(userId: string, teamId: string, memberUserId: string, input: TeamMemberUpdateRequest) {
    await this.manager(teamId, userId);
    const membership = await this.repository.getMembership(teamId, memberUserId);
    if (!membership || membership.status !== "ACTIVE") {
      throw errors.badRequest("TEAM_MEMBER_NOT_FOUND", "That user is not an active member of this team.");
    }
    await this.repository.updateMember(teamId, memberUserId, {
      ...(input.shirtNumber !== undefined ? { shirtNumber: input.shirtNumber } : {}),
      updatedAt: this.now(),
    });
    return this.getRoster(userId, teamId);
  }

  async setCaptain(userId: string, teamId: string, input: TeamCaptainRequest) {
    await this.manager(teamId, userId);
    if (input.userId) {
      const membership = await this.repository.getMembership(teamId, input.userId);
      if (!membership || membership.status !== "ACTIVE") {
        throw errors.badRequest("CAPTAIN_MUST_BE_MEMBER", "The captain must be an active team member.");
      }
    }
    const team = await this.repository.setCaptain(teamId, userId, input.userId, this.now());
    if (!team) throw errors.conflict("TEAM_CHANGED", "The team changed. Refresh and try again.");
    return team;
  }

  async transferManager(userId: string, teamId: string, input: TeamManagerTransferRequest) {
    await this.manager(teamId, userId);
    if (input.userId === userId) return this.getRoster(userId, teamId);
    const membership = await this.repository.getMembership(teamId, input.userId);
    if (!membership || membership.status !== "ACTIVE") {
      throw errors.badRequest("MANAGER_MUST_BE_MEMBER", "The new manager must be an active team member.");
    }
    const team = await this.repository.transferManager(teamId, userId, input.userId, this.now());
    if (!team) throw errors.conflict("TEAM_CHANGED", "The team changed. Refresh and try again.");
    return team;
  }

  async removeMember(userId: string, teamId: string, memberUserId: string) {
    await this.manager(teamId, userId);
    if (memberUserId === userId) {
      throw errors.badRequest("MANAGER_CANNOT_REMOVE_SELF", "Transfer team management before leaving the team.");
    }
    const team = await this.repository.removeMember(teamId, userId, memberUserId, this.now());
    if (!team) throw errors.badRequest("TEAM_MEMBER_NOT_FOUND", "That active team member was not found.");
    return team;
  }

  async createInvitation(userId: string, teamId: string, input: TeamInviteRequest) {
    const team = await this.manager(teamId, userId);
    const target = await this.resolveInviteTarget(input.identifier);
    if (!target) {
      throw errors.badRequest("INVITEE_NOT_FOUND", "No active user matches that username or phone number.");
    }
    if (target.id === userId) {
      throw errors.badRequest("CANNOT_INVITE_SELF", "You are already the manager of this team.");
    }

    const existingMembership = await this.repository.getMembership(teamId, target.id);
    if (existingMembership?.status === "ACTIVE") {
      throw errors.conflict("ALREADY_TEAM_MEMBER", "That player is already an active member of this team.");
    }

    const now = this.now();
    const invitation = await this.repository.createInvitation({
      teamId,
      invitedUserId: target.id,
      invitedByUserId: userId,
      role: input.role,
      shirtNumber: input.shirtNumber ?? null,
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      now,
    });

    try {
      await this.notifications?.teamInvitation({
        userId: target.id,
        invitationId: invitation.id,
        teamId,
        teamName: team.name,
      });
    } catch {
      // Invitation remains authoritative even if notification persistence/delivery fails.
    }

    return invitation;
  }

  async listMyInvitations(userId: string) {
    await this.identity(userId);
    return { invitations: await this.repository.listInvitationsForUser(userId, this.now()) };
  }

  async listTeamInvitations(userId: string, teamId: string) {
    await this.manager(teamId, userId);
    return { invitations: await this.repository.listInvitationsForTeam(teamId, this.now()) };
  }

  async acceptInvitation(userId: string, invitationId: string) {
    const user = await this.identity(userId);
    await this.repository.ensurePlayerProfile(userId, user.displayName, this.now());
    const invitation = await this.repository.acceptInvitation(invitationId, userId, this.now());
    if (!invitation) {
      throw errors.conflict("INVITATION_UNAVAILABLE", "This invitation is no longer available.");
    }
    return invitation;
  }

  async declineInvitation(userId: string, invitationId: string) {
    await this.identity(userId);
    const invitation = await this.repository.declineInvitation(invitationId, userId, this.now());
    if (!invitation) {
      throw errors.conflict("INVITATION_UNAVAILABLE", "This invitation is no longer available.");
    }
    return invitation;
  }

  async revokeInvitation(userId: string, teamId: string, invitationId: string) {
    await this.manager(teamId, userId);
    const invitation = await this.repository.revokeInvitation(teamId, userId, invitationId, this.now());
    if (!invitation) {
      throw errors.badRequest("INVITATION_NOT_FOUND", "Pending invitation not found.");
    }
    return invitation;
  }

  async resolveInviteTarget(identifier: string) {
    const usernameNormalized = normalizeUsername(identifier);
    let phoneE164: string | undefined;
    try {
      phoneE164 = normalizeAfghanistanPhone(identifier);
    } catch {
      // Identifier can be a username.
    }
    return this.repository.getUserByNormalizedIdentifier({
      ...(usernameNormalized ? { usernameNormalized } : {}),
      ...(phoneE164 ? { phoneE164 } : {}),
    });
  }
}
