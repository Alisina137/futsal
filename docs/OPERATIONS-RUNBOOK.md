# Futsal Pilot Operations Runbook

## Purpose

This runbook defines the minimum operational procedure for the Phase 8 Android pilot. It covers deployment checks, health/readiness, monitoring, incident handling, database backup/restore, and rollback. It intentionally contains no production credentials.

## Release preflight

Before deploying an API or distributing a new Android build:

```powershell
pnpm install --frozen-lockfile
pnpm verify
git status
```

The release commit must be clean and the production environment must provide:

- `NODE_ENV=production`
- pooled `DATABASE_URL` using TLS verification
- a unique high-entropy `ACCESS_TOKEN_SECRET` of at least 48 characters
- explicit HTTPS `CORS_ORIGIN` values; wildcard CORS is rejected in production
- `APP_VERSION` matching the release
- `REQUEST_LOGGING=true` unless temporarily disabled for a documented incident

Do not place production secrets in `EXPO_PUBLIC_*` variables, source files, CI logs, screenshots, or support tickets.

## Local development: API and ngrok

Run from `C:\projects\futsal`:

```powershell
pnpm dev:api
```

The launcher first starts Express on `API_PORT` (4000 by default), confirms
`http://127.0.0.1:4000/health` and the database-backed `/ready`, then
starts ngrok. The API's console messages remain visible; ngrok's interactive
console is not permitted to cover them. The local API keeps running when
ngrok is unavailable or exits. Press **Ctrl+C** to stop both processes.

If you see **API never returned /health**, run the API directly to expose its
startup error:

```powershell
pnpm --filter @leaguekick/api dev
```

Check the root `.env` (`DATABASE_URL`, `API_PORT`, token secrets), install
dependencies and apply pending migrations. If `/health` succeeds but
`/ready` fails, troubleshoot PostgreSQL connectivity; ngrok will not
publish an unready API. If port 4000 is occupied, find its owner:

```powershell
Get-NetTCPConnection -LocalPort 4000
```

Use `EXPO_PUBLIC_API_URL` with the printed HTTPS ngrok URL for a mobile
device; do not use an unrelated tunnel from a previously running ngrok.
Do not expose test APIs or fixtures against a production database.

## Health and readiness

- `GET /health` is a process liveness check. It does not query the database.
- `GET /ready` verifies the API can reach PostgreSQL.
- Both include the release version and a request correlation header.
- A readiness failure returns HTTP 503 without returning the underlying database error.

Suggested pilot monitoring:

- probe `/health` every 60 seconds;
- probe `/ready` every 60 seconds;
- alert after two consecutive failures;
- alert on repeated HTTP 5xx responses or a sustained rise in request duration;
- keep alerts low-volume enough that an operator will act on them.

## Structured request logs

The API emits one completion record per request when `REQUEST_LOGGING=true`:

- request ID;
- HTTP method;
- normalized route path;
- status code;
- duration.

Logs deliberately exclude Authorization headers, request/response bodies, passwords, refresh tokens, database URLs, and access tokens. Use the request ID shown by the mobile Support & Diagnostics screen to correlate a user report with server logs.

## Incident procedure

1. Determine whether the API is live (`/health`) and database-ready (`/ready`).
2. Record the app/API version and request ID from the affected workflow.
3. Check structured logs around that request ID.
4. For booking incidents, do not manually replay a failed POST unless authoritative booking state has been checked first.
5. For suspected credential exposure, rotate the affected credential immediately and revoke affected sessions where applicable.
6. For data integrity incidents, stop writes before attempting repair.
7. Record what happened, impact, mitigation, and follow-up action.

## Database backup

PostgreSQL client tools must be installed locally. Prefer the Neon direct connection string:

```powershell
$env:DATABASE_DIRECT_URL="<direct database URL>"
.\scripts\backup-postgres.ps1
```

The script writes a timestamped custom-format dump under `artifacts/backups/`, which is ignored by Git. Move successful backups to an access-controlled storage location. Do not send database dumps through chat or public issue trackers.

Pilot minimum: create a backup before a production migration or high-risk data operation. A daily managed-provider backup/PITR policy is recommended when the pilot contains real customer data.

## Restore validation

A backup is not considered validated until it has been restored into an isolated non-production database and smoke-tested.

```powershell
$env:RESTORE_DATABASE_URL="<isolated restore/test database URL>"
.\scripts\restore-postgres.ps1 -BackupFile ".\artifacts\backups\futsal-YYYYMMDD-HHMMSS.dump" -ConfirmRestore
```

The restore script never falls back to the application database URL and refuses an exact match with configured application/direct URLs.

After restoration:

1. point a temporary API instance at the restored database;
2. confirm `/ready`;
3. verify representative users, venues, bookings, teams, competitions, subscription history and audit logs;
4. do not write pilot traffic to the restored database;
5. record the date and backup file identifier in the release checklist.

## Rollback

For an API regression, redeploy the last verified application commit. Database changes must be rolled back only with a reviewed migration or restore plan; never delete the Drizzle migration journal manually.

For an Android regression, stop expanding the pilot and distribute the last verified internal APK. Production Play releases should use staged rollout where available.

## Shutdown

SIGTERM/SIGINT triggers graceful HTTP shutdown and database-pool close. The server stops waiting after ten seconds and closes remaining connections so deploys cannot hang indefinitely.


## Platform administration — Phase 7 preproduction gate (October 11, 2026)

The final admin-console phase is **code-complete, not production-approved**. Do not use a PASS check in Admin → Readiness as a substitute for operator sign-off.

1. On a separate staging database, run migrations through `0036_admin_trust_support`. Run `pnpm verify` and Expo web export, confirm `/ready`, then sign in as a current platform admin. A stale/suspended admin's old access token must be rejected without waiting for the token to expire.
2. Test two administrators opening the same configuration snapshot and saving conflicting updates. The later attempt must receive `SETTINGS_STALE` 409 and must reload. Confirm identical/no-op saves get `SETTINGS_UNCHANGED`. Confirm valid changes atomically create one `PLATFORM_SETTINGS_UPDATED` audit row with reason and changed key names, without logging template bodies.
3. In Admin → Audit, validate server-side filters and pagination, then export a narrow date range on desktop. CSV must exclude free-form metadata and safely quote Excel formula-like strings. Exports are capped at 31 days/1,000 records (and 5 export requests per minute); longer periods require smaller batches. Store copies only in secure operations storage.
4. Inspect Admin → Readiness and explicitly mark every UNKNOWN item after independent evidence: backup/restore rehearsal, Android and browser RTL/LTR QA, on-call escalation, secrets and CORS review, real-world charge/reference reconciliation, and post-rollback smoke tests.
5. Run real PostgreSQL integration scenarios: parallel billing reference activations, duplicate report requests, support ownership/private internal notes, hidden comments and social counts, scheduled announcements across two API instances and >150 recipients. Validate no duplicate notification messages and that opt-out users are excluded.
6. The push system currently supports recording/requeueing failed deliveries, **not a guaranteed external sender**. Never describe PENDING as SENT. Configure and test the external push worker and provider credentials before promising device delivery.
7. If an admin release fails, halt changes and traffic, capture request IDs, restore the prior known-good app version, and use a reviewed DB forward-fix or an isolated validated restore plan. Do not delete migration entries or manually rewrite irreversible financial/booking history.

Release evidence should include git commit, workflow run, migrations applied, backup ID + restore rehearsal, reviewer, date/time (Asia/Kabul), smoke-test results, open incidents and sign-off.
