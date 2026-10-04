import { randomUUID } from "node:crypto";
import type {
  OwnPlayerProfileDto,
  PublicPlayerProfileDto,
  TeamDto,
  TeamListItemDto,
  TeamMemberRole,
} from "@leaguekick/contracts";
import type {
  TeamIdentityUser,
  TeamMembershipRecord,
  TeamRecord,
  TeamRepository,
} from "../src/modules/team/team.types.js";

export class FakeTeamRepository implements TeamRepository {
  users = new Map<string, TeamIdentityUser & { usernameNormalized: string | null; phoneE164: string }>();
  profiles = new Map<string, OwnPlayerProfileDto>();
  teams = new Map<string, TeamRecord>();
  memberships = new Map<string, TeamMembershipRecord>();

  seedUser(input: { id: string; displayName: string; username?: string | null; phoneE164: string }) {
    this.users.set(input.id, {
      id: input.id,
      displayName: input.displayName,
      username: input.username ?? null,
      usernameNormalized: input.username?.toLowerCase() ?? null,
      phoneE164: input.phoneE164,
    });
  }

  private membershipKey(teamId: string, userId: string) {
    return `${teamId}:${userId}`;
  }

  async getUserIdentity(userId: string) {
    const user = this.users.get(userId);
    return user ? { id: user.id, displayName: user.displayName, username: user.username } : null;
  }

  async getUserByNormalizedIdentifier(input: { usernameNormalized?: string; phoneE164?: string }) {
    const user = [...this.users.values()].find((item) =>
      (input.usernameNormalized && item.usernameNormalized === input.usernameNormalized) ||
      (input.phoneE164 && item.phoneE164 === input.phoneE164)
    );
    return user ? { id: user.id, displayName: user.displayName, username: user.username } : null;
  }

  private playerTeams(userId: string, publicOnly: boolean) {
    const result: OwnPlayerProfileDto["teams"] = [];
    for (const membership of this.memberships.values()) {
      if (membership.userId !== userId || membership.status !== "ACTIVE") continue;
      const team = this.teams.get(membership.teamId);
      if (!team || team.status !== "ACTIVE" || (publicOnly && team.privacy !== "PUBLIC")) continue;
      result.push({
        id: team.id,
        name: team.name,
        logoUrl: team.logoUrl,
        city: team.city,
        role: membership.role,
      });
    }
    return result;
  }

  async ensurePlayerProfile(userId: string, fallbackDisplayName: string, _now: Date) {
    let profile = this.profiles.get(userId);
    if (!profile) {
      profile = {
        userId,
        publicDisplayName: fallbackDisplayName,
        imageUrl: null,
        position: "UNSPECIFIED",
        visibility: "PUBLIC",
        teams: [],
      };
      this.profiles.set(userId, profile);
    }
    const next = { ...profile, teams: this.playerTeams(userId, false) };
    this.profiles.set(userId, next);
    return next;
  }

