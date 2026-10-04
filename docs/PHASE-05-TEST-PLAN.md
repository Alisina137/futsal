# Phase 05 Test Plan — Teams and Player Identity

Branch: `phase-05-teams-player-identity`

Status before local verification: implemented; migration generation, full verify, database migration, and live Android smoke testing pending.

## 1. Migration and automated verification

Run:

```powershell
pnpm db:generate
pnpm verify
pnpm db:migrate
```

Expected new migration:
- `packages/database/drizzle/0004_*.sql`
- `packages/database/drizzle/meta/0004_snapshot.json`

Do not accept a second Phase 5 migration unless the schema changes again after generation.

## 2. Player profile

1. Sign in as a PLAYER.
2. Open Profile → Player Profile.
3. Change public display name, position, image URL, and visibility.
4. Save and reopen.
5. Confirm values persist.
6. Set visibility to PRIVATE and open the public player URL from another account.
7. Confirm the public player page is unavailable.
8. Restore PUBLIC and confirm the public page shows only approved player fields.
9. Confirm phone/email/private account metadata never appears.

## 3. Create team

1. Open Profile → My Teams.
2. Create a PUBLIC team with name/city.
3. Confirm creator becomes Manager and appears once in the roster.
4. Create a second team with the same player account.
5. Confirm both appear in My Teams.
6. Confirm the same user is not duplicated within one team.

## 4. Private team

1. Create or change a team to PRIVATE.
2. Open it while signed out or from a non-member account.
3. Confirm team identity can load but roster is hidden.
4. Open from an active team member account.
5. Confirm full roster is visible.

## 5. Invite player

1. As manager, invite an existing player by username.
2. Confirm a pending invitation appears.
3. Try inviting the same player again before resolution.
4. Confirm duplicate pending invitation is rejected.
5. Repeat with Afghanistan phone number.
6. Confirm venue-owner-only accounts cannot be invited as players.

## 6. Invitation accept/decline/expiry

1. Sign in as invited player.
2. Open Team Invitations.
3. Accept one invite.
4. Confirm membership becomes active and team appears in My Teams.
5. Decline another invite and confirm no membership is created.
6. Confirm a 7-day-expired invitation cannot be accepted.
7. Confirm manager can revoke a pending invite.

## 7. Captain and shirt number

1. Manager edits a player's shirt number to a value 1–99.
2. Confirm it appears on the roster.
3. Assign that member as captain.
4. Confirm only one captain is current.
5. Remove captain and confirm the role updates.
6. Confirm invalid shirt number is rejected.

## 8. Manager transfer

1. Add another active member.
2. Transfer management to that member.
3. Confirm the new manager gains management controls.
4. Confirm the old manager immediately loses manager-only API/UI access.
5. Confirm the old manager cannot rename the team, revoke invitations, remove members, or transfer management again.

## 9. Member removal

1. As manager, remove a non-manager member.
2. Confirm the user disappears from active roster and My Teams relationship.
3. Confirm the manager cannot remove themselves before transferring management.

## 10. Notification behavior

1. Enable team-invite notifications.
2. Send an invite and confirm one TEAM_INVITATION notification appears.
3. Confirm tapping it opens Team Invitations.
4. Send/retry the same invitation event and confirm notification dedupe.
5. Disable team-invite notifications.
6. Send a valid invite and confirm the invitation still exists even though the alert is suppressed.

## 11. RTL and localization

Repeat key Phase 5 screens in:
- Dari (default, RTL)
- Pashto (RTL)
- English (LTR)

Check:
- action order,
- text alignment,
- team/profile forms,
- invite actions,
- manager confirmation cards,
- notification preference,
- localized dates/times on invitation expiry.

## 12. Final acceptance

Phase 5 can be marked verified only when:
- `pnpm verify` is green;
- `pnpm db:migrate` succeeds;
- Phase 5 live Android flows above pass;
- generated `0004_*.sql` and snapshot are committed;
- no private contact data appears in public player/team responses.

Phase 5 explicitly excludes matchmaking.

Next phase: Phase 6 — Competition Engine.
