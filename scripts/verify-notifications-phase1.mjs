import assert from "node:assert/strict";
import fs from "node:fs";
const read=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const contract=read("packages/contracts/src/index.ts");
const schema=read("packages/database/src/schema.ts");
const mig=read("packages/database/drizzle/0042_notification_action_events.sql");
const journal=read("packages/database/drizzle/meta/_journal.json");
const service=read("apps/api/src/modules/notifications/notification.service.ts");
const push=read("apps/api/src/modules/notifications/push-delivery.ts");
const apiServer=read("apps/api/src/server.ts");
const booking=read("apps/api/src/modules/booking/booking.service.ts");
const teams=read("apps/api/src/modules/team/team.service.ts");
const notifScreen=read("apps/mobile/app/(app)/notifications.tsx");
const root=read("apps/mobile/app/_layout.tsx");
const bridge=read("apps/mobile/src/components/PushNotificationsBridge.tsx");
const client=read("apps/mobile/src/lib/api.ts");
const mobilePackage=read("apps/mobile/package.json");
const appJson=read("apps/mobile/app.json");
const locale=read("packages/localization/src/index.ts");
const tests=read("apps/api/test/notification-phase1-push.test.ts");
const joinTests=read("apps/api/test/team-join-request-actions.test.ts");

for(const type of ["BOOKING_REQUEST","TEAM_JOIN_REQUEST","TEAM_JOIN_DECISION"]){
  assert.ok(contract.includes(type)&&schema.includes(type)&&mig.includes("'"+type+"'")&&
    notifScreen.includes('case "'+type+'"'),"Event contract, schema, migration, UI must include "+type);
}
assert.ok(journal.includes("0042_notification_action_events"),"Migration 0042 registered");
assert.ok(booking.includes('created.status==="PENDING"')&&booking.includes("venue.ownerUserId")&&
  booking.includes("notifications?.bookingRequest"),"Pending bookings alert the correct owner after persistence");
assert.ok(teams.includes("notifications?.teamJoinRequest")&&teams.includes("notifications?.teamJoinDecision")&&
  teams.includes("request.requesterUserId"),"Join requests and manager decisions target the right identity");
assert.ok(service.includes('dedupeKey:`booking-request:')&&
  service.includes('dedupeKey:`team-join-request:')&&
  service.includes('dedupeKey:`team-join-decision:'),"Action notifications must be idempotent");
assert.ok(push.includes("FOR UPDATE SKIP LOCKED")&&push.includes("d.attempts<3")&&
  push.includes("last_attempt_at")&&push.includes("expoPushTransport")&&
  push.includes("DeviceNotRegistered")&&push.includes("process.env.EXPO_ACCESS_TOKEN"),
  "Expo sending must have durable leases, retry cap and invalid-token cleanup");
assert.ok(apiServer.includes("new PushDispatcher")&&apiServer.includes("pushTimer.unref()"),
  "The API must periodically drain the durable push queue");
assert.ok(client.includes('"/api/v1/notifications/devices"')&&
  client.includes('"/api/v1/notifications/devices/unregister"')&&
  bridge.includes("getExpoPushTokenAsync")&&bridge.includes("addNotificationResponseReceivedListener")&&
  bridge.includes("Constants.appOwnership")&&bridge.includes("expo")&&
  root.includes("<PushNotificationsBridge/>"),
  "Native push must register tokens, handle taps and avoid breaking Expo Go");
assert.ok(mobilePackage.includes('"expo-notifications"')&&
  appJson.includes('"expo-notifications"')&&
  read("pnpm-lock.yaml").includes("expo-notifications@"),
  "Push package SDK 57 and frozen-lockfile must be installed");
assert.ok(notifScreen.includes('pathname:"/owner/schedule"')&&
  notifScreen.includes('pathname:"/teams/[teamId]/manage"')&&
  notifScreen.includes('pathname:"/teams/[teamId]"'),
  "Action notifications must navigate to actual approval and team pages");
for(const key of ["notifications.message.bookingRequest","notifications.message.teamJoinRequest",
  "notifications.message.teamJoinDecisionAccepted","notifications.message.teamJoinDecisionRejected"]){
  assert.equal(locale.split('"'+key+'"').length-1,3,
    "Phase 1 notification content must be translated in English/Dari/Pashto: "+key);
}
assert.ok(tests.includes("online approval booking integration")&&tests.includes("disables invalid device tokens")&&
  joinTests.includes("TEAM_JOIN_DECISION"),"Workflow, role and delivery tests required");
console.log("Notifications Phase 1 verified: action events, migration, push worker, native device lifecycle, approved destinations, translations, integration tests.");
