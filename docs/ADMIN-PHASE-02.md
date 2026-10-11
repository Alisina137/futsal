# Futsal Admin Completion — Phase 2 / 7

**Scope:** Five tasks: Dashboard Statistics; Revenue Analytics; User Growth; Business Performance; Attention Center. The implementation uses the existing Expo web admin console and the authenticated Postgres API. No runtime dependency or schema migration was added.

## 2.1 — KPI overview
- The operational overview now shows all-time registered users and ACTIVE accounts (not DAU/MAU), total and active venues, currently paying venue subscriptions, active paid Team Manager subscriptions, active competitions, new registrations, confirmed bookings, recorded venue subscription payments, and confirmed booking face value (GMV). Current totals and time-window metrics are explicitly distinguished.
- Reporting periods: past 7, 30, 90 or 365 **Kabul-local calendar days**, inclusive of today. Period headers use the selected language's calendar, including Solar Hijri for Dari/Pashto.

## 2.2 — Financial analytics
- New `GET /api/v1/admin/analytics?days=30` endpoint (accepts only 7/30/90/365) is protected by `PLATFORM_ADMIN`. The SQL queries aggregate by local Kabul day and always filter records by the exact date window. Historical venue payment charts include only `subscription_payments.status = RECORDED`, grouped by transaction creation date. Voided payments are excluded.
- GMV sums `CONFIRMED` booking prices by slot start date. **GMV does not represent funds received by Futsal**, and pending/cancelled bookings are excluded. Team Manager subscriptions and paid extra team slots have activation records, not a comparable confirmed payment ledger; their counts appear without invented income.
- Interactive daily, weekly and monthly column charts; annual period uses weekly/monthly display to avoid rendering thousands of mobile/web chart nodes.

## 2.3 — User growth
- New registrations by day, total active-status accounts, explicit stored role-grant distribution, and corresponding responsive charts. **ACTIVE is account status, not proof of actual daily app engagement**; no invented DAU.
- Only aggregates are returned; personal data, user contact details and provider payment references are never included in the analytics response.

## 2.4 — Business performance
- Venue registrations, new teams, newly created competitions, confirmed booking trends, online booking share, paid venue share, verified/active venue totals, current paid team-manager and extra-slot counts, and top eight provinces by registered venues.
- Historical trial conversion is `venues with trialStartedAt AND a non-voided recorded venue payment` / `all venues whose trialStartedAt is recorded`. This is different from current paying-venue share. Future lifecycle/risk analytics may refine the cohort by acquisition date.
- Revenue and booking activity use separate dates: venue payments are attributed to actual ledger creation, confirmed bookings to scheduled slot starts; they must not be combined into platform revenue.

## 2.5 — Action center
- Live action counters: venues awaiting verification, pending paid-role subscription requests, pending additional team slots, pending bookings and paid venue subscriptions expiring within seven days. Buttons open the existing relevant administrative sections.
- The full reservation investigation queue, support-ticket list, content reports and richer payment approval workflows are deliberately *not* invented before their respective Phase 4–6 backend features exist. Counter descriptions explain this limitation.
- A separate Analytics & Reports navigation page provides visual trends and explanatory financial definitions; the overview shows compact growth/payment charts.

## Performance, localization, and security
- Existing Phase 1 section-scoped loading, AbortSignal cancellation, account-scoped login and privileged-role revalidation remain enforced. Changing a reporting period refetches only the analytics endpoint, not users/venues/settings/audits.
- Charts are implemented using plain React Native Views/ScrollViews: no heavy chart dependency. Accessible values, high-contrast labels, responsive layout, English/Dari/Pashto and RTL remain supported.
- Fully typed `AdminAnalyticsResponse` / zod schema, SQL aggregation with no row-level PII, regression `verify:admin-phase2`, API route/shape/permission tests in `commercial.test.ts`. Database-level integration still requires staging data plus visual QA in a deployed browser.
