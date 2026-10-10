import type { Database } from "@leaguekick/database";
import {
  auditLogs, competitionTeams, competitions, playerProfiles, roleSubscriptions,
  teamMemberships, teams, users, venueSubscriptions, venues,
} from "@leaguekick/database";
import { normalizeAfghanistanPhone, normalizeUsername, type ManualTeamCreateRequest, type ManualTeamUpdateRequest, type ManualTeamClaimRequest } from "@leaguekick/contracts";
import { and, asc, count, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";
import { errors } from "../../lib/errors.js";
import { hasPremiumWriteAccess } from "../billing/entitlement.js";

/** Offline participants are competition identities, not free Team Owner accounts.
 * The hosting venue owner administers them until an administrator explicitly
 * transfers the existing team ID to a verified, subscribed Team Owner.
 */
export class ManualTeamService {
  constructor(private readonly db: Database, private readonly now: () => Date = () => new Date()) {}

  private async ownerVenue(ownerUserId: string) {
    const [venue] = await this.db.select().from(venues)
      .where(eq(venues.ownerUserId, ownerUserId)).limit(1);
    if (!venue) throw errors.badRequest("VENUE_REQUIRED", "Set up your venue first.");
    if (venue.status === "SUSPENDED") throw errors.forbidden("VENUE_SUSPENDED", "Venue suspended.");
    const [subscription] = await this.db.select().from(venueSubscriptions)
      .where(eq(venueSubscriptions.venueId, venue.id)).limit(1);
    if (!hasPremiumWriteAccess(subscription ?? null, this.now())) {
      throw errors.forbidden("SUBSCRIPTION_REQUIRED", "Active venue access is required.");
    }
    return venue;
  }

  async listOwner(ownerUserId: string) {
    const venue = await this.ownerVenue(ownerUserId);
    const rows = await this.db.select({
      id: teams.id, name: teams.name, city: teams.city, createdAt: teams.createdAt,
    }).from(teams).where(and(
      eq(teams.offlineVenueId, venue.id), isNull(teams.claimedAt), eq(teams.status, "ACTIVE"),
    )).orderBy(asc(teams.name));
    return { teams: rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString() })) };
  }

  async create(ownerUserId: string, input: ManualTeamCreateRequest) {
    const venue = await this.ownerVenue(ownerUserId);
    const [created] = await this.db.insert(teams).values({
      name: input.name.trim(), city: input.city.trim(),
      managerUserId: ownerUserId, offlineVenueId: venue.id,
      privacy: "PRIVATE", status: "ACTIVE", createdAt: this.now(), updatedAt: this.now(),
    }).returning({ id: teams.id, name: teams.name, city: teams.city, createdAt: teams.createdAt });
    if (!created) throw new Error("Could not create offline team.");
    return { ...created, createdAt: created.createdAt.toISOString() };
  }

  async update(ownerUserId: string, teamId: string, input: ManualTeamUpdateRequest) {
    const venue = await this.ownerVenue(ownerUserId);
    const [changed] = await this.db.update(teams).set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.city !== undefined ? { city: input.city.trim() } : {}),
      updatedAt: this.now(),
    }).where(and(
      eq(teams.id, teamId), eq(teams.offlineVenueId, venue.id),
      eq(teams.managerUserId, ownerUserId), isNull(teams.claimedAt), eq(teams.status, "ACTIVE"),
    )).returning({ id: teams.id, name: teams.name, city: teams.city, createdAt: teams.createdAt });
    if (!changed) throw errors.forbidden("OFFLINE_TEAM_ACCESS_DENIED", "This offline team is not yours or was claimed.");
    return { ...changed, createdAt: changed.createdAt.toISOString() };
  }

  /** Organizer-enrolled offline teams are accepted immediately; no fake manager account,
   * invitation, paid team role, or registration-open window is needed.
   * Competition structure and capacity restrictions still apply.
   */
  async register(ownerUserId: string, competitionId: string, teamId: string) {
    const venue = await this.ownerVenue(ownerUserId);
    return this.db.transaction(async tx => {
      const [competition] = await tx.select().from(competitions)
        .where(eq(competitions.id, competitionId)).for("update").limit(1);
      if (!competition || competition.venueId !== venue.id) {
        throw errors.forbidden("COMPETITION_ACCESS_DENIED", "You cannot register teams for this competition.");
      }
      if (!["DRAFT", "REGISTRATION_OPEN", "REGISTRATION_CLOSED"].includes(competition.status)
          || competition.materialPlayStartedAt) {
        throw errors.conflict("COMPETITION_TEAM_LOCKED", "Teams cannot be added after fixtures or play begin.");
      }
      const [team] = await tx.select().from(teams).where(and(
        eq(teams.id, teamId), eq(teams.offlineVenueId, venue.id),
        eq(teams.managerUserId, ownerUserId), isNull(teams.claimedAt), eq(teams.status, "ACTIVE"),
      )).limit(1);
      if (!team) throw errors.forbidden("OFFLINE_TEAM_ACCESS_DENIED", "Choose one of your unclaimed offline teams.");

      const [existing] = await tx.select().from(competitionTeams).where(and(
        eq(competitionTeams.competitionId, competitionId), eq(competitionTeams.teamId, teamId),
      )).limit(1);
      if (existing && !["REJECTED", "WITHDRAWN"].includes(existing.status)) {
        throw errors.conflict("REGISTRATION_EXISTS", "This team is already registered.");
      }
      const [capacity] = await tx.select({ value: count() }).from(competitionTeams).where(and(
        eq(competitionTeams.competitionId, competitionId), eq(competitionTeams.status, "ACCEPTED"),
      ));
      if (Number(capacity?.value ?? 0) >= competition.maxTeams) {
        throw errors.conflict("COMPETITION_FULL", "This competition has reached team capacity.");
      }
      const now = this.now();
      if (existing) {
        await tx.update(competitionTeams).set({
          status: "ACCEPTED", groupId: null, seed: null,
          appliedByUserId: ownerUserId, respondedByUserId: ownerUserId,
          respondedAt: now, updatedAt: now,
        }).where(and(eq(competitionTeams.competitionId, competitionId), eq(competitionTeams.teamId, teamId)));
      } else {
        await tx.insert(competitionTeams).values({
          competitionId, teamId, status: "ACCEPTED",
          appliedByUserId: ownerUserId, respondedByUserId: ownerUserId,
          respondedAt: now, createdAt: now, updatedAt: now,
        });
      }
      return { teamId, status: "ACCEPTED" as const };
    });
  }

  async listUnclaimedForAdmin() {
    const rows = await this.db.select({
      id: teams.id, name: teams.name, city: teams.city, createdAt: teams.createdAt,
      venueId: venues.id, venueName: venues.name,
    }).from(teams).innerJoin(venues, eq(teams.offlineVenueId, venues.id))
      .where(and(isNotNull(teams.offlineVenueId), isNull(teams.claimedAt), eq(teams.status, "ACTIVE")))
      .orderBy(asc(teams.name)).limit(300);
    return { teams: rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString() })) };
  }

  /** Requires BOTH username and phone to match the SAME active user, plus a
   * currently active paid Team Owner subscription; no silent role escalation.
   * Transaction preserves existing competition results, standings and team ID.
   */
  async assign(adminUserId: string, teamId: string, input: ManualTeamClaimRequest) {
    const usernameNormalized = normalizeUsername(input.username);
    if (!usernameNormalized) throw errors.badRequest("TEAM_CLAIM_INVALID_USERNAME", "Provide a valid username.");
    const phoneE164 = normalizeAfghanistanPhone(input.phone);
    return this.db.transaction(async tx => {
      const [team] = await tx.select().from(teams).where(eq(teams.id, teamId)).for("update").limit(1);
      if (!team || !team.offlineVenueId || team.claimedAt || team.status !== "ACTIVE") {
        throw errors.conflict("OFFLINE_TEAM_NOT_AVAILABLE", "This offline team has already been claimed or is unavailable.");
      }
      const [user] = await tx.select().from(users).where(and(
        eq(users.usernameNormalized, usernameNormalized), eq(users.phoneE164, phoneE164),
        eq(users.status, "ACTIVE"),
      )).limit(1);
      if (!user) throw errors.badRequest("TEAM_CLAIM_USER_MISMATCH", "Username and phone must match one active account.");
      const [subscription] = await tx.select().from(roleSubscriptions).where(and(
        eq(roleSubscriptions.userId, user.id), eq(roleSubscriptions.role, "TEAM_MANAGER"),
        eq(roleSubscriptions.status, "ACTIVE"), gt(roleSubscriptions.activeUntil, this.now()),
      )).limit(1);
      if (!subscription) {
        throw errors.forbidden("TEAM_OWNER_SUBSCRIPTION_REQUIRED", "Activate the user's Team Owner subscription before assigning the team.");
      }
      const now = this.now();
      await tx.insert(playerProfiles).values({
        userId: user.id, publicDisplayName: user.displayName,
        createdAt: now, updatedAt: now,
      }).onConflictDoNothing();
      await tx.insert(teamMemberships).values({
        teamId, userId: user.id, role: "MANAGER", status: "ACTIVE",
        joinedAt: now, updatedAt: now,
      }).onConflictDoUpdate({
        target: [teamMemberships.teamId, teamMemberships.userId],
        set: { role: "MANAGER", status: "ACTIVE", leftAt: null, joinedAt: now, updatedAt: now },
      });
      await tx.update(teams).set({
        managerUserId: user.id, claimedAt: now, privacy: "PUBLIC", updatedAt: now,
      }).where(eq(teams.id, teamId));
      await tx.insert(auditLogs).values({
        actorUserId: adminUserId, action: "OFFLINE_TEAM_CLAIM",
        targetType: "TEAM", targetId: teamId,
        metadata: { managerUserId: user.id, venueId: team.offlineVenueId },
        createdAt: now,
      });
      return { teamId, managerUserId: user.id, claimedAt: now.toISOString() };
    });
  }
}
