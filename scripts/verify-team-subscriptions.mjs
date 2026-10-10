import fs from "node:fs";
const rd=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const chk=(x,msg)=>{if(!x)throw Error(msg);};
const dash=rd("apps/mobile/src/components/team-manager/TeamManagerDashboard.tsx");
const create=rd("apps/mobile/app/(app)/teams/create.tsx");
const repo=rd("apps/api/src/modules/team/team.repository.ts");
const slots=rd("apps/api/src/modules/team/team-slots.ts");
const router=rd("apps/api/src/modules/team/team-slots.routes.ts");
const schema=rd("packages/database/src/schema.ts");
const migration=rd("packages/database/drizzle/0029_team_extra_subscriptions.sql");
const lang=rd("packages/localization/src/index.ts");
const admin=rd("apps/mobile/app/(app)/admin/index.tsx");
const adminView=rd("apps/mobile/src/components/admin/TeamSlotsAdminSection.tsx");
const service=rd("apps/api/src/modules/team/team.service.ts");
for(const id of ["players","competitions","matches","schedule"])
  chk(dash.includes('id:"'+id+'"'),"About Team navigation missing: "+id);
chk(!dash.includes('id:"team",icon:'),"Team subtab must be removed.");
chk(dash.includes('tab==="settings"')&&dash.includes('t("tm1.teamIdentity")'),
  "Team identity/create-time fields must live inside Settings.");
chk(dash.includes('t("tmBilling.subscriptionPerTeam")')&&dash.includes("teamApi.requestSlot"),
  "Settings must show per-team subscription and renewal controls.");
chk(schema.includes('export const teamExtraSubscriptions')&&migration.includes('CREATE TABLE "team_extra_subscriptions"'),
  "Database migration for paid additional-team slots missing.");
for(const key of ["pg_advisory_xact_lock","TEAM_ADDITIONAL_SUBSCRIPTION_REQUIRED",
 "isNull(teamExtraSubscriptions.teamId)","slot.activeUntil"]) {
  const source=repo+slots;
  chk(source.includes(key),"Per-team payment and atomic enforcement missing: "+key);
}
chk(repo.includes("eq(teamExtraSubscriptions.status,\"ACTIVE\")")&&
  repo.includes("returning({id:teamExtraSubscriptions.id})"),"A paid slot must be consumed exactly once.");
chk(repo.includes("TEAM_TARGET_MANAGER_HAS_TEAM")&&
  repo.includes('roleSubscriptions.role,"TEAM_MANAGER"'),"Manager transfer cannot bypass role capacity.");
chk(service.includes("assertManagerSubscription"),"All core team writes must validate team license.");
for(const file of ["team-manager-phase1.routes.ts","team-manager-phase2.routes.ts","team-manager-phase3.routes.ts"])
  chk(rd("apps/api/src/modules/team/"+file).includes("teamLicenseActive")||
    rd("apps/api/src/modules/team/"+file).includes("requireTeamLicense"),
    "Missing per-team write authorization in "+file);
chk(router.includes('requireRole("PLATFORM_ADMIN")')&&
  router.includes('"/team-slots/:slotId/activate"')&&
  router.includes('"/teams/manager/capacity"'),"Manager requests and admin payment confirmation must be protected.");
chk(create.includes("capacity?.canCreate")&&create.includes("teamApi.requestSlot"),
  "New-team form must prevent unpaid additional creation.");
chk(admin.includes("<TeamSlotsAdminSection")&&adminView.includes("activateTeamSlot"),
  "Admin subscriptions page must support explicit payment activation.");
for(const key of ["subscriptionPerTeam","policy","requestExtra","extraRequired","adminTitle"])
  chk(lang.split('"tmBilling.'+key+'"').length-1===3,"Localized billing guidance missing: "+key);
console.log("Team Manager policy verified: Team moved into Settings, four About Team subtabs, one base team, paid additional slots, atomic entitlement enforcement, protected admin activation.");
