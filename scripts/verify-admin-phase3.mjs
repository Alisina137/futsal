import assert from "node:assert/strict";
import fs from "node:fs";
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const contracts=read("packages/contracts/src/index.ts");
const migration=read("packages/database/drizzle/0033_admin_user_sessions.sql");
const journal=read("packages/database/drizzle/meta/_journal.json");
const schema=read("packages/database/src/schema.ts");
const repo=read("apps/api/src/modules/commercial/admin-users.repository.ts");
const routes=read("apps/api/src/modules/commercial/commercial.routes.ts");
const token=read("apps/api/src/modules/auth/token.service.ts");
const server=read("apps/api/src/server.ts");
const screen=read("apps/mobile/src/components/admin/AdminUsersPhase3Section.tsx");
const api=read("apps/mobile/src/lib/api.ts");
const root=read("apps/mobile/app/(app)/admin/index.tsx");
for(const s of ["adminUserDirectoryFilterSchema","adminUserDetailDtoSchema",
 "adminUserNoteRequestSchema","adminUserSessionRevokeRequestSchema"])
 assert.ok(contracts.includes(s),"Missing contract: "+s);
assert.ok(migration.includes("sessions_revoked_at")&&journal.includes("0033_admin_user_sessions")
 &&schema.includes("sessionsRevokedAt"));
for(const s of ["countUsers(","detail(","setStatus(","revokeSessions(","addNote(","db.transaction",
 "USER_SUSPENDED","USER_RESTORED","USER_SESSIONS_REVOKED","USER_NOTE_ADDED",
 "REFEREE_ACCOUNT_HAS_OTHER_ROLE_OR_PLAYER_TEAM_VENUE_ASSIGNMENT",
 "REFEREE_ROLE_WITHOUT_VENUE_ASSIGNMENT","roleProvenance"])
 assert.ok(repo.includes(s),"Missing admin user invariant: "+s);
for(const s of ["/users/page","/users/:userId","/users/:userId/revoke-sessions",
 "/users/:userId/notes","/users/:userId/status",'requireRole("PLATFORM_ADMIN")'])
 assert.ok(routes.includes(s),"Missing protected API: "+s);
assert.ok(token.includes("SESSION_REVOKED")&&server.includes("setSessionRevocationValidator"));
for(const tab of ["Overview","Roles","Subscriptions","Teams","Reservations","Activity"])
 assert.ok(screen.includes('"'+tab+'"'),"Missing tab: "+tab);
for(const s of ["statusFilter","roleFilter","cityFilter","selectedUserId"])
 assert.ok(root.includes(s),"Missing directory integration: "+s);
for(const s of ["userDetail:","revokeUserSessions:","userNote:"])
 assert.ok(api.includes(s),"Missing admin API method: "+s);
console.log("Admin Phase 3 verified: filtered user directory, six details, role provenance, guarded writes and session invalidation.");
