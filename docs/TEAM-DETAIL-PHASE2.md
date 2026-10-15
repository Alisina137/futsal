# Public Team Detail — Phase 2: Team identity, actions and eligibility

Date: 2026-10-15
Scope: The **public Team Detail profile** reached from Teams → View Team. Does **not** alter the Team Manager dashboard, paid role subscriptions, directory filters or the venue detail page.

## Implemented

1. **Profile identity / layout.** A taller photo cover with decorative fallback (no fabricated team photos), a clean 84px team logo without drop shadow or heavy logo border, centered multi-line team name, location and description. Sharing is a 44px cover action, leaving usable space for follow/membership buttons. Layout is responsive to narrow widths and English/Dari/Pashto direction.
2. **Reliable profile statistics.** Actual server roster count stays visible. Follower count comes only from authenticated live social-follow state. Anonymous, failed or not-yet-loaded follower counts show an em dash rather than the misleading fake `0`. Privacy uses the existing team DTO.
3. **Correct join permissions.** Joining is offered **only** to signed-in, email-verified, role-free accounts, when the team allows join requests. Users with other roles do not see a join-request button. Pending requests can still be **cancelled** even if a role/verification status has since changed; managers and approved members cannot request again. An unverified user gets a **Verify email** shortcut instead of a Send request button. Invitation-only status is informative, not a fake enabled request. The server continues to enforce authoritative email/role/manager/team policies.
4. **Follow and member actions.** Guest sees **Sign in to follow** with login navigation; authenticated follow/unfollow remains server-backed. Team Manager sees **Manage**, approved team member/captain sees **Member area** instead of a disabled “Member” button, leading to About → Membership and existing member-only shortcuts.
5. **Quick section navigation.** Three responsive quick actions directly select Squad → Players, Matches → Results, and About → Overview, respecting the Phase 1 selected-tab focus and preserving other subtab choices.
6. **Public contact.** About → Overview offers a one-tap dial button **only** for a valid public `contactPhone`; never use private phone, a WhatsApp group invite, or a number provided by the logged-in user as the contact source. Links are validated and opened by the system phone handler.
7. **Localization and accessibility.** Added English, Dari and Pashto copy for every new action; keeps existing RTL, accessible button labels, selected tabs, async load/refresh, server privacy, no invented match or leaderboard data. No migration or new dependencies.

## Verification

Run from the repository root:

```powershell
pnpm verify:team-detail-phase2
pnpm verify:team-detail-foundation
pnpm verify:public-team-detail
pnpm verify:navigation-focus
pnpm verify:teams-phase4
pnpm verify:teams-phase6
```

`verify:team-detail-phase2` runs dedicated Node unit tests for all membership eligibility permutations, honest follower labels and secure phone numbers, plus a structural regression guard. This command is included in `pnpm verify`; GitHub Actions also runs `pnpm verify` and Expo web export.

## Android manual QA (not replaced by source tests)

| Scenario | Expected outcome |
| --- | --- |
| Anonymous opens public team with followers | No invented zero follower count, “Sign in to follow” leads to login, no Join button |
| Verified user without roles opens join-enabled team | “Request to join” visible in header / About → Membership |
| Unverified user opens the same team | No Send request; “Verify email” leads to Profile → Email |
| Referee, Venue Owner, Team Manager, active Player opens another team | No join-request button; Follow and sharing still work |
| Previously requested user later gets another role | Existing Pending request can be cancelled, cannot create new request |
| Manager and approved player / captain | Manager gets Manage; member gets Member area; private roster rules unchanged |
| Disabled team join policy | Invitation-only explanation, no fake active CTA |
| Cover missing; logo absent; long team name | Fallback and text render cleanly without overlap or shadow |
| Team has published valid phone; has invalid phone; no phone | Only valid published phone offers working dial, invalid/missing offers none |
| Tap Squad, Results and About quick actions and switch main tabs | Correct destinations and horizontal focus, no vertical reset |
| Follow and switch team quickly on slow network | Phase 1 stale-follow state protection remains intact |
| Run English/Dari/Pashto on Android | No clipping, local labels, logical RTL ordering |

Physical-device, dialer availability, production backend permissions and network acceptance remain manual checks. No claim is made that source tests certify physical UX.
