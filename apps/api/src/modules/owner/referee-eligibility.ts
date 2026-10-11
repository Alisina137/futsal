/** A referee is promoted from a base Normal User account only.
 * Checking only user_roles is insufficient: team membership, player profiles,
 * venue ownership and venue-scoped referee grants are separate authorities. */
export type RefereeCandidateState={
  status:"ACTIVE"|"SUSPENDED"|"DELETED"|null;
  assignedRoles:readonly string[];
  hasPlayerProfile:boolean;
  hasActiveTeamMembership:boolean;
  managesTeam:boolean;
  ownsVenue:boolean;
  hasPaidRoleSubscription:boolean;
  hasOtherRefereeGrant:boolean;
};

export function canGrantRefereeToNormalUser(candidate:RefereeCandidateState):boolean{
  return candidate.status==="ACTIVE"
    &&candidate.assignedRoles.length===0
    &&!candidate.hasPlayerProfile
    &&!candidate.hasActiveTeamMembership
    &&!candidate.managesTeam
    &&!candidate.ownsVenue
    &&!candidate.hasPaidRoleSubscription
    &&!candidate.hasOtherRefereeGrant;
}
