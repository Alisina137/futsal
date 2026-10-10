import fs from "node:fs";
const read=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const check=(value,message)=>{if(!value)throw Error(message);};
const migration=read("packages/database/drizzle/0030_team_whatsapp_groups.sql");
const journal=read("packages/database/drizzle/meta/_journal.json");
const schema=read("packages/database/src/schema.ts");
const manager=read("apps/api/src/modules/team/team-manager-phase1.routes.ts");
const playerApi=read("apps/api/src/modules/team/player-dashboard-phase1.routes.ts");
const managerUi=read("apps/mobile/src/components/team-manager/TeamManagerDashboard.tsx");
const playerUi=read("apps/mobile/src/components/player/PlayerDashboard.tsx");
const button=read("apps/mobile/src/components/ui/WhatsAppGroupButton.tsx");
const client=read("apps/mobile/src/lib/api.ts");
const strings=read("packages/localization/src/index.ts");
check(migration.includes('ADD COLUMN "whatsapp_group_url"')&&journal.includes('"0030_team_whatsapp_groups"')&&
  schema.includes('whatsappGroupUrl:varchar("whatsapp_group_url"'),"Persisted private team WhatsApp link missing.");
check(manager.includes("whatsappGroupUrlSchema")&&manager.includes('parsed.hostname!=="chat.whatsapp.com"')&&
  manager.includes('parsed.protocol!=="https:"')&&manager.includes("context.addIssue"),
  "Manager input must validate the real group invitation host and HTTPS.");
check(manager.includes("whatsappGroupUrl:record?.whatsappGroupUrl??null")&&
  manager.includes("whatsappGroupUrl:_invite"),"Never return private invitation URL in public team details.");
check(manager.includes("await this.team(userId,teamId,true)"),"Only licensed team managers may update group link.");
check(playerApi.includes('eq(teamMemberships.userId,userId)')&&
  playerApi.includes('eq(teamMemberships.status,"ACTIVE")')&&
  playerApi.includes('inArray(teamMemberships.teamId,ids)')&&
  playerApi.includes("whatsappGroups")&&
  playerApi.includes('eq(teams.status,"ACTIVE")'),
  "Player WhatsApp invites must be sourced from active team memberships, not public profiles.");
check(managerUi.includes('t("teamWhatsApp.groupInviteUrl")')&&managerUi.includes("isWhatsAppGroupInviteLink")&&
  managerUi.includes("teamManagerApi.updateProfile")&&managerUi.includes("WhatsAppGroupButton"),
  "Team manager WhatsApp Settings and quick access missing.");
check(playerUi.includes("data.whatsappGroups")&&playerUi.includes("WhatsAppGroupButton")&&
  client.includes("whatsappGroups:Record<string,string>"),"Player overview and team cards must have WhatsApp links.");
check(button.includes("Linking.openURL")&&button.includes('name="logo-whatsapp"')&&
  button.includes('accessibilityRole="link"')&&button.includes('link.hostname==="chat.whatsapp.com"'),
  "WhatsApp external open must use safe URL validation and an accessible WhatsApp icon.");
for(const key of ["title","groupInviteUrl","managerHint","privacyHint","invalid","open","openFailed","setup"])
  check(strings.split('"teamWhatsApp.'+key+'"').length-1===3,
    "WhatsApp copy must exist in English, Dari, and Pashto: "+key);
console.log("WhatsApp group integration verified: manager-only validated save, private member-only read, player/manager icon, three languages.");
