# Futsal Domain Rules — Phase 2

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


## Phase 3 booking and occupancy rules

19. All persisted booking/block timestamps are UTC instants; venue-facing local dates/times are interpreted using the venue timezone (Afghanistan default: Asia/Kabul).
20. Live availability is derived from weekly opening hours and active playing areas minus active bookings and owner blocks.
21. Cached availability may be displayed for orientation but is never authoritative for booking confirmation.
22. Online booking confirmation revalidates the slot server-side and persists the server price, duration, and cancellation-policy snapshot.
23. Manual and online bookings use the same occupancy conflict path.
24. PENDING and CONFIRMED bookings occupy capacity; CANCELLED bookings do not.
25. Owner blocks occupy capacity and cannot overlap active bookings or other blocks.
26. Booking writes are idempotent by client-provided idempotency key.
27. Real database booking/block writes serialize by playing area with a PostgreSQL transaction-scoped advisory lock before overlap validation.
28. Trial/Active venues may expose live availability and accept new bookings; expired/cancelled/suspended venues cannot accept new bookings.
29. A player may cancel only their own future active booking; an owner may cancel only bookings belonging to their venue.
30. Price/currency and cancellation policy are snapshotted onto the booking and are not recomputed retroactively.


## Phase 4 promotions, feed and notifications rules

31. A promotion references one exact future playing-area interval and can be created only when that interval is live and available.
32. Promotion discounted price must be lower than the current live slot price and is snapshotted with the offer.
33. A promotion is public only while its effective state is ACTIVE; occupancy, venue entitlement loss, suspension, manual close, or interval expiry makes it non-bookable.
34. Booking a promoted slot persists the discounted server-authoritative price that was active at confirmation time.
35. Venue posts are immediate-publish/unpublish in MVP; draft/scheduled publishing remains outside Phase 4.
36. Post CTAs are structured and deep-link only to platform-owned destinations (venue, promotion, later competition).
37. Following is user-to-venue and never grants access to private venue/customer data.
38. In-app notifications are persisted server-side and are the source of truth for notification history.
39. Push registration stores only Expo push tokens and platform metadata; push delivery is best-effort and never replaces in-app notification state.
40. Notification deduplication is enforced per user + dedupe key so retries cannot create duplicate notifications.
41. Promotion/post follower fan-out respects per-user notification preferences and server-side frequency limits.
42. Notification deep links must target a real Futsal route and must never be treated as an authorization boundary.
43. Owners can create promotions/posts only while venue Premium entitlement permits marketing writes; expired/cancelled/suspended venues retain history but cannot publish new marketing inventory.


## Phase 5 teams and player identity rules

44. Every registered player may maintain at most one PlayerProfile; the profile is separate from private authentication/contact fields.
45. Public player endpoints expose only approved profile identity fields and active public team relationships. Phone, email, password/session data and private account metadata are never public.
46. A player may belong to multiple teams simultaneously; duplicate active membership is prevented only within the same team.
47. Creating a team makes the creator its initial manager and an ACTIVE team member.
48. Team-manager authority is object-scoped. A manager may manage only teams where they are the current manager; UI visibility is never an authorization boundary.
49. A team has at most one current captain. The captain must be an ACTIVE member of that same team.
50. Manager transfer is allowed only to another ACTIVE team member and removes manager authority from the previous manager after the transfer succeeds.
51. Team invitations target an existing registered user, expire, and are single-use. Repeated pending invitations to the same team/user are rejected or replay-safe rather than duplicated.
52. Accepting an invitation creates/reactivates membership atomically and resolves the invitation. Declining/revoking does not create membership.
53. Shirt numbers, when present, are integers 1–99. They are roster metadata rather than global player identity.
54. Team privacy controls public roster visibility. Private teams remain visible to their members but do not expose their roster through public endpoints.
55. Team/player profile media is HTTPS URL metadata in Phase 5; binary upload/storage integration remains a separate infrastructure concern.
56. Team invitation notifications respect user notification preferences and are deduplicated by user + invitation event.
57. Matchmaking/challenges are explicitly outside Phase 5.


## Phase 6 competition engine rules

58. A competition belongs to exactly one venue. Venue-owner competition writes are tenant-scoped through that venue and require active Premium entitlement.
59. Competition drafts are private. Opening registration makes the competition public; public reads never expose owner-private operational data.
60. Supported MVP formats are LEAGUE, KNOCKOUT and GROUP_KNOCKOUT. Advanced live scoring and matchmaking remain outside Phase 6.
61. A team can enter a competition only through its current team manager. Venue owners may invite teams but cannot impersonate the team manager's response.
62. Accepted-team count is server-authoritative and may never exceed the competition's configured team capacity.
63. Registration changes stop once fixture generation materially schedules the competition.
64. League and group standings are derived from persisted completed/corrected match results. Standings are not manually edited totals.
65. Default tie-break precedence is configurable and supports points, goal difference, goals for, head-to-head and explicit admin seed ordering.
66. Knockout matches cannot end in a draw. A persisted winner advances through stored bracket links.
67. Knockout brackets are deterministic and distribute non-power-of-two byes using seeded bracket positions; no synthetic bye match is exposed as a playable fixture.
68. Group-to-knockout qualification is derived from completed group standings using the configured qualifiers-per-group rule. The knockout stage cannot be generated before all group matches are complete.
69. A Group→Knockout competition cannot be completed until its knockout stage exists and every required knockout match is completed/corrected.
70. Competition match scheduling uses the same playing-area transaction advisory lock as ordinary booking/block writes.
71. A scheduled/in-progress competition match occupies venue inventory and must conflict with active bookings, owner blocks and other scheduled/in-progress competition matches.
72. Public availability subtracts scheduled/in-progress competition matches and can never present that interval as bookable inventory.
73. Match result corrections require an explicit reason and create an audit-log record.
74. Changing a knockout winner is blocked once a downstream match has started/completed; if the downstream match is merely scheduled, explicit impact confirmation is required.
75. Correcting a group result after a knockout snapshot requires impact confirmation, and the bracket can be rebuilt only before knockout play begins.
76. Player match statistics may reference only active roster members of one of the two teams in that match.
77. Competition public pages derive fixtures/results, standings, bracket, teams and player stats from the competition source of truth.
78. Competition post CTAs deep-link only to public competition routes and never bypass server authorization.
79. Competition dates/times persist as UTC instants and display in localized venue/user time; Dari/Pashto layouts remain RTL while technical scores/times remain readable.
