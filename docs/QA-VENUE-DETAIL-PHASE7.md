# Futsal / Venue Detail — Phase 7 regression and release sign-off

**Date:** 2026-10-14 · **Scope:** Public Venue Detail, Phases 1–6. **Status:** Automated checks required in CI; native Android/iOS acceptance remains **manual and unverified** until a tester signs off. Do not claim a successful device run from a web export.

## Test commands

From the repository root:

```powershell
pnpm verify:venue-detail-phase7
pnpm verify
pnpm --filter @leaguekick/mobile exec expo export --platform web --output-dir dist-web
```

The Phase 7 gate executes pure Node tests for Kabul/other timezones, invalid dates and cross-venue responses, and checks all 21 About/Reserve/Media/Competitions/Updates subtabs and security invariants. Full `pnpm verify` re-runs the earlier Phase 1–6 gates, API integration tests, TypeScript and builds.

## Native acceptance matrix (manual)

Perform these scenarios on a **small-screen Android device and a second wider screen** in **English, Dari and Pashto**. Start with a signed-out guest, then a verified player, then venue owner and team-manager accounts. Verify the visual RTL direction, active-tab horizontal auto-focus and scroll preservation as each subtab is selected. Record device, OS, build, exact steps, outcome and screenshot for every failure.

| Area | Required acceptance checks |
| --- | --- |
| Navigation and deep links | Open venue normally: Media > Posts. Tap every main tab and all subtabs, scroll menus left/right on narrow screens; switch back and check per-tab subtab retention. Location button opens About > Location, Alerts shortcut opens Updates > Alerts, Reserve button and deep-linked promotions open slots; review booking link opens About > Reviews. Change venue ID quickly while responses are delayed and verify no old venue content appears. |
| Media | View all six post filters and both sorts with 0/1/15+ posts. Check Photos full-screen close and previous/next, video playback/invalid external link and native share sheet, post comments and offer/competition CTAs. Private, draft and followers-only posts must never appear in guest view. Switch accounts while media pages are loading. |
| Reserve | Check Week/Day/Month, owner-paused and instant/pending modes, actual server price/availability, duplicate tapping and cancellation. Simulate slow response for venue A, switch to B with same date: no A slots must appear. Check invalid dates (2026-02-29, 2026-04-31, out-of-window), local-midnight boundaries, offline cache showing read-only, and online revalidation before confirming an offer. Switch accounts during bookings fetch or review posting. |
| Competitions | Check Registration Open, Upcoming, Live, Completed and Matches > Upcoming/Results; verify default, 1/12/13+ results, load more and failed later-page fetch keeping previous cards. Ensure matches are physically at this venue; no unpublished competitions or future unannounced scores. Test manager registration eligibility, detail and match deep links, 88px square thumbnail on the left. |
| Updates | Test anonymous announcements, follower-only announcement visibility after follow/unfollow, schedule exceptions (closures/special hours), no-exception empty state and real-time slot authority. Alert list only shows notices delivered to current account for that venue; mark read, open, unread badge sync and network failure. Global notification settings must not imply per-venue muting. |
| About | Check owner-editable amenities, hours/rates, verification badge only for verified venues, coordinates/maps and optional public contact. Check reviews summary, sorting, pages and eligible booking selection; prior user's review form must not survive sign-out/account switch. No invented hours or amenities. |
| UI and safety | Tap with larger accessibility font; confirm no overlapping text, controls remain reachable with screen reader and narrow width. EN/Dari/Pashto labels all resolve. Confirm 12-hour AM/PM date/time display and no +04:30 string. On reconnect, resume and fast switching, loading and error states should be stable. |

## Release sign-off criteria

1. All GitHub Release Readiness checks for the exact PR head commit pass, including API tests, mobile typecheck and web export.
2. No new migrations in Phase 7; earlier Phase 2 schema migration must already be applied before running the corresponding API.
3. Device matrix is fully executed by a human tester. Record failures as new issues, fix and rerun the affected flow and full `pnpm verify`.
4. Verify local working-tree changes are preserved before `git pull origin main`. Never claim production release readiness until physical-device checks are signed off.
