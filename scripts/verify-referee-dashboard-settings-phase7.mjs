import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const schema=read("packages/database/src/schema.ts");
const sql=read("packages/database/drizzle/0044_referee_settings_availability.sql");
const journal=JSON.parse(read("packages/database/drizzle/meta/_journal.json"));
const server=read("apps/api/src/modules/referee/referee.routes.ts");
const calendar=read("apps/mobile/src/lib/referee-calendar.ts");
const settings=read("apps/mobile/src/lib/referee-settings.ts");
const picker=read("apps/mobile/src/components/referee/RefereeExceptionDatePicker.tsx");
const screen=read("apps/mobile/src/components/referee/RefereeDashboard.tsx");
const api=read("apps/mobile/src/lib/api.ts");
const locale=read("packages/localization/src/index.ts");
const pkg=JSON.parse(read("package.json"));
const check=(content,markers,label)=>{
  for(const part of markers)assert.ok(content.includes(part),label+": "+part);
};
check(schema,['acceptingAssignments:boolean("accepting_assignments").notNull().default(true)'],"Persisted state");
check(sql,['ADD COLUMN IF NOT EXISTS "accepting_assignments" boolean NOT NULL DEFAULT true'],"Migration");
assert.ok(journal.entries.some(entry=>entry.idx===44&&entry.tag==="0044_referee_settings_availability"));
check(server,['acceptingAssignments:z.boolean().default(true)',
 'Only one interval may be configured for each day.', 'Invalid calendar date.',
 'profile?.acceptingAssignments??true', 'if(!acceptingAssignments||!(end>start))return false',
 'if(slots.length===0)return false', 'acceptingAssignments:row?.acceptingAssignments??true'],
 "Authoritative availability server");
check(calendar,['if(profile.acceptingAssignments===false)return "UNAVAILABLE"',
 'if(profile.weeklyAvailability.length===0)return "UNAVAILABLE"'],"Availability preview");
check(api,['acceptingAssignments:boolean;'],"Typed contract");
check(settings,['refereeSettingsChanged(', 'refereeSettingsIssue(', 'refereeExceptionMonth('],
 "Draft and date validation");
check(picker,['calendar:language==="en"?"gregory":"persian"', 'formatRefereeCalendarPeriod(',
 'testID="referee-exception-date-open"'],"Localized date picker");
check(screen,['referee-assignment-availability-toggle','settingsDirty','settingsExitTarget',
 'referee-settings-unsaved','referee-settings-exit-guard','RefereeExceptionDatePicker',
 'saveSettings()', 'discardSettings()', 'openSettingsPage(','"/notifications/preferences"'],
 'Settings view');
for(const name of ["settingsAccepting","settingsAcceptingOn","settingsAcceptingPaused",
 "settingsNoWeeklyDays","settingsUnsaved","settingsLeaveWarning","settingsKeepEditing",
 "settingsDiscard","settingsSaveFirst","settingsNotificationPrefs","settingsPickDate",
 "settingsDateToday","settingsValidation.years","settingsValidation.weeklyRange",
 "settingsValidation.duplicateDay","settingsValidation.date","settingsValidation.duplicateDate",
 "settingsValidation.limit"]){
 assert.equal(locale.split('"rf1.'+name+'"').length-1,3,"Missing translated label "+name);
}
assert.ok(pkg.scripts["verify:referee-dashboard-settings-phase7"]
 .includes("scripts/tests/referee-dashboard-settings-phase7.test.mjs"));
assert.ok(pkg.scripts.verify.includes("pnpm verify:referee-dashboard-settings-phase7"));
console.log("Referee Phase 7 source audit passed: pause, strict schedule, calendar, unsaved changes, localization and notifications.");
