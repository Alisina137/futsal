import type {
  OwnPlayerProfileDto,
  PublicPlayerProfileDto,
  TeamDto,
  TeamInvitationDto,
  TeamListItemDto,
  TeamMemberRole,
} from "@leaguekick/contracts";

export type TeamIdentityUser = {
  id: string;
  displayName: string;
  username: string | null;
};

export type TeamRecord = {
  id: string;
  name: string;
  logoUrl: string | null;
  city: string;
  managerUserId: string;
  captainUserId: string | null;
  status: "ACTIVE" | "ARCHIVED";
  privacy: "PUBLIC" | "PRIVATE";
  createdAt: Date;
};

export type TeamMembershipRecord = {
  teamId: string;
  userId: string;
  role: TeamMemberRole;
  shirtNumber: number | null;
  status: "ACTIVE" | "REMOVED";
  joinedAt: Date;
  leftAt: Date | null;
};

export interface TeamRepository {
  getUserIdentity(userId: string): Promise<TeamIdentityUser | null>;
  getUserByNormalizedIdentifier(input: { usernameNormalized?: string; phoneE164?: string }): Promise<TeamIdentityUser | null>;

  ensurePlayerProfile(userId: string, fallbackDisplayName: string, now: Date): Promise<OwnPlayerProfileDto>;
  updatePlayerProfile(userId: string, input: {
    publicDisplayName?: string;
    imageUrl?: string | null;
    position?: OwnPlayerProfileDto["position"];
    visibility?: OwnPlayerProfileDto["visibility"];
    updatedAt: Date;
  }): Promise<OwnPlayerProfileDto>;
  getOwnPlayerProfile(userId: string): Promise<OwnPlayerProfileDto | null>;
  getPublicPlayerProfile(userId: string): Promise<PublicPlayerProfileDto | null>;

  createTeam(input: {
    name: string;
    logoUrl: string | null;
    city: string;
    managerUserId: string;
    privacy: "PUBLIC" | "PRIVATE";
    now: Date;
  }): Promise<TeamDto>;
  getTeamRecord(teamId: string): Promise<TeamRecord | null>;
  getTeam(teamId: string, includeRoster: boolean): Promise<TeamDto | null>;
  listUserTeams(userId: string): Promise<TeamListItemDto[]>;
  getMembership(teamId: string, userId: string): Promise<TeamMembershipRecord | null>;
  updateTeam(teamId: string, input: {
    name?: string;
    logoUrl?: string | null;
    city?: string;
    privacy?: "PUBLIC" | "PRIVATE";
    updatedAt: Date;
  }): Promise<TeamDto | null>;
  updateMember(teamId: string, userId: string, input: {
    role?: TeamMemberRole;
    shirtNumber?: number | null;
    status?: "ACTIVE" | "REMOVED";
    leftAt?: Date | null;
    updatedAt: Date;
  }): Promise<void>;
  transferManager(teamId: string, currentManagerUserId: string, nextManagerUserId: string, now: Date): Promise<TeamDto | null>;
  setCaptain(teamId: string, managerUserId: string, captainUserId: string | null, now: Date): Promise<TeamDto | null>;
  removeMember(teamId: string, managerUserId: string, memberUserId: string, now: Date): Promise<TeamDto | null>;

  createInvitation(input: {
    teamId: string;
    invitedUserId: string;
    invitedByUserId: string;
    role: "CAPTAIN" | "PLAYER";
    shirtNumber: number | null;
    expiresAt: Date;
    now: Date;
  }): Promise<TeamInvitationDto>;
  listInvitationsForUser(userId: string, now: Date): Promise<TeamInvitationDto[]>;
  listInvitationsForTeam(teamId: string, now: Date): Promise<TeamInvitationDto[]>;
  acceptInvitation(invitationId: string, invitedUserId: string, now: Date): Promise<TeamInvitationDto | null>;
  declineInvitation(invitationId: string, invitedUserId: string, now: Date): Promise<TeamInvitationDto | null>;
  revokeInvitation(teamId: string, managerUserId: string, invitationId: string, now: Date): Promise<TeamInvitationDto | null>;
}
