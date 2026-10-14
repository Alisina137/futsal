# Notifications — Phase 3: Final polish and release regression

## Shipped changes
- All 14 supported notification **type labels** now have explicit English, Dari and Pashto translations. Missing labels for team activity, team challenge, team announcement and administrator announcement no longer show translation keys.
- Watched-slot notifications show Afghanistan-local date and **AM/PM** time, rather than backend ISO timestamp text. Promotion notifications use translated sentences when a venue name is present; backend publishes the structured venue name for new promotions. Existing authored content (competition names, team announcement body, administrator announcements) is preserved as written rather than falsely translated.
- Clear localized notice in Expo Go that **remote push requires a native development/production build** and FCM/APNs/EAS setup. In-app notifications remain available in Expo Go.
- Recoverable action errors appear inline while loaded notification cards remain visible. More-actions button exposes its expanded state to accessibility services.
- IN_APP read/delete access is consistently restricted to IN_APP-delivered notifications; push-only deliveries are not mutatable through inbox endpoints. Repeating mark-read preserves the original read time. No new schema migration.
- External native push payloads are routed only to allowlisted Futsal paths, rejecting hostile schemes, traversal and malformed paths.
- Tests: localization test exercises every type and 12-hour template in all three languages; API tests verify idempotent read timestamps and push-only isolation; native deep-link parser tests valid vs hostile destinations. Root `pnpm verify:notifications-phase3` is included in full `pnpm verify`.

## Roles and outcomes to test

| Actor | Trigger | Expected inbox and navigation | Should not receive |
| --- | --- | --- | --- |
| Normal user / player | Online booking pending | Player sees status in bookings; owner gets booking approval notification | Other venue owners |
| Venue Owner | Pending booking at owned venue | Bookings category, link to owner schedule approvals | Other venue owners or private user data |
| Team Manager | User applies to join managed team | Teams category, manager opens correct team manage screen | Non-manager team members |
| Applicant | Manager accepts/rejects join | Teams category, applicant opens team page | Unrelated users, other applicants |
| Team member | Team activity/challenge/announcement | Correct localized type label, authored body, appropriate destination | Outsiders |
| Venue follower | Promoted slot/post | Venue category, named venue and localized generic text | Non-followers |
| Competition follower | New published competition event | Competitions category, competition link | Private competition content |
| Platform Admin | Administrative announcement | Authorized recipient sees system notification and authored message | Unselected audiences |

## Acceptance checklist (physical-device and browser required)
1. **Languages:** switch English → Dari → Pashto and navigate All, Unread, Bookings, Venues, Teams, Competitions; verify all 14 translated titles, no `notifications.type.*` keys displayed, and real author-written content is not replaced. Verify layout mirrors in RTL without clipped icons, counters or long titles. Verify full text accessibility at large text sizes.
2. **Kabul dates:** create a watched-slot alert on an evening appointment. It must show a Kabul-local date and `06:30 PM` style clock (not `18:30`, `Z`, `+04:30`, or raw ISO). Check Today/Yesterday around midnight Afghanistan time.
3. **Account isolation:** create notifications for two accounts, sign out / sign in, switch across roles. No stale badge or notifications may appear for the previous actor. Attempt to read/delete someone else's notification ID; API must reject it.
4. **Channel preferences:** In-App off + Push on must never create a visible inbox record; existing in-app notices stay visible after turning In-App off. Neither single read nor bulk read/clear may modify push-only records. Promotions, posts and invites respect user-selected content preferences.
5. **Read and delete:** read a notification twice, verify original read timestamp is unchanged. Mark-all, delete one and clear-read must maintain correct unread counts. Confirm destructive actions display a confirmation prompt. A temporary badge-count network failure must not falsely reverse a successful read.
6. **Paging/network:** create >30 notices; Load more. While page 2 is loading, generate a new event and verify existing cards aren't duplicated. Disconnect the API, attempt Load more, see inline Retry without losing loaded cards. Reconnect and retry. Return app from background, verify foreground refresh and unread badge.
7. **Navigation:** tap booking, owner approval, team invite/join request, team activity, promotion, venue post and competition updates. All routes must be correct and authorized. Invalid push URL (remote domain, traversal) must be rejected.
8. **Accessibility:** VoiceOver / TalkBack announce notification title+body, expanded more-action state, filter selection and unread counts. Check 200% text size without card clipping, small screen and RTL layouts.
9. **Native push:** On Android/iOS **development or production build** (not Expo Go), configure EAS project id, FCM v1 and APNs, grant OS permission, enable push. Verify background/terminated taps and token rotation, and disabled notification settings. Run worker transport retry tests and inspect admin delivery status. Expo ticket acceptance **does not prove handset delivery**.

## CI commands
```powershell
cd C:\projects\futsal
pnpm install --frozen-lockfile
pnpm verify:notifications-phase3
pnpm --filter @leaguekick/api test
pnpm --filter @leaguekick/localization test
pnpm verify
```

## Release gates and known limitations
- Automated tests, app typecheck, web export and build must pass in GitHub Release Readiness. No native EAS build or real-device FCM/APNs delivery can be certified from repository CI.
- Native OS push text is currently generated on the backend, primarily in English; the in-app Notification Center translates app-owned event types and structured messages. Translating unstructured, user-authored announcements into other languages is intentionally **not attempted**.
- Testing on Android physical devices, iOS, and real push infrastructure is still a required release acceptance task. No push token, device credential or account fixture should be committed.
