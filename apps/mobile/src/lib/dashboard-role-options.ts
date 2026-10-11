import type {DashboardRole} from "./dashboard-role";

/** A referee has a dedicated dashboard and must not switch into Player mode.
 * Other accounts retain their original free Player dashboard and subscribed modes.
 * Recheck assigned roles on every render; saved preferences are not permissions.
 */
export function availableDashboardRoles(assignedRoles:readonly string[]):DashboardRole[]{
  if(assignedRoles.includes("REFEREE"))return ["REFEREE"];
  return [
    "PLAYER",
    ...(assignedRoles.includes("TEAM_MANAGER")?["TEAM_MANAGER" as const]:[]),
    ...(assignedRoles.includes("VENUE_OWNER")?["VENUE_OWNER" as const]:[]),
  ];
}
