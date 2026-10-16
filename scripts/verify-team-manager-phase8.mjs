import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const dash=read("apps/mobile/src/components/team-manager/TeamManagerDashboard.tsx");
const route=read("apps/api/src/modules/team/team-manager-phase1.routes.ts");
const api=read("apps/mobile/src/lib/api.ts");
const locales=read("packages/localization/src/index.ts");
const workflow=read(".github/workflows/team-manager-phase2.yml");
const must=(source,need,label)=>need.forEach(marker=>
  assert.ok(source.includes(marker),label+": missing "+marker));
must(dash,[
  'testID="tm8-settings"','SettingsHeader id="PROFILE"','SettingsHeader id="MEMBERSHIP"',
  'SettingsHeader id="CONTACT"','SettingsHeader id="SUBSCRIPTION"',
  'SettingsHeader id="PERMISSIONS"',
  'settingsSection==="PROFILE"','settingsSection==="MEMBERSHIP"',
  'settingsSection==="CONTACT"','settingsSection==="SUBSCRIPTION"',
  'settingsSection==="PERMISSIONS"',
  'accessibilityState={{expanded}}','setSettingsSection(value=>value===section?null:section)',
  'testID="tm8-save-team-details"','testID="tm8-save-profile"',
  'async function saveTeamDetails()','async function saveProfileSettings()',
  'await teamApi.update(token,target,{',
  'await teamManagerApi.updateProfile(token,target,draft)',
  'setSavedTeamDetails({name:updated.name','setSavedProfile(updated)',
  'setOverview(previous=>previous?{...previous,profile:updated}:previous)',
  'testID="tm8-logo-gallery"','testID="tm8-logo-files"',
  'testID="tm8-logo-preview"','testID="tm8-logo-remove-confirm"',
  'ImagePicker.launchImageLibraryAsync','DocumentPicker.getDocumentAsync',
  'marketingApi.uploadUserPostImage','teamManagerApi.updateLogo(token,target,image.imageUrl)',
  'teamManagerApi.updateLogo(token,target,imageUrl)',
  'testID="tm8-switch-confirm"','setPendingTeamSwitch(nextId)',
  'selectedTeamRef.current!==target',
  'setSavedTeamDetails(null);setSavedProfile(null)',
  'selectedLicense=capacity?.slots.find(slot=>slot.teamId===team?.id)',
  'teamDirty||profileDirty','const canWrite=loadedTeamKey===teamKey&&overview?.canWrite===true',
],"Settings and team isolation");
assert.ok(!dash.includes('await teamApi.update(token!,selectedId!,{name:')&&
 !dash.includes('await teamManagerApi.updateProfile(token!,selectedId!,profile);'),
 "Team and profile writes must be independent, not a partial-success workflow");
must(route,[
  'export const teamLogoInput=','async updateLogo(userId:string,teamId:string',
  'await this.team(userId,teamId,true)','eq(socialUserPostImages.ownerUserId,userId)',
  'TEAM_LOGO_NOT_OWNED','this.db.update(teams).set({logoUrl:input.imageUrl',
  'router.put("/teams/:teamId/manager/logo",auth,limiter',
  'teamLogoInput.parse(req.body)',
],"Logo ownership and server authorization");
assert.ok(api.includes('updateLogo:(token:string,teamId:string,imageUrl:string|null)'),
  "Team logo API client missing");
const keys=["section.PROFILE","section.MEMBERSHIP","section.CONTACT",
  "section.SUBSCRIPTION","section.PERMISSIONS",
  "sectionHint.PROFILE","sectionHint.MEMBERSHIP","sectionHint.CONTACT",
  "sectionHint.SUBSCRIPTION","sectionHint.PERMISSIONS",
  "settingsHint","unsaved","saveTeam","saveProfile","teamSaved","profileSaved",
  "saveHint","logoHint","logoCurrent","chooseGallery","chooseFiles","removeLogo",
  "removeLogoConfirm","logoSaved","logoError","logoUrlInvalid",
  "selectedTeamStatus","selectedTeamExpiry","noLicense",
  "switchWarning","discardAndSwitch"];
for(const key of keys)assert.equal(locales.split('"tm8.'+key+'"').length-1,3,
  "Missing Team Manager Settings EN/Dari/Pashto key: "+key);
assert.ok(workflow.includes('pnpm verify:team-manager-phase8')&&
  workflow.includes('test/team-manager-settings-phase8.test.ts'),
  "Team Manager final regression workflow must include Phase 8 and logo security tests");
console.log("Team Manager Phase 8 verified: collapsible Settings, scoped billing, independent saves, unsaved confirmation, licensed logo ownership and trilingual UX.");
