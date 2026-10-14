import assert from "node:assert/strict";
import fs from "node:fs";
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const ui=read("apps/mobile/app/(app)/notifications.tsx");
const preferences=read("apps/mobile/app/(app)/notifications/preferences.tsx");
const localization=read("packages/localization/src/index.ts");
const localeTests=read("packages/localization/src/index.test.ts");
const database=read("apps/api/src/modules/notifications/notification.repository.ts");
const fake=read("apps/api/test/fake-notification-repository.ts");
const server=read("apps/api/src/modules/notifications/notification.service.ts");
const bridge=read("apps/mobile/src/components/PushNotificationsBridge.tsx");
const deeplinks=read("apps/mobile/src/lib/notification-routing.ts");
const securityTests=read("apps/api/test/notification-phase3-polish.test.ts");
const serviceTests=read("apps/api/test/notification.test.ts");

const eventTypes=[
  "BOOKING_CONFIRMED","BOOKING_CANCELLED","BOOKING_REQUEST","TEAM_JOIN_REQUEST",
  "TEAM_JOIN_DECISION","SLOT_AVAILABLE","SLOT_PROMOTION","VENUE_POST",
  "TEAM_INVITATION","COMPETITION_UPDATE","TEAM_ACTIVITY","TEAM_CHALLENGE",
  "TEAM_ANNOUNCEMENT","ADMIN_ANNOUNCEMENT",
];
for(const event of eventTypes)
  assert.equal(localization.split('"notifications.type.'+event+'"').length-1,3,
    event+" must be labeled in English, Dari and Pashto");
for(const key of ["notifications.message.slotAvailable","notifications.message.slotPromotion",
  "notifications.body.TEAM_ACTIVITY","notifications.body.TEAM_CHALLENGE",
  "notifications.body.TEAM_ANNOUNCEMENT","notifications.body.ADMIN_ANNOUNCEMENT",
  "notifications.prefs.expoGoHint","notifications.openHint"])
  assert.equal(localization.split('"'+key+'"').length-1,3,key+" requires all three languages");

assert.ok(ui.includes('formatLocalDateTimeParts(startsAt,language)')&&
  ui.includes('t("notifications.message.slotAvailable"')&&
  ui.includes('t("notifications.message.slotPromotion"')&&
  server.includes("promotionId: input.promotionId, venueName: input.venueName"),
  "Slot alert bodies must use localized date/12-hour time and structured venue names");
assert.ok(ui.includes('item.type==="ADMIN_ANNOUNCEMENT"')&&
  ui.includes("return item.body||")&&ui.includes("setActionError")&&
  ui.includes('accessibilityState={{expanded:actionId===item.id}}'),
  "Keep authored admin messages, preserve inbox on action failure, announce expanded actions");
assert.ok(preferences.includes('Constants.appOwnership==="expo"')&&
  preferences.includes('notifications.prefs.expoGoHint'),
  "Expo Go must explain disabled native push while preserving in-app delivery");
assert.ok(database.includes('this.filtered(userId,"ALL")')&&
  database.includes("isNull(notifications.readAt)")&&
  fake.includes("if(this.notifications[index]!.readAt)return this.notifications[index]!"),
  "Inbox mutation scopes must exclude push-only events and preserve original read timestamp");
assert.ok(bridge.includes("safeNotificationDeepLink(data?.url)")&&
  deeplinks.includes("allowedRoutes")&&deeplinks.includes('value.startsWith("//")')&&
  deeplinks.includes("queryParts.length>1"),
  "Native push deep links must reject arbitrary external paths and malformed input");
assert.ok(securityTests.includes("rejects external URLs")&&
  serviceTests.includes("preserves the first read timestamp")&&
  localeTests.includes("every notification event type"),
  "Security, idempotence and trilingual regression tests must be present");
console.log("Notifications Phase 3: complete event labels, localized slot times, preservation of authored content, safe deep links, privacy and idempotence checks.");
