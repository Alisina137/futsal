import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const analytics=read("apps/mobile/app/(app)/owner/analytics.tsx");
const filters=read("apps/mobile/src/lib/owner-analytics-filters.ts");
const settings=read("apps/mobile/app/(app)/owner/settings.tsx");
const draft=read("apps/mobile/src/lib/owner-venue-settings-draft.ts");
const l10n=read("packages/localization/src/index.ts");
const navigation=read("apps/mobile/src/lib/owner-dashboard-navigation.ts");
const pkg=JSON.parse(read("package.json"));
for(const fragment of [
 "validateOwnerAnalyticsRange(nextFrom,nextTo,todayKabul())",
 "useFocusEffect(useCallback(()=>",
 "AppState.addEventListener",
 "if(request!==generation.current)return",
 "snapshot&&snapshot.token===token",
 "result.from!==nextFrom||result.to!==nextTo",
 "owner.phase7.analyticsRefresh",
 "owner.phase7.grossValueDisclaimer",
 "owner.phase7.marketingAttributionNote",
 'accessibilityRole="tab"',
])assert.ok(analytics.includes(fragment),"Analytics missing "+fragment);
for(const fragment of [
 "loadedToken.current===token&&dirtyRef.current",
 "record&&record.token===token",
 "currentToken.current!==token",
 "ownerVenueSettingsDirty(data,draft)",
 "owner.phase7.unsavedChanges",
 "owner.phase7.discardChanges",
 "data.onlineBookingEnabled&&!onlineBookingEnabled&&!pauseConfirmed",
 "owner.phase7.pauseConfirm",
 'accessibilityRole="tab"',
])assert.ok(settings.includes(fragment),"Settings missing "+fragment);
assert.ok(filters.includes("last>end"));
assert.ok(draft.includes("[...saved.amenities].sort()"));
assert.ok(!analytics.includes('label={t("phase7.analytics.promotionConversion")}'),
  "Campaign bookings per promotion must never be presented as conversion.");
for(const fragment of [
 '{key:"analysis",href:"/owner/analytics"',
 '{key:"settings",href:"/owner/settings"',
])assert.ok(navigation.includes(fragment));
for(const key of [
 "owner.phase7.analyticsRange.INVALID","owner.phase7.analyticsRange.INVERTED",
 "owner.phase7.analyticsRange.FUTURE","owner.phase7.analyticsRange.TOO_LONG",
 "owner.phase7.analyticsScopeError","owner.phase7.analyticsRefresh",
 "owner.phase7.grossValueDisclaimer","owner.phase7.marketingAttributionNote",
 "owner.phase7.unsavedChanges","owner.phase7.unsavedChangesHint",
 "owner.phase7.discardChanges","owner.phase7.pauseTitle",
 "owner.phase7.pauseDescription","owner.phase7.pauseConfirm",
 "owner.phase7.pauseCancel",
])assert.equal(l10n.split('"'+key+'"').length-1,3,"Missing EN/Dari/Pashto: "+key);
assert.ok(pkg.scripts["verify:owner-dashboard-phase7"]?.includes("venue-owner-dashboard-phase7.test.mjs"));
assert.ok(pkg.scripts.verify.includes("pnpm verify:owner-dashboard-phase7"));
console.log("Venue Owner Dashboard Phase 7 structural safety checks passed.");
