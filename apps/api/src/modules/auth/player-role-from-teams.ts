import type {UserRole} from "@leaguekick/contracts";

/**
 * Player is an earned role: a normal user becomes a Player after a team
 * accepts their join request (or they accept an invitation). The active
 * membership is the authority, NOT a permanently copied user_roles grant.
 *
 * Referee remains mutually exclusive with Player. Admin must not silently
 * acquire Player access from an old roster entry.
 */
export function rolesWithActiveTeamPlayer(
  existingRoles: readonly UserRole[],
  hasActiveTeamPlayerMembership: boolean,
): UserRole[] {
  const roles=[...new Set(existingRoles)];
  if(hasActiveTeamPlayerMembership &&
    !roles.includes("REFEREE") &&
    !roles.includes("PLATFORM_ADMIN") &&
    !roles.includes("PLAYER")){
    roles.push("PLAYER");
  }
  return roles;
}
