# Futsal Admin Completion — Phase 1 / 7

Status: source implemented on GitHub main; production MFA and in-browser visual QA are tracked as release gates.

## Task 1.1 — Modular architecture
- Extracted the previous ~626-line admin route into a small orchestration screen and reusable `AdminSidebar`, `AdminStyles`, `AdminDashboardSection`, `AdminDirectorySections`, `AdminBillingSection`, and `AdminOperationsSections`.
- Retained every existing admin section, manual-team claiming, and team-slot billing. No new framework.

## Task 1.2 — Layout and navigation
- Four collapsible sidebar groups; accessible keyboard/touch targets, active section indicator, mobile menu and sign-out, topbar breadcrumbs, RTL-sensitive directional navigation. Existing theme and desktop 1500px workspace width preserved.
- English/Dari/Pashto translation of navigation labels.

## Task 1.3 — Live data, pagination, performance
- Admin users and venues now use server-side page 1-based, bounded page size 10–100, default 25, database total counts, stable newest-first order, and next/previous controls. Legacy endpoint compatibility preserved. Search applies on explicit submit; changing pages or tab does not reload unrelated admin datasets.
- Only the selected tab fetches its API dependencies; read-only manual-team and team-slot components retain their own data loading. Admin requests bypass the device's offline cache and use a real AbortSignal wired to the underlying network call, with stale-response guards.
- Server pagination query and page count are validated on API and gated by platform admin auth. This phase does not add arbitrary server sorting or advanced filters: those are in the corresponding domain phases.

## Task 1.4 — Authentication hardening
- Web **admin-mode** sessions use browser sessionStorage (not persistent localStorage); stale legacy localStorage admin credentials are cleared. Other web and mobile clients retain existing storage behavior.
- API still validates account status per request, and now *revalidates PLATFORM_ADMIN membership against current account roles on each admin access*, rejecting revoked authority before an unexpired JWT can continue privileged calls.
- Administrator MFA and password step-up are **required before broad production rollout** but are not silently simulated by a confirmation dialog. These need a separately specified authenticator enrollment/recovery design and migration.

## Task 1.5 — Confirmation and safe writes
- Existing user, venue, payment, moderation, settings, subscription, and support mutations go through a two-step confirmation modal, showing the target and snapshotted reason, busy state and exact error on failure. Payment-history reads are not blocked by modal.
- This is additive to existing server-side authorization, reason validation, audit logging, subscription checks, and idempotency protections.

## Task 1.6 — Shared UI
- Reusable `AdminPagination`, `AdminStatusBadge`, `AdminEmptyState`, and `AdminConfirmModal` plus shared styles. User directory now displays roles (or Normal User), venues display status and verification badges, and empty states are localized.
- Phase 3 remains responsible for advanced user-role management; Phase 5 for billing layout and deeper financial controls.

## Verification & release checklist
- `pnpm verify:admin-web`, `pnpm verify:admin-phase1`, `apps/api/test/admin-foundation.test.ts` (run in `pnpm test`), full `pnpm verify`, and Expo web export.
- Manual checks: EN/fa-AF/ps-AF desktop and mobile menu, sign-out, user/venue pagination beyond 50 rows, suspended/revoked admin, stale in-flight queries on section changes, confirmation cancel/success/failure, payment authorization, and data privacy.
- No Drizzle migration or new runtime dependency in this phase.
