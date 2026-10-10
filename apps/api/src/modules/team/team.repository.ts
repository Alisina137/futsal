import type {
  OwnPlayerProfileDto,
  PublicPlayerProfileDto,
  TeamDirectoryItemDto,
  TeamDto,
  TeamInvitationDto,
  TeamJoinRequestDto,
  TeamListItemDto,
  TeamMemberDto,
  TeamMemberRole,
} from "@leaguekick/contracts";
import type { Database } from "@leaguekick/database";
import {
  playerProfiles,
  teamInvitations,
  teamManagerProfiles,
  teamJoinRequests,
  teamMemberships,
  roleSubscriptions,
  teamExtraSubscriptions,
  teams,
  userRoles,
  users,
} from "@leaguekick/database";
import { and, asc, count, desc, eq, isNull, isNotNull, lte, or, sql } from "drizzle-orm";
import { errors } from "../../lib/errors.js";
import {requireTeamLicense} from "./team-slots.js";
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
    offlineVenueId: row.offlineVenueId,
    claimedAt: row.claimedAt,
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
    if (!row) return null;
    const [roles, subscriptions] = await Promise.all([
      this.db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId)),
      this.db.select({ role: roleSubscriptions.role, status: roleSubscriptions.status, activeUntil: roleSubscriptions.activeUntil })
        .from(roleSubscriptions)
        .where(eq(roleSubscriptions.userId, userId)),
    ]);
    const activePaid = new Set(subscriptions
      .filter((item) => item.status === "ACTIVE" && item.activeUntil && item.activeUntil.getTime() > Date.now())
      .map((item) => item.role));
    return {
      ...row,
      roles: roles.map((item) => item.role).filter((role) =>
        role !== "VENUE_OWNER" && role !== "TEAM_MANAGER" || activePaid.has(role),
      ),
    };
  }

  async getUserByNormalizedIdentifier(input: { usernameNormalized?: string; phoneE164?: string }) {
    if (!input.usernameNormalized && !input.phoneE164) return null;

    const identifierCondition =
      input.usernameNormalized && input.phoneE164
        ? or(
          eq(users.usernameNormalized, input.usernameNormalized),
          eq(users.phoneE164, input.phoneE164),
        )
        : input.usernameNormalized
          ? eq(users.usernameNormalized, input.usernameNormalized)
          : eq(users.phoneE164, input.phoneE164!);

    const [row] = await this.db.select({
      id: users.id,
      displayName: users.displayName,
      username: users.username,
    }).from(users).where(and(
      eq(users.status, "ACTIVE"),
      identifierCondition,
    )).limit(1);
    if (!row) return null;
    const [roles, subscriptions] = await Promise.all([
      this.db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, row.id)),
      this.db.select({ role: roleSubscriptions.role, status: roleSubscriptions.status, activeUntil: roleSubscriptions.activeUntil })
        .from(roleSubscriptions)
        .where(eq(roleSubscriptions.userId, row.id)),
    ]);
    const activePaid = new Set(subscriptions
      .filter((item) => item.status === "ACTIVE" && item.activeUntil && item.activeUntil.getTime() > Date.now())
      .map((item) => item.role));
    return {
      ...row,
      roles: roles.map((item) => item.role).filter((role) =>
        role !== "VENUE_OWNER" && role !== "TEAM_MANAGER" || activePaid.has(role),
      ),
    };
  }

  private async listPlayerTeams(userId: string, publicOnly: boolean): Promise<OwnPlayerProfileDto["teams"]> {
    const condition = and(
      eq(teamMemberships.userId, userId),
      eq(teamMemberships.status, "ACTIVE"),
      eq(teams.status, "ACTIVE"),
      ...(publicOnly ? [eq(teams.privacy, "PUBLIC"), or(isNull(teams.offlineVenueId), isNotNull(teams.claimedAt))] : []),
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
    const [row] = await this.db.select({
      userId: playerProfiles.userId,
      publicDisplayName: playerProfiles.publicDisplayName,
      imageUrl: playerProfiles.imageUrl,
      position: playerProfiles.position,
      visibility: playerProfiles.visibility,
    }).from(playerProfiles)
      .innerJoin(users, eq(playerProfiles.userId, users.id))
      .where(and(
        eq(playerProfiles.userId, userId),
        eq(playerProfiles.visibility, "PUBLIC"),
        eq(users.status, "ACTIVE"),
      ))
      .limit(1);

    if (!row) return null;
    return {
      userId: row.userId,
      publicDisplayName: row.publicDisplayName,
      imageUrl: row.imageUrl,
      position: row.position,
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
      // Lock by actor so concurrent requests cannot claim the same base subscription or paid slot.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.managerUserId}))`);
      const [role]=await tx.select({status:roleSubscriptions.status,activeUntil:roleSubscriptions.activeUntil})
        .from(roleSubscriptions).where(and(eq(roleSubscriptions.userId,input.managerUserId),
          eq(roleSubscriptions.role,"TEAM_MANAGER"))).limit(1);
      if(role?.status!=="ACTIVE"||!role.activeUntil||role.activeUntil<=input.now)
        throw errors.forbidden("TEAM_OWNER_SUBSCRIPTION_REQUIRED","An active Team Manager subscription is required.");
      const existing=await tx.select({id:teams.id}).from(teams)
        .leftJoin(teamExtraSubscriptions,eq(teamExtraSubscriptions.teamId,teams.id))
        .where(and(eq(teams.managerUserId,input.managerUserId),eq(teams.status,"ACTIVE"),
          or(isNull(teams.offlineVenueId),isNotNull(teams.claimedAt)),isNull(teamExtraSubscriptions.id)));
      const needsExtra=existing.length>0;
      const [available]=needsExtra?await tx.select({id:teamExtraSubscriptions.id})
        .from(teamExtraSubscriptions).where(and(eq(teamExtraSubscriptions.userId,input.managerUserId),
          isNull(teamExtraSubscriptions.teamId),eq(teamExtraSubscriptions.status,"ACTIVE"),
          sql`${teamExtraSubscriptions.activeUntil} > ${input.now}`))
        .orderBy(asc(teamExtraSubscriptions.requestedAt)).limit(1):[];
      if(needsExtra&&!available)
        throw errors.forbidden("TEAM_ADDITIONAL_SUBSCRIPTION_REQUIRED",
          "A separate paid and activated team subscription is required to create another team.");
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

      if(available){
        // Atomic one-time consumption: an extra subscription can license only one team.
        const [assigned]=await tx.update(teamExtraSubscriptions).set({teamId:created.id,updatedAt:input.now})
          .where(and(eq(teamExtraSubscriptions.id,available.id),isNull(teamExtraSubscriptions.teamId),
            eq(teamExtraSubscriptions.status,"ACTIVE"),
            sql`${teamExtraSubscriptions.activeUntil} > ${input.now}`))
          .returning({id:teamExtraSubscriptions.id});
        if(!assigned)throw errors.conflict("TEAM_SLOT_CONSUMED","This subscription was already used. Refresh.");
      }
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

  async assertManagerSubscription(userId:string,teamId:string,now:Date){
    await requireTeamLicense(this.db,userId,teamId,now);
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

  private async joinRequestDto(requestId: string): Promise<TeamJoinRequestDto | null> {
    const [row] = await this.db.select({
      id: teamJoinRequests.id,
      teamId: teamJoinRequests.teamId,
      teamName: teams.name,
      requesterUserId: teamJoinRequests.requesterUserId,
      requesterDisplayName: users.displayName,
      status: teamJoinRequests.status,
      createdAt: teamJoinRequests.createdAt,
      respondedAt: teamJoinRequests.respondedAt,
    }).from(teamJoinRequests)
      .innerJoin(teams, eq(teamJoinRequests.teamId, teams.id))
      .innerJoin(users, eq(teamJoinRequests.requesterUserId, users.id))
      .where(eq(teamJoinRequests.id, requestId))
      .limit(1);

    return row ? {
      ...row,
      createdAt: row.createdAt.toISOString(),
      respondedAt: row.respondedAt?.toISOString() ?? null,
    } : null;
  }

  async listDirectoryTeams(userId: string): Promise<TeamDirectoryItemDto[]> {
    const rows = await this.db.select({ id: teams.id }).from(teams)
      .where(and(eq(teams.status, "ACTIVE"), or(isNull(teams.offlineVenueId), isNotNull(teams.claimedAt))))
      .orderBy(asc(teams.name));

    const result: TeamDirectoryItemDto[] = [];
    for (const row of rows) {
      const team = await this.getTeam(row.id, false);
      if (!team) continue;
      const [membership, pendingRequest] = await Promise.all([
        this.getMembership(row.id, userId),
        this.db.select({ status: teamJoinRequests.status }).from(teamJoinRequests)
          .where(and(
            eq(teamJoinRequests.teamId, row.id),
            eq(teamJoinRequests.requesterUserId, userId),
            eq(teamJoinRequests.status, "PENDING"),
          ))
          .limit(1),
      ]);
      const { members: _members, ...summary } = team;
      result.push({
        ...summary,
        myMembershipRole: membership?.status === "ACTIVE" ? membership.role : null,
        joinRequestStatus: pendingRequest[0]?.status ?? null,
      });
    }
    return result;
  }

  async allowsJoinRequests(teamId:string):Promise<boolean>{
    const [row]=await this.db.select({allow:teamManagerProfiles.allowJoinRequests}).from(teamManagerProfiles)
      .where(eq(teamManagerProfiles.teamId,teamId)).limit(1);
    return row?.allow??true;
  }

  async getJoinRequest(teamId: string, requesterUserId: string): Promise<TeamJoinRequestDto | null> {
    const [row] = await this.db.select({ id: teamJoinRequests.id }).from(teamJoinRequests)
      .where(and(
        eq(teamJoinRequests.teamId, teamId),
        eq(teamJoinRequests.requesterUserId, requesterUserId),
        eq(teamJoinRequests.status, "PENDING"),
      ))
      .orderBy(desc(teamJoinRequests.createdAt))
      .limit(1);
    return row ? this.joinRequestDto(row.id) : null;
  }

  async createJoinRequest(teamId: string, requesterUserId: string, now: Date): Promise<TeamJoinRequestDto> {
    try {
      const [created] = await this.db.insert(teamJoinRequests).values({
        teamId,
        requesterUserId,
        status: "PENDING",
        createdAt: now,
        updatedAt: now,
      }).returning({ id: teamJoinRequests.id });
      if (!created) throw new Error("Join request could not be created.");
      const dto = await this.joinRequestDto(created.id);
      if (!dto) throw new Error("Join request could not be loaded.");
      return dto;
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        throw errors.conflict("TEAM_JOIN_REQUEST_PENDING", "You already have a pending request for this team.");
      }
      throw error;
    }
  }

  async listJoinRequestsForTeam(teamId: string): Promise<TeamJoinRequestDto[]> {
    const rows = await this.db.select({ id: teamJoinRequests.id }).from(teamJoinRequests)
      .where(eq(teamJoinRequests.teamId, teamId))
      .orderBy(desc(teamJoinRequests.createdAt));
    const result: TeamJoinRequestDto[] = [];
    for (const row of rows) {
      const dto = await this.joinRequestDto(row.id);
      if (dto) result.push(dto);
    }
    return result;
  }

  async respondJoinRequest(
    teamId: string,
    requestId: string,
    managerUserId: string,
    accept: boolean,
    now: Date,
  ): Promise<TeamJoinRequestDto | null> {
    const changed = await this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${teamId}))`);
      const [team] = await tx.select().from(teams).where(eq(teams.id, teamId)).limit(1);
      if (!team || team.status !== "ACTIVE" || team.managerUserId !== managerUserId) return false;

      const [request] = await tx.select().from(teamJoinRequests).where(and(
        eq(teamJoinRequests.id, requestId),
        eq(teamJoinRequests.teamId, teamId),
      )).limit(1);
      if (!request || request.status !== "PENDING") return false;

      if (accept) {
        await tx.insert(teamMemberships).values({
          teamId,
          userId: request.requesterUserId,
          role: "PLAYER",
          status: "ACTIVE",
          joinedAt: now,
          updatedAt: now,
        }).onConflictDoUpdate({
          target: [teamMemberships.teamId, teamMemberships.userId],
          set: {
            role: "PLAYER",
            status: "ACTIVE",
            leftAt: null,
            joinedAt: now,
            updatedAt: now,
          },
        });
      }

      await tx.update(teamJoinRequests).set({
        status: accept ? "ACCEPTED" : "REJECTED",
        respondedByUserId: managerUserId,
        respondedAt: now,
        updatedAt: now,
      }).where(eq(teamJoinRequests.id, requestId));
      return true;
    });

    return changed ? this.joinRequestDto(requestId) : null;
  }

  async listUserTeams(userId: string): Promise<TeamListItemDto[]> {
    const rows = await this.db.select({ teamId: teams.id }).from(teamMemberships)
      .innerJoin(teams, eq(teamMemberships.teamId, teams.id))
      .where(and(
        eq(teamMemberships.userId, userId),
        eq(teamMemberships.status, "ACTIVE"),
        eq(teams.status, "ACTIVE"),
        or(isNull(teams.offlineVenueId), isNotNull(teams.claimedAt)),
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
      // A transfer cannot turn an unpaid member into a manager of an extra team.
      // For now a target manager must have a paid role and no already-managed team.
      const [paid]=await tx.select({status:roleSubscriptions.status,activeUntil:roleSubscriptions.activeUntil})
        .from(roleSubscriptions).where(and(eq(roleSubscriptions.userId,nextManagerUserId),
          eq(roleSubscriptions.role,"TEAM_MANAGER"))).limit(1);
      if(paid?.status!=="ACTIVE"||!paid.activeUntil||paid.activeUntil<=now)
        throw errors.forbidden("TEAM_OWNER_SUBSCRIPTION_REQUIRED","The new manager must have an active Team Manager subscription.");
      const [already]=await tx.select({id:teams.id}).from(teams)
        .where(and(eq(teams.managerUserId,nextManagerUserId),eq(teams.status,"ACTIVE"))).limit(1);
      if(already)throw errors.conflict("TEAM_TARGET_MANAGER_HAS_TEAM",
        "The new manager already has a team. Transfer requires a separate paid team slot.");
      await tx.update(teamExtraSubscriptions).set({teamId:null,updatedAt:now})
        .where(and(eq(teamExtraSubscriptions.userId,currentManagerUserId),
          eq(teamExtraSubscriptions.teamId,teamId)));
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

  private async invitationDto(invitationId: string): Promise<TeamInvitationDto | null> {
    const [row] = await this.db.select({
      id: teamInvitations.id,
      teamId: teamInvitations.teamId,
      teamName: teams.name,
      invitedUserId: teamInvitations.invitedUserId,
      fallbackDisplayName: users.displayName,
      publicDisplayName: playerProfiles.publicDisplayName,
      role: teamInvitations.role,
      shirtNumber: teamInvitations.shirtNumber,
      status: teamInvitations.status,
      expiresAt: teamInvitations.expiresAt,
      createdAt: teamInvitations.createdAt,
    }).from(teamInvitations)
      .innerJoin(teams, eq(teamInvitations.teamId, teams.id))
      .innerJoin(users, eq(teamInvitations.invitedUserId, users.id))
      .leftJoin(playerProfiles, eq(playerProfiles.userId, users.id))
      .where(eq(teamInvitations.id, invitationId))
      .limit(1);

    if (!row) return null;
    return {
      id: row.id,
      teamId: row.teamId,
      teamName: row.teamName,
      invitedUserId: row.invitedUserId,
      invitedPublicDisplayName: row.publicDisplayName ?? row.fallbackDisplayName,
      role: row.role === "MANAGER" ? "PLAYER" : row.role,
      shirtNumber: row.shirtNumber,
      status: row.status,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async expireInvitations(now: Date, scope: { userId?: string; teamId?: string }) {
    const base = and(
      eq(teamInvitations.status, "PENDING"),
      lte(teamInvitations.expiresAt, now),
    );
    const where = scope.userId
      ? and(base, eq(teamInvitations.invitedUserId, scope.userId))
      : scope.teamId
        ? and(base, eq(teamInvitations.teamId, scope.teamId))
        : base;

    await this.db.update(teamInvitations).set({
      status: "EXPIRED",
      respondedAt: now,
      updatedAt: now,
    }).where(where);
  }

  async createInvitation(input: {
    teamId: string;
    invitedUserId: string;
    invitedByUserId: string;
    role: "CAPTAIN" | "PLAYER";
    shirtNumber: number | null;
    expiresAt: Date;
    now: Date;
  }) {
    await this.expireInvitations(input.now, { teamId: input.teamId });
    try {
      const [created] = await this.db.insert(teamInvitations).values({
        teamId: input.teamId,
        invitedUserId: input.invitedUserId,
        invitedByUserId: input.invitedByUserId,
        role: input.role,
        shirtNumber: input.shirtNumber,
        status: "PENDING",
        expiresAt: input.expiresAt,
        createdAt: input.now,
        updatedAt: input.now,
      }).returning({ id: teamInvitations.id });
      if (!created) throw new Error("Team invitation could not be created.");
      const dto = await this.invitationDto(created.id);
      if (!dto) throw new Error("Team invitation could not be loaded.");
      return dto;
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        throw errors.conflict("TEAM_INVITATION_PENDING", "A pending invitation already exists for this player.");
      }
      throw error;
    }
  }

  async listInvitationsForUser(userId: string, now: Date) {
    await this.expireInvitations(now, { userId });
    const rows = await this.db.select({ id: teamInvitations.id }).from(teamInvitations)
      .where(eq(teamInvitations.invitedUserId, userId))
      .orderBy(desc(teamInvitations.createdAt));
    const result: TeamInvitationDto[] = [];
    for (const row of rows) {
      const dto = await this.invitationDto(row.id);
      if (dto) result.push(dto);
    }
    return result;
  }

  async listInvitationsForTeam(teamId: string, now: Date) {
    await this.expireInvitations(now, { teamId });
    const rows = await this.db.select({ id: teamInvitations.id }).from(teamInvitations)
      .where(eq(teamInvitations.teamId, teamId))
      .orderBy(desc(teamInvitations.createdAt));
    const result: TeamInvitationDto[] = [];
    for (const row of rows) {
      const dto = await this.invitationDto(row.id);
      if (dto) result.push(dto);
    }
    return result;
  }

  async acceptInvitation(invitationId: string, invitedUserId: string, now: Date) {
    const accepted = await this.db.transaction(async (tx) => {
      const [invite] = await tx.select().from(teamInvitations)
        .where(eq(teamInvitations.id, invitationId))
        .limit(1);
      if (!invite || invite.invitedUserId !== invitedUserId || invite.status !== "PENDING") return false;
      if (invite.expiresAt.getTime() <= now.getTime()) {
        await tx.update(teamInvitations).set({
          status: "EXPIRED",
          respondedAt: now,
          updatedAt: now,
        }).where(eq(teamInvitations.id, invitationId));
        return false;
      }

      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${invite.teamId}))`);
      const [team] = await tx.select().from(teams).where(eq(teams.id, invite.teamId)).limit(1);
      if (!team || team.status !== "ACTIVE") return false;

      const [existing] = await tx.select().from(teamMemberships).where(and(
        eq(teamMemberships.teamId, invite.teamId),
        eq(teamMemberships.userId, invitedUserId),
      )).limit(1);

      if (existing) {
        await tx.update(teamMemberships).set({
          role: invite.role === "CAPTAIN" ? "CAPTAIN" : "PLAYER",
          shirtNumber: invite.shirtNumber,
          status: "ACTIVE",
          leftAt: null,
          updatedAt: now,
        }).where(and(
          eq(teamMemberships.teamId, invite.teamId),
          eq(teamMemberships.userId, invitedUserId),
        ));
      } else {
        await tx.insert(teamMemberships).values({
          teamId: invite.teamId,
          userId: invitedUserId,
          role: invite.role === "CAPTAIN" ? "CAPTAIN" : "PLAYER",
          shirtNumber: invite.shirtNumber,
          status: "ACTIVE",
          joinedAt: now,
          updatedAt: now,
        });
      }

      if (invite.role === "CAPTAIN") {
        if (team.captainUserId && team.captainUserId !== team.managerUserId && team.captainUserId !== invitedUserId) {
          await tx.update(teamMemberships).set({ role: "PLAYER", updatedAt: now }).where(and(
            eq(teamMemberships.teamId, invite.teamId),
            eq(teamMemberships.userId, team.captainUserId),
          ));
        }
        await tx.update(teams).set({ captainUserId: invitedUserId, updatedAt: now }).where(eq(teams.id, invite.teamId));
      }

      await tx.update(teamInvitations).set({
        status: "ACCEPTED",
        respondedAt: now,
        updatedAt: now,
      }).where(eq(teamInvitations.id, invitationId));
      return true;
    });

    return accepted ? this.invitationDto(invitationId) : null;
  }

  async declineInvitation(invitationId: string, invitedUserId: string, now: Date) {
    const [updated] = await this.db.update(teamInvitations).set({
      status: "DECLINED",
      respondedAt: now,
      updatedAt: now,
    }).where(and(
      eq(teamInvitations.id, invitationId),
      eq(teamInvitations.invitedUserId, invitedUserId),
      eq(teamInvitations.status, "PENDING"),
    )).returning({ id: teamInvitations.id });
    return updated ? this.invitationDto(updated.id) : null;
  }

  async revokeInvitation(teamId: string, managerUserId: string, invitationId: string, now: Date) {
    const [team] = await this.db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!team || team.managerUserId !== managerUserId) return null;
    const [updated] = await this.db.update(teamInvitations).set({
      status: "REVOKED",
      respondedAt: now,
      updatedAt: now,
    }).where(and(
      eq(teamInvitations.id, invitationId),
      eq(teamInvitations.teamId, teamId),
      eq(teamInvitations.status, "PENDING"),
    )).returning({ id: teamInvitations.id });
    return updated ? this.invitationDto(updated.id) : null;
  }

}
