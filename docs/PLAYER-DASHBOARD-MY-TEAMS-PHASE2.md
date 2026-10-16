# Player Dashboard — My Teams Phase 2 (October 16, 2026)

* Summary shortcuts for memberships, invitations and pending requests.
* Search My Teams; default team is shown first.
* Sort invitations by expiration; confirm before declining.
* Filter join requests by pending or history; confirm before cancelling.
* Directory shows independent loading/error/retry.
* Critical authorization: accounts with PLAYER role cannot create new join requests;
  verified basic users without roles may request membership. Players can browse and
  managers can invite them. Backend enforcement remains authoritative.
* English, Dari and Pashto translations; RTL styling and existing links retained.

Checks: `pnpm verify:player-teams-phase2`, existing player regressions and mobile/API typecheck.
