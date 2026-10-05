# Phase 8 Test Plan — Release Readiness

## Goal

Demonstrate that the Android pilot is safe to distribute to real pilot users under the product specification. Automated verification is necessary but not sufficient; device, connectivity, monitoring and restore exercises must also be recorded.

## Automated gate

```powershell
pnpm verify
```

Phase-specific invariant gate:

```powershell
pnpm verify:phase8
```

The integrated CI workflow repeats the repository verification from a clean install.

## Critical E2E journeys

Exercise each journey on the preview APK against a pilot API/database:

1. Player discovers a venue, opens availability and confirms a slot.
2. Two player sessions race for the same slot; exactly one booking wins.
3. Owner creates a manual booking and the slot disappears from public availability.
4. Owner blocks a slot and public booking cannot overlap it.
5. Owner promotes an empty slot; player follows the CTA and books the authoritative slot/price.
6. Trial expires; owner enters continuity mode and cannot create new Premium inventory.
7. Platform admin records reactivation; owner capability returns without data loss.
8. Owner attempts to create a second venue and is blocked.
9. League runs from setup through results and deterministic standings.
10. Knockout runs through bracket progression and champion.
11. Group→Knockout qualification generates the correct bracket.
12. Team invite is accepted and the manager registers the team for a competition.
13. During a booking write, disconnect the network. Confirm no blind automatic POST retry occurs; after reconnect, refresh authoritative bookings/availability before trying again.
14. Navigate the primary player/owner flows in Dari and Pashto and confirm RTL direction, readable numbers/IDs, and no untranslated keys.
15. Suspend a venue with upcoming bookings. Confirm it is no longer publicly bookable while existing obligations remain visible to the owner.

## Resilience / low connectivity

- Start offline with a previously stored authenticated session: network failure must not clear the session.
- Verify the offline banner is announced and visible.
- Reconnect and verify the back-online state.
- Force a GET timeout/503 and confirm the client performs at most one bounded read retry.
- Force a booking/write timeout and confirm the client does not automatically replay the write.
- Verify Support & diagnostics reports only safe information and a request ID when available.
- Force an unexpected render error in a development/pilot build and confirm the localized safe recovery screen does not show stack/error text.

## Accessibility and device matrix

Check at minimum:

- small Android phone;
- representative modern Android phone;
- tablet/large layout where supported;
- Android font size increased substantially;
- TalkBack on login, booking, owner schedule, competition and settings/support;
- focus/reading order in English, Dari and Pashto;
- all interactive controls have understandable labels;
- touch targets remain at least 48dp;
- form validation is announced;
- critical statuses are conveyed by text, not color alone;
- keyboard does not cover required form actions.

## Performance

Record on a representative pilot device/network:

- cold launch reaches usable navigation without an indefinite blank screen;
- venue/availability/schedule screens show a loading state and recover from slow responses;
- scrolling common lists remains usable;
- no repeated background request loop occurs;
- API logs show request duration so slow endpoints can be identified.

This phase does not invent a numeric SLA without pilot measurements. Capture baseline timings during pilot and set operational thresholds from observed data.

## Security

- Production config rejects wildcard CORS.
- Production config rejects obvious/short token secrets.
- CORS denies an unapproved browser origin.
- Security headers are present.
- API error bodies contain safe request IDs rather than stack traces.
- Private/API responses are no-store.
- Refresh rotation/replay rejection remains green.
- Suspended-user live token validation remains green.
- Role/object/tenant isolation tests from prior phases remain green.
- Inspect repository and release environment for accidental secrets before distribution.

## Monitoring

Against the deployed pilot API:

1. `/health` returns 200 and the expected version.
2. `/ready` returns 200.
3. Stop or isolate database access in a controlled non-production environment and confirm readiness returns 503 without the database error.
4. Confirm request logs contain request ID/method/normalized path/status/duration and no Authorization/body values.
5. Trigger a known 4xx and correlate the mobile/server request ID.

## Backup / restore

1. Create a backup with `scripts/backup-postgres.ps1`.
2. Restore it only into an isolated database using `scripts/restore-postgres.ps1 -ConfirmRestore`.
3. Run API readiness and representative data smoke checks against the restored database.
4. Record date, backup identifier and result in the release signoff.

Do not mark backup/restore validation complete based only on the existence of the scripts.

## Android release

- `app.json` version/package/icon configuration reviewed.
- Preview EAS APK created from the release commit.
- Real device E2E matrix passed.
- Store icon, adaptive icon and feature graphic reviewed.
- Real screenshots captured from the verified APK.
- Support email configured.
- Privacy notice published at a public URL.
- Production AAB created only after go/no-go approval.

## Go / no-go rule

Phase 8 implementation may be marked **implemented** when `pnpm verify` is green. The product may be marked **pilot-ready** only when all critical E2E journeys, device/RTL/accessibility checks, monitoring check, backup/restore drill, preview APK install and operator-owned store/support/privacy fields are signed off. Any critical booking integrity, authorization, data-loss, secret-exposure or crash-on-launch defect is a no-go.
