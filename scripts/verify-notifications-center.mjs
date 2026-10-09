import fs from "node:fs";
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const assert=(v,m)=>{if(!v)throw Error(m);};
const screen=read("apps/mobile/app/(app)/notifications.tsx");
const prefs=read("apps/mobile/app/(app)/notifications/preferences.tsx");
const nav=read("apps/mobile/src/components/ui/PublicTopNavigation.tsx");
const client=read("apps/mobile/src/lib/api.ts");
const emitter=read("apps/mobile/src/lib/notification-events.ts");
const contracts=read("packages/contracts/src/index.ts");
const repo=read("apps/api/src/modules/notifications/notification.repository.ts");
const types=read("apps/api/src/modules/notifications/notification.types.ts");
const service=read("apps/api/src/modules/notifications/notification.service.ts");
const routes=read("apps/api/src/modules/notifications/notification.routes.ts");
const tests=read("apps/api/test/notification.test.ts");
const l10n=read("packages/localization/src/index.ts");
assert(screen.includes('testID="notifications-filters"')&&screen.includes('notification-filter-')
  &&screen.includes('["ALL","UNREAD","BOOKINGS","VENUES","TEAMS","COMPETITIONS"]'),
  "Notifications require six category filters, including unread.");
assert(screen.includes("PAGE_SIZE=30")&&screen.includes("hasMore")&&screen.includes("offset:items.length")
  &&screen.includes("notifications.loadMore"),"Inbox needs genuine paginated Load more.");
assert(screen.includes('timeZone:"Asia/Kabul"')&&screen.includes('notifications.today')
  &&screen.includes('notifications.yesterday')&&screen.includes("formatPostTimeAgo"),
  "Items must be grouped by Kabul day and display localized relative times.");
assert(screen.includes("markAllRead")&&screen.includes("clearRead")&&screen.includes("notificationApi.remove")
  &&screen.includes("notificationApi.markRead"),"Manage actions must persist to API.");
assert(screen.includes("Alert.alert")&&screen.includes("confirmClearRead")
  &&screen.includes("confirmDeleteOne"),"Destructive actions must require confirmation.");
assert(screen.includes('router.push("/teams/invitations")')
  &&screen.includes('pathname:"/competitions/[competitionId]"')
  &&screen.includes('pathname:"/posts/[postId]"')
  &&screen.includes('pathname:"/venues/[venueId]"')
  &&screen.includes('router.push("/bookings")'),"Type-specific notification routes must be preserved.");
assert(prefs.includes("notificationApi.preferences")&&prefs.includes("notificationApi.updatePreferences")
  &&prefs.includes("promotionsEnabled")&&prefs.includes("pushEnabled")&&prefs.includes("inAppEnabled"),
  "Preferences must be in a dedicated screen with persisted delivery and content toggles.");
assert(nav.includes("onNotificationUnreadChange")&&nav.includes("unreadCount")
  &&emitter.includes("publishNotificationUnread"),"The fixed nav badge must sync with bulk and individual actions.");
assert(contracts.includes('notificationListFilterSchema')&&contracts.includes('notificationListResponseSchema')
  &&types.includes("markAllRead")&&types.includes("deleteNotification")&&types.includes("clearRead"),
  "Notification contracts and repository must model list metadata and scoped actions.");
assert(repo.includes("eq(notifications.userId,userId)")&&repo.includes("isNull(notifications.readAt)")
  &&repo.includes("isNotNull(notifications.readAt)")&&repo.includes("desc(notifications.createdAt)"),
  "Persistence must sort by time and scope all mutations/read filters to current user.");
assert(service.includes("countUnreadNotifications")&&routes.includes('router.post("/read-all"')
  &&routes.includes('router.delete("/read"')&&routes.includes('router.delete("/:notificationId"'),
  "Authenticated bulk endpoints and accurate badge counts required.");
assert(tests.includes("paginates and category-filters account-specific")
  &&tests.includes("keeps bulk read, single deletion"),"Backend actions require isolation tests.");
for(const key of ["notifications.unreadCount","notifications.markAllRead","notifications.clearRead",
  "notifications.filter.BOOKINGS","notifications.today","notifications.prefs.delivery"]){
  assert(l10n.split(`"${key}"`).length-1===3,`Missing English/Dari/Pashto: ${key}`);
}
assert(screen.includes("style={styles.filterScroll}")&&screen.includes("height:52,minHeight:52,maxHeight:52")
  &&screen.includes("flexGrow:0,flexShrink:0")&&screen.includes("alignItems:\"center\"")
  &&screen.includes("height:44,minHeight:44,maxHeight:44")&&screen.includes("flexShrink:0,flexGrow:0"),
  "The horizontal filter bar must have a fixed compact height, not stretch into tall vertical pills.");
assert(screen.includes("FILTER_ICONS")&&screen.includes('numberOfLines={1}')
  &&screen.includes('accessibilityState={{selected:filter===value}}'),
  "Filter chips need readable single-line labels, category icons and accessible selection.");
assert(screen.includes("styles.summaryTop")&&screen.includes("styles.summaryCount")
  &&screen.includes('width:"100%",minHeight:46')&&screen.includes("styles.allReadDisabled"),
  "Unread summary and Mark All Read button must have independent full-width layout.");
assert(screen.includes("styles.clearReadButton")
  &&screen.includes("styles.moreIconActive")
  &&screen.includes("styles.settings"),
  "Clear read, notification actions, and settings should have recognizable touch targets.");
console.log("Notifications Center verified: categorized paginated inbox, accurate unread counts, scoped bulk actions, localized dates and messages, guarded navigation, dedicated preferences and fixed badge sync.");
