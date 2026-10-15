# Competition Detail — Phase 5: Teams, Registration, Invitations and Participation

Date: 2026-10-15. Public competition detail; secure manager/organizer workflows.

## Implemented

- **Teams > Participants:** displays only officially `ACCEPTED` competitors. Real team crest, name, group, seed and accepted-state badge; stable group/seed/name ordering. Offline/manual teams have a safe disabled profile action. Accepted total is identified separately from pending/invited applications.
- **Teams > Registration:** dedicated public summary displays official registration status, accepted-team capacity, fee (AFN), closing date and application policy. Expired and full competitions remain explicitly labelled as ineligible, even if the organizer has not changed the `REGISTRATION_OPEN` status. Anonymous spectators see Sign In, never unauthorized registration actions.
- Only teams actually managed by the authenticated session user may be selected. Applications/invitations with `APPLIED`, `PENDING`, `INVITED`, `ACCEPTED` status are excluded from duplicate submission. Previously rejected/withdrawn teams may reapply when the server's actual status/deadline/capacity rules allow it. The existing server endpoint retains its authoritative rules; UI is a useful preview, **not** access control.
- **Teams > My Participation:** privately loads the caller's API-scoped registrations and invitations; sorts pending actions first, then accepted, then history. Shows readable status explanations, actual fee statuses, and manager-only accept, decline and withdrawal controls controlled by the API's `canRespond`/`canWithdraw` fields. A failed private-status lookup presents Retry rather than falsely claiming no registrations. No display of other teams' non-public applications/payment references.
- Confirmation step, server-side capacity locking, invitation consent and revalidation of account/role/competition on refresh remain. No optimistic accept/decline/withdraw; the screen reloads authorization state following a successful write.
- **Organizer actions moved out of the spectator page:** authenticated hosting venue owners see an **Organizer — Manage Competition Teams** link under Participants. It deep-links to the pre-existing owner competition control center's Teams tab. Approvals, invitations, offline manual-team registrations, fee handling and organizer status controls continue to operate on the owner-only management route; duplicated owner directory listing, invitations and manual registration writes have been removed from the public Competition Detail screen. The screen verifies the current owner's hosting-venue relation before showing the management entry.
- Navigation remains scoped to 7 parent tabs, with registration subtab displayed whenever the status is `REGISTRATION_OPEN` so full/deadline explanations remain accessible, and My Participation accessible for known active/history records or when an authenticated lookup requires retry. Existing Home/register deep links remain valid.
- Three languages (English, Dari, Pashto), RTL and accessible CTA labels. No database migration, dependency or public API contract change.

## Automated tests

```powershell
pnpm verify:competition-detail-phase5
pnpm verify:competitions-phase3
pnpm verify:competition-organizer-invite
pnpm verify
```

Pure regression tests cover capacity, deadlines, full status, duplicate manager selection, manager identity isolation, history ordering, public/participant subtab gating and legacy Registration routing. Structural tests verify private API usage, manager-only controls, the existing owner dashboard, safe team profiles and server-side authorization invariants. Included in the main release-check chain.

## Device and real database manual QA remaining

1. Navigate Participants/Registration/My Participation as guest, verified normal user, player, team manager and host venue owner.
2. Test accepted/invited/applied/pending/rejected/withdrawn registration, fee states UNPAID/PENDING/PAID/WAIVED, organizer review and capacity races against real PostgreSQL.
3. Sign in from Registration; confirm a non-manager cannot submit team applications, and manager selection never offers another manager's team.
4. Accept or decline an invitation even after registration closes when backend permits; ensure no invite is accepted automatically and no manual/offline team profile link is broken.
5. Confirm a full or expired registration page explains why Apply is disabled; compare accepted count to real records.
6. Open the organizer management link; confirm it opens the real Teams control tab and its approval/invitation/manual team/payment actions work, while a different venue owner cannot access it.
7. Simulate intermittent connection, revoked membership/account, cross-account switches and double-taps to ensure no stale private registrations or duplicate writes.
8. Inspect small-screen/narrow-font, English/Dari/Pashto RTL and accessibility labels.

**CI cannot replace physical Android or actual database acceptance.**
