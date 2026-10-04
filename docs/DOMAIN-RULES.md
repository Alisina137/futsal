# LeagueKick Domain Rules — Phase 2

This document records implementation-level domain rules that are authoritative in the Product Specification and active through Phase 2.

1. Product-facing roles are server-owned. The client never grants itself a role.
2. Initial self-registration may create either a Player or Venue Owner identity.
3. A Venue Owner account may own exactly one venue. The database enforces this with a unique owner-to-venue relationship.
4. A distinct second venue requires a separate Venue Owner account and a separate subscription.
5. Creating a Venue Owner account does not create a venue and does not start the Premium trial.
6. Owner onboarding must capture venue identity/contact, location/address, at least one playing area, seven-day opening-hour configuration, default session duration, and base price.
7. The venue remains a setup record until the minimum onboarding data is complete. The owner can preview the venue before starting the trial.
8. Premium trial duration is exactly 72 hours from `trial_started_at`.
9. Trial start is explicit and server-authoritative. The trial cannot start until minimum venue setup is complete.
10. A physical venue/business identity may claim a trial only once. A duplicate account for the same venue must not reset trial eligibility.
11. Trial-expiry enforcement is server-side. Client clocks and cached UI never grant Premium access.
12. When a trial expires, the venue data remains intact. Later phases restrict new online bookings and Premium management until reactivation while preserving service-continuity access.
13. Temporary network failure must not erase a locally stored authenticated session, language preference, or already-loaded owner setup data.
14. Dari and Pashto are RTL. English is LTR. Technical identifiers such as phone numbers, prices, and times remain readable independently of page direction.
15. Passwords are never stored in plaintext. Refresh tokens are stored only as hashes server-side.
16. Access tokens contain server-issued roles and are short lived. Refresh sessions can be revoked.
17. Private and owner routes require server-side authentication and role checks. Hidden UI is never an authorization boundary.
18. Audit capability applies to privileged lifecycle changes and expands in later phases.
