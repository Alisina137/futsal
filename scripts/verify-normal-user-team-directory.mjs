import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}
function assert(value, message) {
  if (!value) throw new Error(message);
}

const contracts = read("packages/contracts/src/index.ts");
const schema = read("packages/database/src/schema.ts");
const migration = read("packages/database/drizzle/0012_team_join_requests.sql");
const repository = read("apps/api/src/modules/team/team.repository.ts");
const service = read("apps/api/src/modules/team/team.service.ts");
const routes = read("apps/api/src/modules/team/team.routes.ts");
const api = read("apps/mobile/src/lib/api.ts");
const screen = read("apps/mobile/app/(app)/teams/index.tsx");
const localization = read("packages/localization/src/index.ts");

assert((schema.match(/export const teamJoinRequestStatusEnum/g) ?? []).length === 1, "team join request enum must be declared once");
assert((schema.match(/export const teamJoinRequests = pgTable/g) ?? []).length === 1, "team join request table must be declared once");
assert((contracts.match(/export const teamJoinRequestStatusSchema/g) ?? []).length === 1, "team join request status contract must be declared once");
assert((contracts.match(/export const teamDirectoryItemDtoSchema/g) ?? []).length === 1, "team directory contract must be declared once");
assert(migration.includes('"requester_user_id"') && migration.includes('"team_join_requests_pending_uq"'), "join-request migration must preserve requester history with one pending request");
assert((repository.match(/async listDirectoryTeams/g) ?? []).length === 1, "team directory repository method must exist once");
assert((repository.match(/async createJoinRequest/g) ?? []).length === 1, "join-request repository method must exist once");
assert(repository.includes('where(eq(teams.status, "ACTIVE"))'), "directory must list active teams");
assert(service.includes("listTeamsDirectory") && service.includes("requestToJoin"), "team directory service methods missing");
assert(service.includes("ALREADY_TEAM_MEMBER"), "join request must reject existing active members");
assert(routes.includes('router.get("/teams", auth') && routes.includes('router.post("/teams/:teamId/join-request"'), "team directory/join routes missing");
assert(api.includes('directory: (accessToken: string)') && api.includes('requestJoin: (accessToken: string, teamId: string)'), "mobile team directory API missing");
assert(screen.includes("teamApi.directory") && !screen.includes("teamApi.mine"), "Teams page must use the all-team directory, not My Teams");
assert(screen.includes('t("teams.viewTeam")') && screen.includes('t("teams.requestToJoin")'), "directory must expose View Team and Request to Join");
assert(screen.includes('joinRequestStatus==="PENDING"'), "directory must show pending request state");
assert((localization.match(/"teams\.title": "Teams"/g) ?? []).length === 1, "English Teams title must not say My Teams");
assert(localization.includes('"teams.title": "تیم‌ها"'), "Dari Teams title missing");
assert(localization.includes('"teams.title": "ټیمونه"'), "Pashto Teams title missing");

console.log("Normal user Teams directory verified: all active teams, team profiles, join requests, pending state, and no My Teams directory regression.");
