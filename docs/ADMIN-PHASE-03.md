# Futsal Admin Completion — Phase 3 / 7

## Scope: Users & role management
1. Paginated user directory with server-side name/phone/username search, status, effective/explicit role and city filters, stable newest/oldest sorting and total row count (25 per page by default). Normal User filter excludes all explicit role grants, referee assignments, active team membership, player profiles, team ownership and venue ownership.
2. Account detail with six navigation tabs: Overview, Roles, Subscriptions, Teams, Reservations and Activity. Sensitive lists are bounded and require the platform-admin role on each request. The directory does not return private password/session tokens.
3. Role provenance identifies explicit grants, venue-assigned referee authority and active paid subscriptions. The account detail flags referees with player profiles, team memberships, managers/owners/paid roles, legacy referee grants without venue assignments, and paid grants lacking active entitlements. **No automated role changes** are performed. Paid role activation, team participation and venue referee assignment remain within their authorized domain flows. Platform-admin grants need MFA and a separate privileged-grant policy before admin UI editing can be safely enabled.
4. Suspension/restoration and all-session revocation require a reason and confirmation. The API writes audit entries in the same database transaction as the mutation. Suspension revokes all refresh sessions; the new users.sessions_revoked_at watermark immediately invalidates issued access tokens, including older tokens using their JWT issued-at claim. Restoring a user does not restore revoked sessions and requires sign-in again.
5. Private support notes with reasons create immutable audit records. Account Activity shows the most recent 60 relevant records; reservations the latest 40, memberships up to 60, and subscription detail lists are bounded. Historical role and booking changes not represented in existing audit tables are not falsely inferred.

## Implementation
- GET /api/v1/admin/users/page?q=&page=&pageSize=&sort=&status=&role=&city=
- GET /api/v1/admin/users/:userId
- PATCH /api/v1/admin/users/:userId/status
- POST /api/v1/admin/users/:userId/revoke-sessions (reason)
- POST /api/v1/admin/users/:userId/notes (reason and note)
- Existing legacy GET /users is unchanged. New endpoints all use PLATFORM_ADMIN live revalidation.
- Drizzle migration: 0033_admin_user_sessions. Apply before starting an API built from this commit: `pnpm db:migrate`.

## Verification requirements
Run `pnpm db:migrate`, `pnpm verify`, and manually exercise a multi-page directory, all filters including Normal User, six tabs, a referee conflict, suspend/restore, revoked access+refresh tokens, reason confirmation/cancel, cross-admin data permissions, and desktop/mobile Dari/Pashto RTL layouts. Staging database integration and MFA remain release gates.
