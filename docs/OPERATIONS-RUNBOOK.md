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
