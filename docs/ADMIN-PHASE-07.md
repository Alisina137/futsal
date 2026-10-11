# Futsal Admin Panel — Phase 7: Governance, Security and Release Readiness

**Status:** Code implemented on `main`, CI `pnpm verify` + Expo web export required. **Manual operator approval remains necessary.**

## Workstreams delivered

| ID | Workstream | Implementation |
| --- | --- | --- |
| 7.1 | Safe platform configuration | Versioned, reason-gated settings writes. Pricing, free-trial hours, feature flags and notification templates are validated. A reviewed diff is displayed before confirmation. |
| 7.2 | Race prevention & audit | Transaction + advisory lock + row lock, compare `expectedUpdatedAt`, reject stale/no-change, atomic audit with old/new public numeric values and changed field names. No template body logging. |
| 7.3 | Searchable administrative audit | Bounded server pagination and query/actor/action/target/date filters; date-scoped CSV export on web with CSV injection escaping, 1,000-row/31-day limit, no raw metadata. |
| 7.4 | Administrative privacy controls | All `/api/v1/admin` commercial routes require active PLATFORM_ADMIN; CSV is rate-limited and responses carry `Cache-Control: no-store`. Old `/audit` endpoint now returns redacted metadata. |
| 7.5 | Operational health checks | Migration table-presence check and unresolved support/report, scheduled announcement and failed push delivery counts. Explicit UNKNOWN for unverified external dependencies. |
| 7.6 | Release console usability | Responsive, RTL-aware English/Dari/Pashto Configuration, Audit and Readiness views, error states, date display in Kabul and manual conflict reload. |
| 7.7 | Verification and handover | Route and contract tests, static integrity verifier, updated operations runbook and release checklist. |

## API additions

- `GET /api/v1/admin/audit/page?page=1&pageSize=25&q=&action=&targetType=&actorId=&from=&to=`
- `GET /api/v1/admin/audit/export?from=YYYY-MM-DD&to=YYYY-MM-DD` — `text/csv`, secure export constraints apply.
- `GET /api/v1/admin/diagnostics` — authenticated truthful release status, never an automatic production approval.
- `PUT /api/v1/admin/settings` **changed** — now strictly requires existing price/trial/flags/templates plus `reason` (10–500 chars) and `expectedUpdatedAt` (last-read ISO timestamp). Stale edits receive HTTP 409.

## Configuration example

```json
{
  "monthlyPriceAfn": 1000,
  "annualPriceAfn": 12000,
  "trialDurationHours": 72,
  "featureFlags": {},
  "notificationTemplates": {},
  "reason": "Approved revised monthly pricing for new subscriptions",
  "expectedUpdatedAt": "2026-10-11T10:00:00.000Z"
}
```

The `expectedUpdatedAt` in real requests MUST come from `GET /api/v1/admin/settings`, not a copied example timestamp. Changes do not retroactively rewrite paid role history, team entitlements or existing reservations.

## CI and database

- Verify: `pnpm verify:admin-phase7`; full chain: `pnpm verify`.
- Phase 7 adds **no migration**. Ensure prior migrations `0033`–`0036` have been applied before starting the API.
- Production release remains contingent on backups/restores, concurrency tests, token revocation, staging RTL/LTR QA, manual payment reconciliation, and explicit owner sign-off. External push sending remains outside these checks.
