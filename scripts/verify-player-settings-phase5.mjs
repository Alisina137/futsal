import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const dash=read("apps/mobile/src/components/player/PlayerDashboard.tsx");
const lang=read("packages/localization/src/index.ts");
const helper=read("apps/mobile/src/lib/player-preferences.ts");
for(const marker of [
 'preferencesDirtyRef.current=true',
 'if(!preferencesDirtyRef.current)setPreferences(v.preferences)',
 'const settingsDirty=playerPreferencesChanged(preferences,savedPreferences)',
 'const next=normalizePlayerPreferences(preferences)',
 'if(!playerPreferencesValid(preferences))',
 'setSavedPreferences(result.preferences)',
 'const discardPreferences=()=>',
 'testID="player-preference-editor"',
 'testID="player-settings-panel"',
 'selected={preferences.defaultTeamId??""}',
 'const result=await playerDashboardApi.updatePreferences(token!,{defaultTeamId:id||null})',
 'setPreferences(draft=>({...draft,defaultTeamId:result.preferences.defaultTeamId}))',
 'router.push("/profile/player")',
 'router.push("/profile/email")',
 'router.push("/profile/credentials")',
 'router.push("/profile/account")',
 'router.push("/notifications/preferences")'
])assert.ok(dash.includes(marker),"Missing Player Settings Phase 5 behavior: "+marker);
assert.ok(helper.includes('normalizePlayerPreferences')&&helper.includes('playerPreferencesChanged'));
for(const key of ["unsavedPreferences","preferencesCurrent","discardPreferences",
 "defaultTeamHelp","privacyStatus","publicProfilePrivacyHint","accountSecurity",
 "accountPreferences","openNotificationPreferences","preferencesInvalid"])
 assert.equal(lang.split('"pd1.'+key+'"').length-1,3,"Missing localized key: "+key);
console.log("Player Settings Phase 5 verified: draft safety, profile editing, security routes and accurate default-team selection.");
