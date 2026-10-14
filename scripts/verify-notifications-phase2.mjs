import assert from "node:assert/strict";
import fs from "node:fs";
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const routes=read("apps/api/src/modules/notifications/notification.routes.ts");
const service=read("apps/api/src/modules/notifications/notification.service.ts");
const repository=read("apps/api/src/modules/notifications/notification.repository.ts");
const fake=read("apps/api/test/fake-notification-repository.ts");
const contract=read("packages/contracts/src/index.ts");
const client=read("apps/mobile/src/lib/api.ts");
const cache=read("apps/mobile/src/lib/api-cache.ts");
const screen=read("apps/mobile/app/(app)/notifications.tsx");
const nav=read("apps/mobile/src/components/ui/PublicTopNavigation.tsx");
const bridge=read("apps/mobile/src/components/PushNotificationsBridge.tsx");
const tests=read("apps/api/test/notification-phase2-reliability.test.ts");
const bookings=read("apps/mobile/app/(app)/(tabs)/bookings.tsx");
const bookingCards=read("apps/mobile/src/components/bookings/ReservationsPanel.tsx");
const calendar=read("apps/mobile/app/(app)/owner/schedule.tsx");
const manager=read("apps/mobile/src/components/team-manager/TeamManagerDashboard.tsx");
const challenge=read("apps/mobile/src/components/team-manager/TeamGrowthPanel.tsx");
for(const source of [routes,service,client])assert.ok(source.includes("cursor"),"Keyset cursor missing");
assert.ok(contract.includes("nextCursor:z.string().nullable()"),"Cursor contract missing");
assert.ok(repository.includes("this.inAppDelivery()")&&repository.includes("exists(")&&
  repository.includes('eq(notificationDeliveries.channel,"IN_APP")'),
  "Inbox and badge queries must exclude push-only deliveries");
assert.ok(fake.includes('delivery.channel==="IN_APP"')&&tests.includes("push-only"),
  "Fake repository and unit tests must model per-channel inbox visibility");
assert.ok(repository.includes("lt(notifications.createdAt,before.createdAt)")&&
  repository.includes("lt(notifications.id,before.id)")&&
  service.includes('Buffer.from(last.createdAt+"|"+last.id).toString("base64url")'),
  "Stable notification paging requires a timestamp and UUID keyset");
assert.ok(routes.includes('router.get("/unread-count"')&&
  client.includes('"/api/v1/notifications/unread-count"')&&
  nav.includes("notificationApi.unreadCount(token)")&&
  bridge.includes("notificationApi.unreadCount(accessToken)"),
  "Badge must read server-authoritative count without fetching full inbox");
assert.ok(repository.includes("isNull(notifications.readAt),this.inAppDelivery()")&&
  repository.includes("return row ? dto(row) : this.getNotification(userId,notificationId)"),
  "Read actions must be idempotent and in-app scoped");
assert.ok(cache.includes("never cache inbox or badges")&&client.includes('path.startsWith("/api/v1/notifications")'),
  "Notification requests must not read stale ten-second caches");
assert.ok(screen.includes("generation.current")&&screen.includes("mutationLock.current")&&
  screen.includes("cursor:nextCursor")&&screen.includes("result.nextCursor")&&
  screen.includes("loadMoreError")&&screen.includes("AppState.addEventListener")&&
  screen.includes("result.unreadCount"),
  "Inbox must prevent overlapping mutations and stale out-of-order pages");
assert.ok(screen.includes("loadedToken.current!==token")&&
  screen.includes("setItems([]);setTotal(0);setUnreadCount(0);setNextCursor(null)")&&
  nav.includes("badgeAccount.current=accountId"),
  "Account switching must erase previous user's inbox and badge before async requests");
assert.ok(nav.includes("AppState.addEventListener")&&nav.includes("30_000")&&
  nav.includes("generation++")&&nav.includes("clearInterval(timer)"),
  "Badge must revalidate on foreground/focus and clean up periodic checks");
assert.ok(screen.includes('pathname:"/bookings"')&&bookings.includes("focusBookingId={bookingId}")&&
  bookingCards.includes("setExpandedId(focusBookingId)")&&
  calendar.includes("focusBookingId={params.bookingId}"),
  "Bookings should open the correct owner/customer reservation record");
assert.ok(screen.includes('pathname:"/dashboard"')&&manager.includes('notificationTarget.tab==="matches"')&&
  challenge.includes("focusChallengeId===c.id"),
  "Team challenge notifications must open the correct match subtab and team");
assert.ok(screen.includes("setExpandedNoticeId("),
  "Platform announcements must expand rather than directing everyone to support");
assert.ok(tests.includes("equal timestamps")&&tests.includes("mark-read"),
  "Phase 2 regression tests must cover keyset order and unread counts");
console.log("Notifications Phase 2 verified: actor-specific in-app visibility, unread synchronization, keyset paging, race guards, and precise navigation.");
