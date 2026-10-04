import type {
  OwnPlayerProfileDto,
  PublicPlayerProfileDto,
  TeamDto,
  TeamListItemDto,
  TeamMemberDto,
  TeamMemberRole,
} from "@leaguekick/contracts";
import type { Database } from "@leaguekick/database";
import {
  playerProfiles,
  teamMemberships,
  teams,
  users,
} from "@leaguekick/database";
import { and, count, eq, or, sql } from "drizzle-orm";
import type {
  TeamIdentityUser,
  TeamMembershipRecord,
  TeamRecord,
  TeamRepository,
} from "./team.types.js";

function teamRecord(row: typeof teams.$inferSelect): TeamRecord {
  return {
    id: row.id,
    name: row.name,
    logoUrl: row.logoUrl,
    city: row.city,
    managerUserId: row.managerUserId,
    captainUserId: row.captainUserId,
    status: row.status,
    privacy: row.privacy,
    createdAt: row.createdAt,
  };
}

export class DrizzleTeamRepository implements TeamRepository {
  constructor(private readonly db: Database) {}

  async getUserIdentity(userId: string): Promise<TeamIdentityUser | null> {
    const [row] = await this.db.select({
      id: users.id,
      displayName: users.displayName,
      username: users.username,
    }).from(users).where(and(eq(users.id, userId), eq(users.status, "ACTIVE"))).limit(1);
    return row ?? null;
  }

  async getUserByNormalizedIdentifier(input: { usernameNormalized?: string; phoneE164?: string }) {
    const conditions = [
      input.usernameNormalized ? eq(users.usernameNormalized, input.usernameNormalized) : null,
      input.phoneE164 ? eq(users.phoneE164, input.phoneE164) : null,
    ].filter((value): value is NonNullable<typeof value> => value !== null);

    if (conditions.length === 0) return null;

    const [row] = await this.db.select({
      id: users.id,
      displayName: users.displayName,
      username: users.username,
    }).from(users).where(and(
      eq(users.status, "ACTIVE"),
      conditions.length === 1 ? conditions[0]! : or(...conditions),
    )).limit(1);
    return row ?? null;
  }

  private async listPlayerTeams(userId: string, publicOnly: boolean): Promise<OwnPlayerProfileDto["teams"]> {
    const condition = and(
      eq(teamMemberships.userId, userId),
      eq(teamMemberships.status, "ACTIVE"),
      eq(teams.status, "ACTIVE"),
      ...(publicOnly ? [eq(teams.privacy, "PUBLIC")] : []),
    );
    const rows = await this.db.select({
      id: teams.id,
      name: teams.name,
      logoUrl: teams.logoUrl,
      city: teams.city,
      role: teamMemberships.role,
    }).from(teamMemberships)
      .innerJoin(teams, eq(teamMemberships.teamId, teams.id))
      .where(condition);

    return rows;
  }

