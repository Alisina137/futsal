# Competition Detail — Phase 2: Header, Home Overview and Real-time Preview UX

Date: 2026-10-15. Phase 2 follows the seven-tab foundation and privacy safeguards of Phase 1.

## Delivered
- **Native sharing:** accessible Share icon in the competition cover, using the actual event title, hosting venue and `leaguekick://competitions/{id}` app deep link. System sheet cancellation is not claimed as a successful share. Share-sheet failures surface existing error UI. The app does not invent a web booking URL.
- **Status-led hero:** existing cover (real organizer cover or published-media fallback), logo, competition identity, format/status indicators, hosting venue, follow/unfollow and total followers remain. Unauthenticated visitors can open Sign in to follow. Existing participants and venue owners retain server-gated capabilities. Header CTA now navigates directly to an eligible registration subtab, live games, verified results, upcoming fixtures, or the unfiltered schedule as appropriate.
- **Home → Overview:** retains full About destination, competition description, status, format, accepted-team capacity, fee and scheduled dates. New verified completed/corrected result count; remaining registration places appear only while registration is genuinely open. No guessed fixture count or provisional live score counted as final.
- **Confirmed champion:** champion card only when competition is COMPLETED/ARCHIVED and `championTeamId` matches an actual accepted participant. An offline/manual champion is not given a broken team-profile link.
- **Next scheduled match:** real future, SCHEDULED fixture only. The compact match card uses existing route, team IDs and timestamps. Never invent a kickoff for UNSCHEDULED, POSTPONED or CANCELLED games; does not obscure actual currently live games.
- **Recent updates teaser:** at most two real published posts with original timestamps and photos, linked to **Media** for the complete feed. Home → Highlights and Media still retain the existing untruncated published update/photo experience, preserving prior Phase 4/5 regression guarantees.
- EN/Dari/Pashto strings and RTL-aware sharing/status/preview cards. No DB migrations, API modifications or dependencies.

## Verification

```powershell
pnpm verify:competition-detail-phase2
pnpm verify:competition-detail-phase1
pnpm verify:competition-profile
pnpm verify
```

Eight Node tests exercise fixture/status selection, full/expired registration, official score counting, champion publication, deep-link share copy and honest empty data. Structural checks are part of GitHub release-readiness CI.

## Outstanding on-device acceptance
1. Test Share from Android with native apps, offline/cancel/failure and a receiving app with the deep-link handler configured.
2. Validate cover/logo layout, font scaling, small screens and EN/Dari/Pashto RTL.
3. Compare public data to PostgreSQL production-like competition records for live score, expired deadline, full registration, correct champion and postponement.
4. Check guest sign-in to follow, signed-in follow/unfollow, fallback venue link and same-account return from sub-tabs.
5. Confirm next fixture opens its match details and recent posts open the complete Media feed, including when a media image is missing.
6. Verify that status/action does not imply an approved registration or incorrectly label a provisional result.

**Automated CI does not claim real Android or production-database validation.**
