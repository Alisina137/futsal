# Competition Detail Phase 7 — Media and About

Date: October 15, 2026.

## Implemented

**Media > Updates and Photos**
- Replaced the full public feed inside Media with a dedicated, paginated server-backed view. Home's existing highlight preview stays intact for backward compatibility.
- Public API accepts optional `page`, `limit`, `kind=all|photos`, `sort=newest|oldest`. Inputs are validated, page size capped at 24, with stable timestamp+ID sort. The original media endpoint, without a query, preserves its prior `{posts}` response.
- SQL applies exact competition, `PUBLISHED` and `PUBLIC` audience constraints and photo-presence filtering **before** pagination. Neither unpublished updates, private-audience posts nor another competition's content is returned on new pages. Images must already be real published attachments; no invented videos, announcements, scores or organizer posts.
- Dedicated Updates feed with post date, photo, OS sharing, refresh, page loading/retry (keeping loaded rows on subsequent-page failure), append/load-more and empty state. Photos uses a responsive two-column gallery, accessible modal, caption, position, previous/next and dismissal.
- Competition+subtab+sort+focus-remount scoping cancels late in-flight pages; account/session navigation remounts content under current competition. English/Dari/Pashto and RTL controls.

**About > Information, Rules, Prizes, Venue**
- Information provides status, format, description, accepted-team capacity, AFN fee, deadline, start and end date; only active registration gets a deep link to its registration subtab.
- Rules shows actual published scoring points, match duration, group/qualifier setup where applicable and ordered tie-break rules, with a standings shortcut. Does not invent referee disciplinary or cancellation rules absent from the data.
- Prizes groups actual owner-published team versus individual prizes, names, descriptions and values with an empty state and a note that awards/payment are not guaranteed by the app.
- Venue identifies the competition's **hosting venue**, linking to the canonical public venue profile for up-to-date location/contact. It does not imply every fixture takes place there.
- Full existing About screen remains accessible; no schema migration, new dependencies or private API fields.

## Verification

```powershell
pnpm verify:competition-detail-phase7
pnpm --filter @leaguekick/api test
pnpm typecheck
pnpm verify
```

Includes Vitest API-level public/draft/paging regression, structural SQL privacy requirements, navigation, modal and language checks. The Phase 7 verifier is registered in the full project gate.

## Outstanding physical QA and follow-up

- Confirm Android portrait/landscape and Expo Go gallery/image sharing behavior in English, Dari and Pashto, including RTL order and long captions.
- With real PostgreSQL, compare returned media across public/private/unpublished scopes, older/newer ordering, 12+ pages, deleted posts and intermittent network.
- Validate source images over remote vs cached URLs, disabled Android image downloads and previous/next at first/last boundaries.
- Verify About prize categories and competition rewards during updates, venue navigation, empty dates/group defaults, register vs closed states and screen reader labels.
- Existing legacy Home and cover loading still use the unpaginated compatibility feed. A later task can introduce a bounded latest-public-post preview without breaking older clients.
- Device and real-DB QA remain required before production approval. Phase 8 is final cross-tab privacy and release verification.