  async updatePlayerProfile(userId: string, input: {
    publicDisplayName?: string;
    imageUrl?: string | null;
    position?: OwnPlayerProfileDto["position"];
    visibility?: OwnPlayerProfileDto["visibility"];
    updatedAt: Date;
  }) {
    const current = this.profiles.get(userId);
    if (!current) throw new Error("profile missing");
    const next: OwnPlayerProfileDto = {
      ...current,
      ...(input.publicDisplayName !== undefined ? { publicDisplayName: input.publicDisplayName } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      ...(input.position !== undefined ? { position: input.position } : {}),
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
      teams: this.playerTeams(userId, false),
    };
    this.profiles.set(userId, next);
    return next;
  }

  async getOwnPlayerProfile(userId: string) {
    const user = this.users.get(userId);
    if (!user) return null;
    const profile = this.profiles.get(userId);
    return {
      userId,
      publicDisplayName: profile?.publicDisplayName ?? user.displayName,
      imageUrl: profile?.imageUrl ?? null,
      position: profile?.position ?? "UNSPECIFIED",
      visibility: profile?.visibility ?? "PUBLIC",
      teams: this.playerTeams(userId, false),
    };
  }

  async getPublicPlayerProfile(userId: string): Promise<PublicPlayerProfileDto | null> {
    const own = await this.getOwnPlayerProfile(userId);
    if (!own || own.visibility !== "PUBLIC") return null;
    return {
      userId,
      publicDisplayName: own.publicDisplayName,
      imageUrl: own.imageUrl,
      position: own.position,
      teams: this.playerTeams(userId, true),
    };
  }

  private members(teamId: string): TeamDto["members"] {
    return [...this.memberships.values()]
      .filter((membership) => membership.teamId === teamId && membership.status === "ACTIVE")
      .map((membership) => {
        const user = this.users.get(membership.userId)!;
        const profile = this.profiles.get(membership.userId);
        return {
          userId: membership.userId,
          publicDisplayName: profile?.publicDisplayName ?? user.displayName,
          imageUrl: profile?.imageUrl ?? null,
          position: profile?.position ?? "UNSPECIFIED",
          role: membership.role,
          shirtNumber: membership.shirtNumber,
          joinedAt: membership.joinedAt.toISOString(),
        };
      });
  }

  async createTeam(input: {
    name: string;
    logoUrl: string | null;
    city: string;
    managerUserId: string;
    privacy: "PUBLIC" | "PRIVATE";
    now: Date;
  }) {
    const id = randomUUID();
    this.teams.set(id, {
      id,
      name: input.name,
      logoUrl: input.logoUrl,
      city: input.city,
      managerUserId: input.managerUserId,
      captainUserId: null,
      status: "ACTIVE",
      privacy: input.privacy,
      createdAt: input.now,
    });
    this.memberships.set(this.membershipKey(id, input.managerUserId), {
      teamId: id,
      userId: input.managerUserId,
      role: "MANAGER",
      shirtNumber: null,
      status: "ACTIVE",
      joinedAt: input.now,
      leftAt: null,
    });
    return (await this.getTeam(id, true))!;
  }

  async getTeamRecord(teamId: string) {
    return this.teams.get(teamId) ?? null;
  }

  async getTeam(teamId: string, includeRoster: boolean) {
    const team = this.teams.get(teamId);
    if (!team) return null;
    const members = this.members(teamId);
    return {
      id: team.id,
      name: team.name,
      logoUrl: team.logoUrl,
      city: team.city,
      status: team.status,
      privacy: team.privacy,
      managerUserId: team.managerUserId,
      captainUserId: team.captainUserId,
      rosterCount: members.length,
      members: includeRoster ? members : [],
      createdAt: team.createdAt.toISOString(),
    };
  }

  async listUserTeams(userId: string): Promise<TeamListItemDto[]> {
    const result: TeamListItemDto[] = [];
    for (const membership of this.memberships.values()) {
      if (membership.userId !== userId || membership.status !== "ACTIVE") continue;
      const team = await this.getTeam(membership.teamId, false);
      if (!team || team.status !== "ACTIVE") continue;
      const { members: _members, ...summary } = team;
      result.push(summary);
    }
    return result;
  }

  async getMembership(teamId: string, userId: string) {
    return this.memberships.get(this.membershipKey(teamId, userId)) ?? null;
  }

  async updateTeam(teamId: string, input: {
    name?: string;
    logoUrl?: string | null;
    city?: string;
    privacy?: "PUBLIC" | "PRIVATE";
    updatedAt: Date;
  }) {
    const team = this.teams.get(teamId);
    if (!team) return null;
    this.teams.set(teamId, {
      ...team,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.privacy !== undefined ? { privacy: input.privacy } : {}),
    });
    return this.getTeam(teamId, true);
  }

  async updateMember(teamId: string, userId: string, input: {
    role?: TeamMemberRole;
    shirtNumber?: number | null;
    status?: "ACTIVE" | "REMOVED";
    leftAt?: Date | null;
    updatedAt: Date;
  }) {
    const key = this.membershipKey(teamId, userId);
    const membership = this.memberships.get(key);
    if (!membership) return;
    this.memberships.set(key, {
      ...membership,
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.shirtNumber !== undefined ? { shirtNumber: input.shirtNumber } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.leftAt !== undefined ? { leftAt: input.leftAt } : {}),
    });
  }

  async transferManager(teamId: string, currentManagerUserId: string, nextManagerUserId: string, _now: Date) {
    const team = this.teams.get(teamId);
    const next = this.memberships.get(this.membershipKey(teamId, nextManagerUserId));
    if (!team || team.managerUserId !== currentManagerUserId || next?.status !== "ACTIVE") return null;
    team.managerUserId = nextManagerUserId;
    this.teams.set(teamId, team);
    await this.updateMember(teamId, nextManagerUserId, { role: "MANAGER", updatedAt: new Date() });
    await this.updateMember(teamId, currentManagerUserId, {
      role: team.captainUserId === currentManagerUserId ? "CAPTAIN" : "PLAYER",
      updatedAt: new Date(),
    });
    return this.getTeam(teamId, true);
  }

  async setCaptain(teamId: string, managerUserId: string, captainUserId: string | null, _now: Date) {
    const team = this.teams.get(teamId);
    if (!team || team.managerUserId !== managerUserId) return null;
    if (captainUserId) {
      const membership = this.memberships.get(this.membershipKey(teamId, captainUserId));
      if (membership?.status !== "ACTIVE") return null;
    }
    if (team.captainUserId && team.captainUserId !== team.managerUserId) {
      await this.updateMember(teamId, team.captainUserId, { role: "PLAYER", updatedAt: new Date() });
    }
    team.captainUserId = captainUserId;
    this.teams.set(teamId, team);
    if (captainUserId && captainUserId !== managerUserId) {
      await this.updateMember(teamId, captainUserId, { role: "CAPTAIN", updatedAt: new Date() });
    }
    return this.getTeam(teamId, true);
  }

  async removeMember(teamId: string, managerUserId: string, memberUserId: string, now: Date) {
    const team = this.teams.get(teamId);
    const membership = this.memberships.get(this.membershipKey(teamId, memberUserId));
    if (!team || team.managerUserId !== managerUserId || memberUserId === managerUserId || membership?.status !== "ACTIVE") return null;
    if (team.captainUserId === memberUserId) team.captainUserId = null;
    this.teams.set(teamId, team);
    await this.updateMember(teamId, memberUserId, { status: "REMOVED", leftAt: now, updatedAt: now });
    return this.getTeam(teamId, true);
  }
}
