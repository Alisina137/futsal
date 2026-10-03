# LeagueKick Domain Rules — Phase 1 Baseline

This document records implementation-level domain rules that are already authoritative in the Product Specification and relevant to the current foundation.

1. Product-facing roles are represented as explicit server-owned role assignments; the client never grants itself a role.
2. Initial self-registration may create either a Player account or a Venue Owner account. Additional delegated roles are assigned later by authorized server workflows.
3. Venue Owner registration does not create a venue or start the Premium trial. Phase 2 owns both behaviors.
4. A temporary network failure must not erase a locally stored authenticated session or language preference. Invalid/expired credentials returned by the server may clear the session.
5. Dari and Pashto are RTL. English is LTR. Mixed technical identifiers such as phone numbers remain readable independently of page direction.
6. Passwords are never stored in plaintext. Refresh tokens are stored only as hashes server-side.
7. Access tokens contain server-issued roles and are short lived. Refresh sessions can be revoked.
8. Private routes require server-side authentication. Future object-level permissions must not rely on hidden UI alone.
9. Platform audit capability begins in Phase 1 and expands with privileged operations in later phases.
10. The one-owner-account/one-venue, one-subscription/one-venue, and 72-hour Premium trial rules are authoritative but are implemented in Phase 2 and Phase 7 according to the Product Specification roadmap.
