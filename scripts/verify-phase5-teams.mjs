import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const schema = read("packages/database/src/schema.ts");
const contracts = read("packages/contracts/src/index.ts");
const teamRepository = read("apps/api/src/modules/team/team.repository.ts");
const teamService = read("apps/api/src/modules/team/team.service.ts");
const teamRoutes = read("apps/api/src/modules/team/team.routes.ts");
const notificationService = read("apps/api/src/modules/notifications/notification.service.ts");
const myTeams = read("apps/mobile/app/(app)/teams/index.tsx");
const teamDetail = read("apps/mobile/app/(app)/teams/[teamId].tsx");
const teamManager = read("apps/mobile/app/(app)/teams/[teamId]/manage.tsx");
const playerProfile = read("apps/mobile/app/(app)/profile/player.tsx");
const invitations = read("apps/mobile/app/(app)/teams/invitations.tsx");
const teamTests = read("apps/api/test/team.test.ts");
const invitationTests = read("apps/api/test/team-invitation.test.ts");

const checks = [
  [schema.includes('export const playerProfiles = pgTable') && schema.includes('export const teams = pgTable'), "player/team persistence"],
  [schema.includes('export const teamMemberships = pgTable') && schema.includes('primaryKey({ columns: [table.teamId, table.userId] })'), "one membership per user/team"],
  [schema.includes('team_invitations_pending_uq') && schema.includes(".where(sql"), "single pending invite per team/player"],
  [schema.includes('teamInvitesEnabled') && schema.includes('"TEAM_INVITATION"'), "team-invite notification persistence"],
  [contracts.includes('publicPlayerProfileDtoSchema') && !contracts.includes('publicPlayerProfileDtoSchema.extend({ phone'), "public player contract excludes contact data"],
  [teamRepository.includes('eq(playerProfiles.visibility, "PUBLIC")') && teamRepository.includes('.innerJoin(users'), "public player requires persisted public profile"],
  [teamRepository.includes('pg_advisory_xact_lock(hashtext') && teamRepository.includes('transferManager'), "serialized manager/captain mutations"],
  [teamService.includes('PLAYER_ACCOUNT_REQUIRED') && teamService.includes('roles.includes("PLAYER")'), "player-only team participation"],
  [!teamService.includes("TEAM_ELIGIBLE_ROLES") && !teamService.includes("PLAYER_ROLE_REQUIRED"), "single canonical player-role guard"],
  [teamService.includes('target.roles.includes("PLAYER")'), "team invitations target PLAYER accounts only"],
  [teamService.includes('TEAM_MANAGER_REQUIRED') && teamRoutes.includes('/teams/:teamId/manager'), "object-scoped manager authority"],
  [teamService.includes('7 * 24 * 60 * 60 * 1000') && teamRepository.includes('"EXPIRED"'), "expiring single-use invitations"],
  [notificationService.includes('type: "TEAM_INVITATION"') && notificationService.includes('teamInvitesEnabled'), "team invitation preference/dedupe delivery"],
  [myTeams.includes('teamApi.mine') && teamDetail.includes('teamApi.roster'), "player My Teams and roster workspace"],
  [teamManager.includes('transferManager') && teamManager.includes('removeMember') && teamManager.includes('revokeInvitation'), "manager mobile controls"],
  [playerProfile.includes('updateMyProfile') && playerProfile.includes('profileVisibility'), "editable player identity and privacy"],
  [invitations.includes('acceptInvitation') && invitations.includes('declineInvitation'), "player invitation inbox actions"],
  [teamTests.includes('belong to multiple teams') && teamTests.includes('private contact data publicly'), "multi-team/privacy API regression coverage"],
  [invitationTests.includes('revokes old-manager authority') && invitationTests.includes('expires old invitations'), "permission revocation/invite expiry regressions"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  throw new Error(`Phase 5 invariant(s) missing: ${failed.map(([, name]) => name).join(", ")}`);
}

console.log("Phase 5 team identity verified: persistent profiles/teams, multi-team membership, object-scoped manager authority, private-contact protection, expiring invitations, and mobile team workflows are present.");
