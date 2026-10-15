# Public Team Detail — Phase 7: About and Membership

Date: 2026-10-15.
Scope: public Team Detail → About → Overview and Membership. Phase 7 preserves earlier Team Detail Phases 1–6 and does not introduce any new private endpoint, team subscription, or third-party messaging workflow.

## Implemented

**About → Overview**
- Redesigned About details into readable cards with team description, clean city/district/province (no duplicate locations), localized *date-only* founding date, true privacy level, and registered player count.
- Shows explicit not-provided messages rather than fake founding dates/locations. Dates are validated and localized as calendar days rather than midnight timestamps; no accidental timezone shifts.
- Publicly configured home venue can be opened via the existing `/venues/[venueId]` route; only valid UUID identifiers from a PUBLIC team profile are eligible. This does not imply a venue is always published or bookable.
- Contact card shows a callable phone only when published through a PUBLIC team profile and the existing strict telephone validator accepts it; private, missing, and malformed phone numbers are not dialable or displayed as contact information.
- Current team manager receives a shortcut to the existing manager workspace to edit published team details. No write/edit capability for others.

**About → Membership**
- Adds a permission-aware status card with accurate distinctions for manager, active captain, active player, pending request, visitor sign-in, unverified email, account with another assigned role, invitation-only team, previously rejected/cancelled request and eligible account.
- Active captain role now requires *confirmed membership*, preventing an out-of-date captainUserId from granting client-side member shortcuts or a misleading captain badge. Manager ownership remains independently authenticated. Backend remains authoritative for all private reads/writes.
- Reuses existing `teamDetailJoinAction`, `teamApi.requestJoin` and `teamApi.cancelJoin` workflows; no auto-membership, duplicate request or bypass for role/email restrictions.
- Shows Sign in and Verify email buttons only for appropriate states. Rejected/cancelled prior requests are not misrepresented as an approved membership; re-request is only offered when server-based eligibility rules permit it.
- Private activities and announcements buttons appear **only** for an authenticated confirmed current member or the team manager; other visitors see a privacy explanation. Links use the existing pages, which also authorize on the API.
- Membership and manager workspace buttons return to refreshed profile state through existing focus guards.

**Languages and UX**
- New copy and status context in English, Dari and Pashto; RTL card content and accessible buttons. Existing tab/subtab, follow, squad, match, competition and stats interactions remain unchanged.

## Verification

```powershell
pnpm verify:team-detail-phase7
pnpm verify:team-detail-phase2
pnpm verify:team-detail-foundation
pnpm verify:public-team-detail
pnpm typecheck
```

Seven Node tests cover public/membership states, rejection and cancellation semantics, account/role exclusions, member-only routes, duplicate location suppression, timezone-independent founding date and validated public venue links. A structural verifier requires server-side filtering of unpublished/private team details and the existing strict email/role join eligibility rules.

## Android and production integration acceptance still required

| Scenario | Expected |
| --- | --- |
| PUBLIC team with description/location/founded date/phone/home venue | Localized, styled and accurate About overview |
| PRIVATE team with manager-only profile details | No disclosure of description, phone or home venue from private manager data |
| Public team with invalid phone/date or no home venue | No unsafe dial action or fabricated date/venue link |
| Guest | Sign-in CTA in Membership; no private member page links |
| Signed-in but unverified user | Email verification CTA; no new join request submission |
| Email-verified normal account, join allowed | Join action submits pending request; state refreshes |
| Pending request | Pending status and cancel action; no member resource links |
| Rejected / cancelled request | Prior state shown accurately; only eligible accounts can resubmit |
| Assigned role in other team / invitation-only | No unauthorized join request |
| Active player or captain | Approved role and private member resources; captain role requires actual current membership |
| Team manager | Manager status, manager workspace and member resources |
| Revoke membership or switch accounts/team during loading | Old private member buttons and details never remain available |
| Long names, small screen, large font, Dari/Pashto RTL | No overlap; logical text alignment and navigation |
| Call or venue route unavailable | Graceful existing platform or destination handling without data leakage |

**Not yet claimed:** physical Android testing, production database acceptance and screenshots from a real device.
