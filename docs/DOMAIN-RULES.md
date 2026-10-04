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