  async ensurePlayerProfile(userId: string, fallbackDisplayName: string, now: Date): Promise<OwnPlayerProfileDto> {
    await this.db.insert(playerProfiles).values({
      userId,
      publicDisplayName: fallbackDisplayName,
      position: "UNSPECIFIED",
      visibility: "PUBLIC",
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    const profile = await this.getOwnPlayerProfile(userId);
    if (!profile) throw new Error("Player profile could not be loaded.");
    return profile;
  }

  async updatePlayerProfile(userId: string, input: {
    publicDisplayName?: string;
    imageUrl?: string | null;
    position?: OwnPlayerProfileDto["position"];
    visibility?: OwnPlayerProfileDto["visibility"];
    updatedAt: Date;
  }): Promise<OwnPlayerProfileDto> {
    const patch: Partial<typeof playerProfiles.$inferInsert> = { updatedAt: input.updatedAt };
    if (input.publicDisplayName !== undefined) patch.publicDisplayName = input.publicDisplayName;
    if (input.imageUrl !== undefined) patch.imageUrl = input.imageUrl;
    if (input.position !== undefined) patch.position = input.position;
    if (input.visibility !== undefined) patch.visibility = input.visibility;

    await this.db.update(playerProfiles).set(patch).where(eq(playerProfiles.userId, userId));
    const profile = await this.getOwnPlayerProfile(userId);
    if (!profile) throw new Error("Player profile could not be loaded.");
    return profile;
  }

  async getOwnPlayerProfile(userId: string): Promise<OwnPlayerProfileDto | null> {
    const [row] = await this.db.select({
      userId: users.id,
      fallbackDisplayName: users.displayName,
      publicDisplayName: playerProfiles.publicDisplayName,
      imageUrl: playerProfiles.imageUrl,
      position: playerProfiles.position,
      visibility: playerProfiles.visibility,
    }).from(users)
      .leftJoin(playerProfiles, eq(playerProfiles.userId, users.id))
      .where(and(eq(users.id, userId), eq(users.status, "ACTIVE")))
      .limit(1);

    if (!row) return null;

    return {
      userId: row.userId,
      publicDisplayName: row.publicDisplayName ?? row.fallbackDisplayName,
      imageUrl: row.imageUrl ?? null,
      position: row.position ?? "UNSPECIFIED",
      visibility: row.visibility ?? "PUBLIC",
      teams: await this.listPlayerTeams(userId, false),
    };
  }

  async getPublicPlayerProfile(userId: string): Promise<PublicPlayerProfileDto | null> {
    const own = await this.getOwnPlayerProfile(userId);
    if (!own || own.visibility !== "PUBLIC") return null;
    return {
      userId: own.userId,
      publicDisplayName: own.publicDisplayName,
      imageUrl: own.imageUrl,
      position: own.position,
      teams: await this.listPlayerTeams(userId, true),
    };
  }

  private async listMembers(teamId: string): Promise<TeamMemberDto[]> {
    const rows = await this.db.select({
      userId: users.id,
      fallbackDisplayName: users.displayName,
      publicDisplayName: playerProfiles.publicDisplayName,
      imageUrl: playerProfiles.imageUrl,
      position: playerProfiles.position,
      role: teamMemberships.role,
      shirtNumber: teamMemberships.shirtNumber,
      joinedAt: teamMemberships.joinedAt,
    }).from(teamMemberships)
      .innerJoin(users, eq(teamMemberships.userId, users.id))
      .leftJoin(playerProfiles, eq(playerProfiles.userId, users.id))
      .where(and(
        eq(teamMemberships.teamId, teamId),
        eq(teamMemberships.status, "ACTIVE"),
        eq(users.status, "ACTIVE"),
      ));

    return rows.map((row) => ({
      userId: row.userId,
      publicDisplayName: row.publicDisplayName ?? row.fallbackDisplayName,
      imageUrl: row.imageUrl ?? null,
      position: row.position ?? "UNSPECIFIED",
      role: row.role,
      shirtNumber: row.shirtNumber,
      joinedAt: row.joinedAt.toISOString(),
    }));
  }

  private async rosterCount(teamId: string) {
    const [row] = await this.db.select({ value: count() }).from(teamMemberships)
      .where(and(eq(teamMemberships.teamId, teamId), eq(teamMemberships.status, "ACTIVE")));
    return Number(row?.value ?? 0);
  }

  async createTeam(input: {
    name: string;
    logoUrl: string | null;
    city: string;
    managerUserId: string;
    privacy: "PUBLIC" | "PRIVATE";
    now: Date;
  }): Promise<TeamDto> {
    const teamId = await this.db.transaction(async (tx) => {
      const [created] = await tx.insert(teams).values({
        name: input.name,
        logoUrl: input.logoUrl,
        city: input.city,
        managerUserId: input.managerUserId,
        privacy: input.privacy,
        status: "ACTIVE",
        createdAt: input.now,
        updatedAt: input.now,
      }).returning({ id: teams.id });
      if (!created) throw new Error("Team could not be created.");

      await tx.insert(teamMemberships).values({
        teamId: created.id,
        userId: input.managerUserId,
        role: "MANAGER",
        status: "ACTIVE",
        joinedAt: input.now,
        updatedAt: input.now,
      });
      return created.id;
    });

    const team = await this.getTeam(teamId, true);
    if (!team) throw new Error("Team could not be loaded.");
    return team;
  }

  async getTeamRecord(teamId: string): Promise<TeamRecord | null> {
    const [row] = await this.db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    return row ? teamRecord(row) : null;
  }

  async getTeam(teamId: string, includeRoster: boolean): Promise<TeamDto | null> {
    const record = await this.getTeamRecord(teamId);
    if (!record) return null;
    return {
      id: record.id,
      name: record.name,
      logoUrl: record.logoUrl,
      city: record.city,
      status: record.status,
      privacy: record.privacy,
      managerUserId: record.managerUserId,
      captainUserId: record.captainUserId,
      rosterCount: await this.rosterCount(record.id),
      members: includeRoster ? await this.listMembers(record.id) : [],
      createdAt: record.createdAt.toISOString(),
    };
  }

  async listUserTeams(userId: string): Promise<TeamListItemDto[]> {
    const rows = await this.db.select({ teamId: teams.id }).from(teamMemberships)
      .innerJoin(teams, eq(teamMemberships.teamId, teams.id))
      .where(and(
        eq(teamMemberships.userId, userId),
        eq(teamMemberships.status, "ACTIVE"),
        eq(teams.status, "ACTIVE"),
      ));

    const result: TeamListItemDto[] = [];
    for (const row of rows) {
      const team = await this.getTeam(row.teamId, false);
      if (team) {
        const { members: _members, ...summary } = team;
        result.push(summary);
      }
    }
    return result;
  }

  async getMembership(teamId: string, userId: string): Promise<TeamMembershipRecord | null> {
    const [row] = await this.db.select().from(teamMemberships).where(and(
      eq(teamMemberships.teamId, teamId),
      eq(teamMemberships.userId, userId),
    )).limit(1);
    return row ?? null;
  }

  async updateTeam(teamId: string, input: {
    name?: string;
    logoUrl?: string | null;
    city?: string;
    privacy?: "PUBLIC" | "PRIVATE";
    updatedAt: Date;
  }): Promise<TeamDto | null> {
    const patch: Partial<typeof teams.$inferInsert> = { updatedAt: input.updatedAt };
    if (input.name !== undefined) patch.name = input.name;
    if (input.logoUrl !== undefined) patch.logoUrl = input.logoUrl;
    if (input.city !== undefined) patch.city = input.city;
    if (input.privacy !== undefined) patch.privacy = input.privacy;
    await this.db.update(teams).set(patch).where(eq(teams.id, teamId));
    return this.getTeam(teamId, true);
  }

  async updateMember(teamId: string, userId: string, input: {
    role?: TeamMemberRole;
    shirtNumber?: number | null;
    status?: "ACTIVE" | "REMOVED";
    leftAt?: Date | null;
    updatedAt: Date;
  }): Promise<void> {
    const patch: Partial<typeof teamMemberships.$inferInsert> = { updatedAt: input.updatedAt };
    if (input.role !== undefined) patch.role = input.role;
    if (input.shirtNumber !== undefined) patch.shirtNumber = input.shirtNumber;
    if (input.status !== undefined) patch.status = input.status;
    if (input.leftAt !== undefined) patch.leftAt = input.leftAt;
    await this.db.update(teamMemberships).set(patch).where(and(
      eq(teamMemberships.teamId, teamId),
      eq(teamMemberships.userId, userId),
    ));
  }

  async transferManager(teamId: string, currentManagerUserId: string, nextManagerUserId: string, now: Date) {
    const changed = await this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${teamId}))`);
      const [team] = await tx.select().from(teams).where(eq(teams.id, teamId)).limit(1);
      if (!team || team.managerUserId !== currentManagerUserId || team.status !== "ACTIVE") return false;

      const [nextMembership] = await tx.select().from(teamMemberships).where(and(
        eq(teamMemberships.teamId, teamId),
        eq(teamMemberships.userId, nextManagerUserId),
        eq(teamMemberships.status, "ACTIVE"),
      )).limit(1);
      if (!nextMembership) return false;

      await tx.update(teams).set({ managerUserId: nextManagerUserId, updatedAt: now }).where(eq(teams.id, teamId));
      await tx.update(teamMemberships).set({ role: "MANAGER", updatedAt: now }).where(and(
        eq(teamMemberships.teamId, teamId),
        eq(teamMemberships.userId, nextManagerUserId),
      ));
      await tx.update(teamMemberships).set({
        role: team.captainUserId === currentManagerUserId ? "CAPTAIN" : "PLAYER",
        updatedAt: now,
      }).where(and(
        eq(teamMemberships.teamId, teamId),
        eq(teamMemberships.userId, currentManagerUserId),
      ));
      return true;
    });

    return changed ? this.getTeam(teamId, true) : null;
  }

  async setCaptain(teamId: string, managerUserId: string, captainUserId: string | null, now: Date) {
    const changed = await this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${teamId}))`);
      const [team] = await tx.select().from(teams).where(eq(teams.id, teamId)).limit(1);
      if (!team || team.managerUserId !== managerUserId || team.status !== "ACTIVE") return false;

