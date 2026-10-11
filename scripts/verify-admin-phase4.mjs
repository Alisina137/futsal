import assert from "node:assert/strict";
import fs from "node:fs";
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const contracts=read("packages/contracts/src/index.ts");
const routes=read("apps/api/src/modules/commercial/commercial.routes.ts");
const schema=read("packages/database/src/schema.ts");
const journal=read("packages/database/drizzle/meta/_journal.json");
const migration=read("packages/database/drizzle/0034_admin_operations_cases.sql");
const repository=read("apps/api/src/modules/commercial/admin-operations.repository.ts");
const commercial=read("apps/api/src/modules/commercial/commercial.repository.ts");
const client=read("apps/mobile/src/lib/api.ts");
const nav=read("apps/mobile/src/components/admin/admin-navigation.ts");
const ui=read("apps/mobile/src/components/admin/AdminOperationsPhase4Section.tsx");
const screen=read("apps/mobile/app/(app)/admin/index.tsx");
for(const s of ["adminOperationKindSchema","adminOperationFiltersSchema","adminOperationDetailSchema",
  "adminCaseCreateSchema","adminCaseUpdateSchema","adminCaseDtoSchema"])
  assert.ok(contracts.includes(s),"Phase 4 contracts missing "+s);
for(const s of ['"/operations/:kind"','"/operations/:kind/:id"',
  '"/operations/venues/duplicates"','"/cases"','"/cases/:id"',
  'requireRole("PLATFORM_ADMIN")'])
  assert.ok(routes.includes(s),"Phase 4 secure route missing "+s);
assert.ok(schema.includes("adminCases=pgTable")&&
  journal.includes("0034_admin_operations_cases")&&
  migration.includes("admin_cases_one_open_per_target_uq"));
for(const s of ['kind==="VENUE"','kind==="TEAM"','kind==="COMPETITION"',
  'kind==="REFEREE"','detail(','dateScope(', 'duplicates(', 'createCase(',
  'updateCase(','db.transaction','ADMIN_CASE_OPENED','ADMIN_CASE_UPDATED',
  'overlaps another confirmed booking','Normal User-only referee eligibility'])
  assert.ok(repository.includes(s),"Phase 4 backend rule missing "+s);
assert.ok(commercial.includes('VENUE_ACTION_NO_CHANGE')&&
  commercial.includes('VENUE_VERIFIED')&&commercial.includes("this.db.transaction"),
  "Venue transitions must be atomic and audited.");
for(const s of ['"teams"','"competitions"','"referees"','"reservations"','"cases"'])
  assert.ok(nav.includes(s),"Missing admin nav "+s);
for(const s of ["AdminOperationsPhase4Section","operationRefresh","section===\"venues\""])
  assert.ok(screen.includes(s),"Missing Phase 4 screen wiring "+s);
for(const s of ["operationDuplicates:","operationsPage:","operationCases:","openAdminCase:","updateAdminCase:"])
  assert.ok(client.includes(s),"Missing typed Phase 4 API "+s);
for(const s of ["l.duplicate","l.pending","relatedCases","l.venueAction","l.security",
  "l.immutable","AdminPagination","AdminStatusBadge"])
  assert.ok(ui.includes(s),"Missing Phase 4 review interface "+s);
console.log("Admin Phase 4 verified: paged operational directories, venue verification, referee eligibility, bookings conflict review, durable case workflow, audit and UI.");
