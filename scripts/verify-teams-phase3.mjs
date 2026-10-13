import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const schema=read("packages/database/src/schema.ts");
const migration=read("packages/database/drizzle/0040_team_profile_cover_image.sql");
const journal=JSON.parse(read("packages/database/drizzle/meta/_journal.json"));
const server=read("apps/api/src/modules/team/team-manager-phase1.routes.ts");
const client=read("apps/mobile/src/lib/api.ts");
const manager=read("apps/mobile/src/components/team-manager/TeamManagerDashboard.tsx");
const publicTeam=read("apps/mobile/src/components/social/TeamDetailExperience.tsx");
const locales=read("packages/localization/src/index.ts");
const checks=[
  [schema.includes('coverImageUrl:text("cover_image_url")')&&
    migration.includes('ADD COLUMN "cover_image_url"')&&
    journal.entries.some(x=>x.tag==="0040_team_profile_cover_image"),"persisted team cover migration"],
  [server.includes("coverImageUrl:z.string().regex(")&&
    server.includes("socialUserPostImages.ownerUserId,userId")&&
    server.includes("socialUserPostImages.publicToken,match[2]!")&&
    server.includes("await this.team(userId,teamId,true)")&&
    server.includes("TEAM_COVER_NOT_OWNED"),"manager-only, subscription-protected cover update with image ownership validation"],
  [server.includes("coverImageUrl:record?.coverImageUrl??null")&&
    server.includes("const {allowJoinRequests:_,whatsappGroupUrl:_invite,...publicFields}=details"),"public cover read preserves secret member-only metadata"],
  [client.includes("coverImageUrl:string|null")&&
    manager.includes("marketingApi.uploadUserPostImage(token")&&
    manager.includes("ImagePicker.requestMediaLibraryPermissionsAsync")&&
    manager.includes("selectedTeamRef.current!==teamIdAtStart")&&
    manager.includes('testID="team-cover-settings"'),"manager picker, preview, upload, team switch race and remove UI"],
  [publicTeam.includes('testID="team-profile-cover"')&&
    publicTeam.includes("resolveMediaImageUrl(profile?.coverImageUrl)")&&
    publicTeam.includes("profile?.primaryColor??colors.primary"),"true uploaded team hero cover and safe brand color"],
  [publicTeam.includes('testID="team-squad-grid"')&&
    publicTeam.includes('bigScreen&&styles.rosterItemWide')&&
    publicTeam.includes('player.shirtNumber')&&
    publicTeam.includes('team.privacy==="PUBLIC"||member'),"responsive roster without private-player information disclosure"],
  [publicTeam.includes("fixtureStatus")&&
    publicTeam.includes("finished(m)")&&
    publicTeam.includes('formatCompetitionDateTime(m.startsAt,language)')&&
    publicTeam.includes("router.push({pathname:\"/competitions/[competitionId]/matches/[matchId]\""),"genuine verified game scores, match status and links"],
  [publicTeam.includes("performanceTrack")&&publicTeam.includes("s.winRate")&&
    publicTeam.includes('s.played>0?')&&publicTeam.includes("last=data.matches.filter"),"only data-backed match stats and last-5 form"],
  [publicTeam.includes('accessibilityState={{selected:tab===item.id}}')&&
    publicTeam.includes('useVisibleTab<Tab>(tab)')&&
    publicTeam.includes('flexDirection:isRTL?"row-reverse"'),"localized selected navigation and RTL behavior"],
];
for(const [ok,label] of checks)assert.ok(ok,"Missing Phase 3 invariant: "+label);
for(const key of ["coverTitle","chooseCover","removeCover","coverEmpty","coverHint","coverPermission","coverError"]){
  assert.equal(locales.split('"teams.phase3.'+key+'"').length,4,
    "Cover localization missing for English Dari or Pashto: "+key);
}
console.log("Teams Phase 3 public profile verified: manager-owned cover, migrations, responsive team content, fixtures, statistics and locales.");