      if (captainUserId) {
        const [membership] = await tx.select().from(teamMemberships).where(and(
          eq(teamMemberships.teamId, teamId),
          eq(teamMemberships.userId, captainUserId),
          eq(teamMemberships.status, "ACTIVE"),
        )).limit(1);
        if (!membership) return false;
      }

      if (team.captainUserId && team.captainUserId !== team.managerUserId) {
        await tx.update(teamMemberships).set({ role: "PLAYER", updatedAt: now }).where(and(
          eq(teamMemberships.teamId, teamId),
          eq(teamMemberships.userId, team.captainUserId),
        ));
      }

      await tx.update(teams).set({ captainUserId, updatedAt: now }).where(eq(teams.id, teamId));

      if (captainUserId && captainUserId !== team.managerUserId) {
        await tx.update(teamMemberships).set({ role: "CAPTAIN", updatedAt: now }).where(and(
          eq(teamMemberships.teamId, teamId),
          eq(teamMemberships.userId, captainUserId),
        ));
      }
      return true;
    });

    return changed ? this.getTeam(teamId, true) : null;
  }

  async removeMember(teamId: string, managerUserId: string, memberUserId: string, now: Date) {
    const changed = await this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${teamId}))`);
      const [team] = await tx.select().from(teams).where(eq(teams.id, teamId)).limit(1);
      if (!team || team.managerUserId !== managerUserId || team.status !== "ACTIVE") return false;
      if (memberUserId === managerUserId) return false;

      const [membership] = await tx.select().from(teamMemberships).where(and(
        eq(teamMemberships.teamId, teamId),
        eq(teamMemberships.userId, memberUserId),
        eq(teamMemberships.status, "ACTIVE"),
      )).limit(1);
      if (!membership) return false;

      if (team.captainUserId === memberUserId) {
        await tx.update(teams).set({ captainUserId: null, updatedAt: now }).where(eq(teams.id, teamId));
      }
      await tx.update(teamMemberships).set({
        status: "REMOVED",
        leftAt: now,
        updatedAt: now,
      }).where(and(eq(teamMemberships.teamId, teamId), eq(teamMemberships.userId, memberUserId)));
      return true;
    });

    return changed ? this.getTeam(teamId, true) : null;
  }
}
