import type {DashboardRole} from "./dashboard-role";

/** Only an assigned role grants its dashboard UI. Normal users (roles=[])
 * retain Home, Venues, Teams and Reservations but not a Player Dashboard.
 * Referees must not see Player options, even when older data contains both.
 * Persisted dashboard preferences are selections, never entitlements.
 */
export function availableDashboardRoles(assignedRoles:readonly string[]):DashboardRole[]{
  if(assignedRoles.includes("PLATFORM_ADMIN"))return [];
  if(assignedRoles.includes("REFEREE"))return ["REFEREE"];
  return [
    ...(assignedRoles.includes("PLAYER")?["PLAYER" as const]:[]),
    ...(assignedRoles.includes("TEAM_MANAGER")?["TEAM_MANAGER" as const]:[]),
    ...(assignedRoles.includes("VENUE_OWNER")?["VENUE_OWNER" as const]:[]),
  ];
}
