import assert from "node:assert/strict";
import fs from "node:fs";
const read=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const root=read("apps/mobile/app/(app)/admin/index.tsx");
const nav=read("apps/mobile/src/components/admin/admin-navigation.ts");
const side=read("apps/mobile/src/components/admin/AdminSidebar.tsx");
const styles=read("apps/mobile/src/components/admin/AdminStyles.ts");
const dirs=read("apps/mobile/src/components/admin/AdminDirectorySections.tsx");
const bills=read("apps/mobile/src/components/admin/AdminBillingSection.tsx");
const ops=read("apps/mobile/src/components/admin/AdminOperationsSections.tsx");
const confirm=read("apps/mobile/src/components/admin/AdminConfirmModal.tsx");
const pagination=read("apps/mobile/src/components/admin/AdminPagination.tsx");
const api=read("apps/mobile/src/lib/api.ts");
const storage=read("apps/mobile/src/lib/auth-storage.ts");
const token=read("apps/api/src/modules/auth/token.service.ts");
const server=read("apps/api/src/server.ts");
const repo=read("apps/api/src/modules/commercial/commercial.repository.ts");
const service=read("apps/api/src/modules/commercial/commercial.service.ts");
const routes=read("apps/api/src/modules/commercial/commercial.routes.ts");
const i18n=read("packages/localization/src/index.ts");

for(const name of [
  "AdminStyles","AdminSidebar","AdminDashboardSection","AdminDirectorySections",
  "AdminBillingSection","AdminOperationsSections","AdminConfirmModal",
])assert.ok(root.includes(name),"Missing reusable section in admin root: "+name);
assert.ok(root.length<22000,"Main admin screen must stay modular, not 600+ lines.");
for(const marker of ["dashboard","users","venues","manualTeams","subscriptions",
  "configuration","support","moderation","audit"])
  assert.ok(nav.includes('"'+marker+'"'),"Lost existing admin navigation: "+marker);
assert.ok(side.includes("mobileOpen")&&side.includes("collapsed")&&
  side.includes("adminGroupHeader")&&side.includes("onSignOut"),
  "Responsive mobile/desktop admin navigation must remain usable.");
assert.ok(styles.includes("maxWidth: 1500"),"Admin responsive workspace width must remain bounded.");
for(const marker of [
  'adminApi.usersPage(token,query,page,25,controller.signal,sort,',
  'section==="venues"||section==="teams"||section==="competitions"',
  'const serial=++loadSequence.current',
  'abortController.current?.abort()',
  'if(serial===loadSequence.current)apply(data)',
  'section==="dashboard"',
  'section==="users"',
  'section==="venues"',
  'section==="subscriptions"',
  'section==="configuration"',
  'section==="audit"',
  'setQueryDraft',
  'function updateSort(',
  'futsal.admin.section',
  'function submitSearch()',
  'onPage={setPage}',
])assert.ok(root.includes(marker),"Missing independent, paged admin data load: "+marker);
assert.ok(!root.includes('loadPart("users", () => adminApi.users(token, query)'),
  "Global eager loading must not return.");
for(const marker of [
  'countUsers','countVenues','.offset((page-1)*pageSize)',
  'sql<number>','limit(pageSize)',
])assert.ok(repo.includes(marker),"Missing real database pagination: "+marker);
assert.ok(service.includes("listUsersPage")&&service.includes("listVenuesPage"));
assert.ok(routes.includes('router.get("/users/page"')&&routes.includes('router.get("/venues/page"'));
assert.ok(routes.includes('requireRole("PLATFORM_ADMIN")'),
  "Paged admin endpoints must remain role-protected.");
assert.ok(api.includes('path.startsWith("/api/v1/admin/")')&&
  api.includes('init.signal?.addEventListener("abort",externalAbort'),
  "Admin queries must bypass local cache and obey abort.");
assert.ok(storage.includes('stores.sessionStorage??null')&&
  storage.includes('stores.localStorage?.removeItem(SESSION_KEY)'),
  "Browser admin credentials must not persist in old localStorage.");
assert.ok(token.includes('setAdminRoleValidator')&&
  token.includes('ADMIN_ACCESS_REVOKED')&&
  server.includes('tokens.setAdminRoleValidator'),
  "Revoked platform-admin role must take effect on the next API request.");
assert.ok(root.includes('<AdminConfirmModal')&&
  root.includes('setPending({task,success,refresh')&&
  root.includes('async function confirmPending()')&&
  confirm.includes('visible={visible}')&&
  confirm.includes('reason.trim()'),
  "Admin writes need confirmation dialog with target, reason, error and busy state.");
assert.ok(dirs.includes('AdminPagination')&&dirs.includes('AdminStatusBadge')&&
  dirs.includes('phase7.admin.sortNewest')&&dirs.includes('phase7.admin.sortOldest'));
assert.ok(bills.includes('activateRoleSubscription')&&ops.includes('closePromotion'));
assert.ok(pagination.includes('onPage(page+1)')&&pagination.includes('onPage(page-1)'));
for(const label of ["nav.overview","nav.management","nav.commercial","nav.platform",
  "pageCount","confirm","confirmBody","normalUser","noUsers","noVenues","sortNewest","sortOldest"])
  assert.equal(i18n.split('"phase7.admin.'+label+'"').length-1,3,
    "All admin foundation labels need English, Dari, Pashto: "+label);
console.log("Admin Phase 1 verified: modular pages, responsive RTL sidebar, cursor-safe paged and cancellable live data, revocable admin auth, session-scoped credentials, confirmed writes, reusable UI and locales.");
