# Futsal Admin — Phase 6: Moderation, Reports & Customer Support

Status: implemented on `main`, pending local migration and database-backed integration/visual QA.

## 6.1 — Content moderation inventory
- Server-paged content from user/team/venue social posts, social post comments, and venue promotions; searchable by text/author, filter by content kind and status.
- Reason-required, confirmed and audit-recorded actions: unpublish posts, hide comments, close live promotions; warn active users by durable in-app notice.
- Soft-hidden comments remain in data for audits but are excluded from public lists, likes and counts. Related venue post status follows moderation.

## 6.2 — Structured reports and escalation
- Authenticated user report endpoint for user, venue, post, comment or promotion targets; report categories SPAM, HARASSMENT, FRAUD, FAKE_VENUE, INAPPROPRIATE_CONTENT, OTHER. Targets must exist.
- Per-user/per-target one unresolved report rule with a partial unique index. Admin-only paginated queue, OPEN → REVIEWING → RESOLVED/DISMISSED, reason-audited.
- Report resolution does not automatically suspend an account, void a payment or delete past match results.

## 6.3 — Support ticket management
- Authenticated users can create/list/view/reply to **only their own** support tickets. Admins view all, assign another PLATFORM_ADMIN, set LOW/NORMAL/HIGH/URGENT priority, reply, and update the lifecycle:
  OPEN → IN_PROGRESS → WAITING_FOR_USER → RESOLVED → CLOSED. WAITING_FOR_USER replies resume IN_PROGRESS.
- All updates append ticket event history; admin changes write an audit row. CLOSED is immutable.

## 6.4 — Targeted and scheduled announcements
- Authoring with title/body, UTC ISO schedule (stored timezone-aware, displayed locally), target audiences ALL, USER ID, ROLE or CITY.
- Admin-only creation/cancellation. Creation stores immutable schedule and auditable actor/target. Backend timer polls due/SENDING campaigns every minute.
- Initial send snapshots *active* audience into `platform_announcement_recipients`. Sends up to 150 recipients per campaign per tick with per-user deduplication (`notifications_user_dedupe_uq`) and durable in-app delivery audit state.
- Emails, SMS and external push dispatch are not configured by Phase 6. Only in-app announcements count as delivered.
- Staging test multi-instance concurrent due processing and large audiences before production.

## 6.5 — Notification delivery health
- Admin-only paginated channel/status/attempt inspection and status totals, with FAILED PUSH requeue only while attempts < 3.
- Requeue requires reason/audit; PENDING is *not* delivered. There is currently no external push sender/worker in this repo: processing its queue is a future release dependency, not a promised Phase 6 outcome.

## 6.6 — Governance and QA
- User reporting and support writes are throttled, typed and authenticated. All admin routes require revalidated PLATFORM_ADMIN permission.
- Existing commercial subscription/referee/team-manager permissions remain authoritative; no arbitrary role promotion or forced data rewriting.
- Migration: `0036_admin_trust_support.sql`; verify: `pnpm verify:admin-phase6`, `pnpm verify`.
- Before production: DB integration, moderation visibility regressions, multi-instance scheduler concurrency, large dataset paging, user ownership isolation, role/city audience, English/Dari/Pashto RTL mobile and desktop QA.
