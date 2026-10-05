# Futsal — Authoritative Product Specification

**Version:** 1.0  
**Status:** Pre-implementation source of truth  
**Research snapshot:** 3 October 2026  
**Primary market:** Afghanistan  
**Primary platform:** Mobile (Android first; iOS later)  
**Languages:** Dari, Pashto, English  
**Business model:** Free player experience + paid venue SaaS with a 3-day Premium trial  

> **Naming note:** The product owner explicitly renamed the application to **Futsal**. Futsal is the canonical product name from this revision forward.

> **Source-of-truth note:** This document defines what the product should do and how users should experience it. A separate software-development workflow should govern repository inspection, coding, migrations, testing execution, Git operations, and deployment.

## Authentication and role model

Futsal uses one account identity independently from product roles.

- Every new signup begins as a **simple authenticated user** with no Player, Venue Owner, Team Manager, Referee, staff, competition-admin, or platform-admin role automatically assigned.
- Signup requires, in this order: **username, phone number, password, confirm password**.
- Username is required and unique. Phone number is required and unique.
- Full name is **not** collected during signup; the user may configure it later from the authenticated account profile.
- No account type is chosen during signup.
- Sign-in accepts either the account's **username or phone number**, together with its password.
- Password and confirm-password inputs provide independent show/hide controls.
- Every signup input has an input-specific placeholder/example so the expected value is obvious before typing.
- Signup and sign-in validate all submitted fields in one pass. Every invalid input receives a red border/label and an exact localized error directly below that input; focus moves to the first invalid field in visual/form order.
- Multiple invalid inputs are shown simultaneously rather than stopping after the first error.
- Credential mismatch on sign-in intentionally marks both identifier and password because authentication must not reveal which credential was correct.
- New passwords require at least 8 characters, at least one letter, at least one number, and at least one special character; the signup screen shows these requirements with live completion indicators.
- The signup form avoids role-model explanatory copy; it uses a concise sports-oriented signup title and keeps role education for the post-signup role flow.
- A user may later add participation roles to the same identity. The initial self-service roles are Player, Venue Owner, Team Manager, and Referee.
- Activating Team Manager also enables Player capability because team participation is built on player identity; actual authority over a team remains object-scoped to that team's manager.
- Venue Staff, Competition Admin, and Platform Admin are controlled roles and must be assigned through authorized operational workflows rather than self-service.
- Roles are additive capabilities; they do not create a second login identity or change the user's username/phone credentials.

---

# 1. Executive Summary

Futsal is a mobile-first futsal venue marketplace, venue operating system, competition manager, and futsal community platform built initially for Afghanistan.

Its primary commercial problem is not merely “futsal lacks an app.” It is that futsal venue capacity is perishable inventory. A 90-minute slot that passes unbooked can never be sold later. Many venues still coordinate availability through phone calls, WhatsApp, Facebook, notebooks, or in-person visits, so players cannot reliably see open times and venue owners cannot efficiently expose or discount unsold inventory. The result is lost revenue for owners and unnecessary friction for players.

Futsal’s core loop is:

**Venue publishes real availability → player discovers a suitable slot → player reserves → venue calendar updates atomically → both sides receive confirmation → slot is fulfilled → utilization and revenue analytics improve future decisions.**

Around that loop, Futsal adds a venue-specific social presence and competition system: venue owners can publish posts, promote empty slots, run leagues and tournaments, invite teams, schedule matches, record results, update standings and brackets, and track player statistics.

The defining business rule is:

**One venue-owner account = one venue = one subscription.**

A new venue-owner account may start one **72-hour / 3-day Premium trial** after completing venue setup and explicitly starting the trial. When the trial ends, an active paid subscription is required for ongoing Premium venue-management capability. If the same human owns another distinct venue, that second venue requires another venue-owner account and another subscription. The second legitimate venue may receive its own trial, but creating a duplicate account for the same venue must not reset trial eligibility.

Players use the core marketplace, bookings, teams, competitions, standings, and public community content for free. Venue subscription pricing should be configurable and validated with local owners before launch rather than hard-coded into the product specification.

The MVP should emphasize four measurable outcomes:

1. **Increase venue occupancy.**
2. **Reduce booking friction.**
3. **Give owners a reliable mobile operating calendar.**
4. **Create recurring venue-owner willingness to pay through visible revenue and utilization value.**

Competition and social features strengthen retention and create secondary revenue, but must not distract from the core inventory-and-booking engine.

---

# 2. Application Idea Analysis

## Core idea

Futsal combines four connected product layers:

1. **Venue marketplace and booking** — discovery, availability, reservations, cancellations, confirmations, discounted inventory.
2. **Venue operations** — owner calendar, manual bookings, blocked periods, pricing, staff permissions, revenue/occupancy analytics.
3. **Competition operations** — league, knockout, and group-to-knockout competitions; team registration; fixtures; results; standings; brackets; player statistics.
4. **Futsal community** — venue profiles, posts, announcements, tournament news, empty-slot promotions, followers, notifications, team/player identities.

## Product thesis

The strongest initial wedge is **venue utilization**, not social networking. If Futsal can help an owner sell even one or two additional otherwise-empty slots per week, the app can demonstrate concrete financial value. This makes the B2B subscription easier to justify than a product whose value is primarily exposure or community engagement.

## Highest-frequency workflows

- Player checks availability for tonight/tomorrow.
- Player books a slot.
- Owner checks today’s schedule.
- Owner creates a manual/walk-in booking.
- Owner blocks or reopens a time.
- Owner discounts a weak slot.
- Owner posts an availability/tournament update.
- Competition admin enters a result after a match.
- Team/player checks fixtures, standings, or bracket.

## Highest-value interactions

- Successful booking of previously unsold inventory.
- Fast conflict-free owner calendar operations.
- Repeat booking by returning players.
- Discount conversion on a low-demand slot.
- Competition registration that creates additional venue usage.
- Accurate public standings/results without manual recalculation.

## Main friction risks

- Owners may keep using notebooks/WhatsApp unless setup is extremely simple.
- Players will abandon the marketplace if displayed availability is stale.
- Fake bookings/no-shows can make owners distrust online reservations.
- Requiring digital payments too early could reduce adoption in Afghanistan.
- Too many social and competition features before booking reliability could dilute the product.
- Poor RTL implementation would make Dari/Pashto feel secondary.

## Adoption barriers

- Owner skepticism about subscription value.
- Limited digital payment options.
- Phone/data affordability and unstable connectivity.
- Venue owners already having established phone/WhatsApp habits.
- Need for enough venue supply before player marketplace value becomes obvious.

## Retention drivers

- Owner sees utilization/revenue improvement.
- Player sees accurate availability and saves time.
- Booking history and repeat-book shortcuts.
- Followers receive useful availability and tournament notifications.
- Teams accumulate competition history and statistics.
- Owners rely on Futsal as the source of truth for their daily schedule.

---

# 3. Problem and Opportunity

## Problem A — unsold perishable inventory

A venue may have roughly 10 bookable sessions in a day, yet manual scheduling can leave a significant number empty. An unused slot has zero residual value once its time passes.

### Opportunity

Expose real-time availability publicly and let owners promote/discount unsold sessions before they expire.

## Problem B — player booking friction

Players may need to call, message, ask friends, or physically visit multiple venues to find availability.

### Opportunity

Make “find a venue and reserve a suitable time” possible in a few mobile steps.

## Problem C — fragmented owner operations

Walk-ins, phone reservations, tournament blocks, maintenance, and online bookings may live in different places.

### Opportunity

Use one calendar as the operational source of truth, regardless of booking origin.

## Problem D — weak futsal-specific marketing channel

Facebook and WhatsApp are useful communication tools but are not structured around bookable inventory, competition objects, standings, brackets, or venue conversion.

### Opportunity

Give every venue a futsal-first public profile and feed tied directly to booking and competition actions.

## Problem E — manual competition administration

Fixtures, results, standings, knockout progression, player statistics, and registrations are often maintained manually.

### Opportunity

Connect competition administration to venue capacity, team/player identity, and the same community that books the venue.

## Problem F — limited secondary revenue

Venue owners may earn mainly from ordinary rentals even when competitions could create registration fees, sponsorship opportunities, extra bookings, and repeat traffic.

### Opportunity

Make competitions a structured revenue-generating product, not just a spreadsheet workflow.

---

# 4. Target Users

## Primary users

### Futsal venue owners

Need to increase occupancy, manage the venue schedule, reduce booking administration, run competitions, promote inventory, and understand performance.

### Futsal players

Need to find reliable availability, book quickly, manage reservations, join teams, follow competitions, and discover relevant futsal activity.

### Team managers / captains

Need roster management, competition registration, invitations, fixtures, results, and team history.

### Competition administrators

Need formats, registrations, scheduling, results, standings, brackets, player statistics, and public updates.

## Secondary users

- Venue staff.
- Referees/officials.
- Fans/spectators.
- Future sponsors and local businesses.
- Platform operations/support staff.

## Geographic strategy

Launch city by city. Kabul is a natural pilot market, but the data model should support all Afghan provinces and later expansion to other countries without embedding Afghanistan-only assumptions into core identifiers or database relationships.

---

# 5. User Personas

| Persona | Goals | Common Tasks | Frustrations | Technical Comfort | Frequency | Highest-Value Functionality |
|---|---|---|---|---|---|---|
| Venue Owner | Fill slots, reduce admin, grow revenue | Calendar, bookings, discounts, competitions, posts | Empty sessions, calls, double booking, manual standings | Low–medium | Daily | Schedule + occupancy/revenue dashboard |
| Venue Staff | Run day-to-day operations | Confirm arrivals, create manual bookings, block time | Unclear authority, scattered records | Low–medium | Daily | Fast calendar operations |
| Player | Find and reserve a pitch | Search, compare, book, cancel, repeat | Unknown availability, travel/calls, last-minute changes | Medium | Weekly | Accurate availability + fast booking |
| Team Manager | Organize a team | Invite players, register competitions, view fixtures | Group-chat coordination, roster confusion | Medium | Weekly | Team + competition management |
| Competition Admin | Run fair, visible competitions | Teams, fixtures, results, tables, brackets | Spreadsheet errors, slow updates | Medium | Event-heavy | Competition engine |
| Referee | Know assignments and submit match info | View match, assignment, notes | Schedule changes, unclear venue/time | Low–medium | Event-heavy | Match assignment + notifications |
| Fan | Follow local futsal | Fixtures, results, standings, posts | Information scattered across social media | Low–medium | Weekly | Public competition pages/feed |
| Platform Admin | Operate Futsal safely | Venue review, billing, moderation, support | Fraud, abuse, billing exceptions | High | Daily | Admin console + audit logs |

---

# 6. Reference UI Analysis

No screenshots or explicit visual mockups were supplied with the master documentation prompt. Therefore this specification does **not** infer exact visual layouts from a reference screenshot.

Current product research does provide interaction references:

- Playtomic demonstrates the value of a player-facing marketplace tied to club booking, customer management, occupancy, activities, and revenue reporting. Its manager documentation states that some management features are limited on mobile browsers, which supports Futsal’s decision to make owner operations genuinely mobile-first. [R1][R2]
- CourtReserve demonstrates configurable booking prices, public booking, memberships, reporting, and leagues, but its current public pricing begins at USD 199/month, making direct price imitation inappropriate for an Afghanistan-first launch. [R3]
- EZFacility demonstrates integrated facility scheduling with automated league/tournament scheduling, standings, scorecards, officials, and registration. [R4]
- OpenSports demonstrates mobile sports community management, events, leagues/tournaments, staff, schedules, chat, and payments. [R5]
- Tournify demonstrates lightweight tournament/league setup, standings, schedules, and public presentation. [R6]
- Challonge demonstrates simple tournament creation, brackets, communities, announcements, and low-cost organizer plans. [R7]
- Maidan is a highly relevant Afghanistan-focused emerging product with trilingual RTL, teams, matchmaking, live scoring, venue booking requests, player careers, and planned tournaments. [R8]
- Futsaly is another Afghanistan-focused emerging platform centered on fixtures, competitions, teams, players, and sport-hall discovery. [R9]

---

# 7. UI Inspiration Synthesis

Futsal should adopt the following patterns without cloning any competitor:

- **Availability-first discovery:** date/time availability visible early, not hidden behind venue detail screens.
- **Owner calendar as home:** owner landing experience should answer “what is happening today?” immediately.
- **One-tap operational actions:** reserve, block, mark arrived, cancel, discount, enter result.
- **Competition information hierarchy:** competition overview → fixtures/results → standings/bracket → teams → stats.
- **Futsal-native scoring:** goals, assists, cards, fouls, goalkeeper clean sheets where configured.
- **Public profile + conversion:** every venue post or promotion should lead naturally to a venue, competition, or bookable slot.
- **Full RTL, not mirrored as an afterthought:** navigation, icons with directional meaning, tables/cards, number handling, and date/time presentation must be tested in Dari and Pashto.
- **Low-density mobile cards:** avoid forcing desktop tables onto small screens; standings and schedule can use compact horizontal scroll only when necessary.

Visual tone: energetic and sports-focused, but operational screens must remain calm, readable, and fast rather than visually noisy.

---

# 8. Market Landscape

## Direct / near-direct Afghanistan competitors

### Maidan

Publicly describes a coming iOS/Android futsal platform for Afghanistan with Dari, Pashto, and English; full RTL; teams/rosters; matchmaking; live futsal scoring; player/team statistics; venue discovery and availability; booking requests; and planned tournaments. [R8]

**Implication:** “Afghan futsal + trilingual + booking + stats” is not sufficient differentiation by itself.

### Futsaly

Positions itself as an Afghanistan futsal platform for fixtures, results, tournaments, leagues, teams, players, sport halls, and public discovery. Its public site describes sport-hall availability/booking-ready information but does not currently document a full owner SaaS operating model. [R9]

**Implication:** public futsal information and competition discovery are also becoming contested.

## Global / adjacent products

### Playtomic

Racket-sports-centric marketplace/club platform with online booking, customer management, activities, tournaments, communication, occupancy/revenue reporting, and APIs. Its API currently recognizes FUTSAL as a sport type. [R1][R10]

### EZFacility

Sports-facility management covering scheduling, leagues, tournaments, officials, registration, payments, standings, scores, and facility operations. [R4]

### CourtReserve

Court/club management focused on reservations, public booking, memberships, events, reporting, pricing rules, and flex leagues. [R3]

### OpenSports

Sports organization platform with events, memberships, league/tournament management, schedules, staff, communications, payments, and branded experiences. [R5]

### Bookteq

Sports-facility booking and utilization management with single/repeat/block bookings, reporting, payment options, and facility hierarchy. [R11]

### Tournify

Competition-focused scheduling, standings, public pages, brackets, team limits, and mobile publication. [R6]

### Challonge

Generic competition and community platform offering tournament formats, standings/brackets, announcements, registrations, and organizer subscriptions. [R7]

### TeamSnap Tournaments

Tournament administration with teams/divisions, pool play, brackets, schedules, officials, rosters, scores, and public following. [R12]

---

# 9. Competitor Analysis

| Product | Audience | Strongest Use Case | Platform / Model | Relevant Capabilities | Futsal Lesson |
|---|---|---|---|---|---|
| Maidan | Afghan futsal players/teams/venues | Futsal identity, matchmaking, scoring, booking requests | Coming mobile app; public pricing not documented | Trilingual RTL, teams, live scoring, careers, booking requests | Compete on owner economics and reliable inventory operations |
| Futsaly | Afghan futsal ecosystem | Public information, competitions, venue discovery | Web platform; business model not publicly documented | Fixtures, standings, teams, sport halls | Make booking and B2B operations deeper than directory/discovery |
| Playtomic | Players + clubs | Marketplace + court booking | Consumer app + manager web | Bookings, occupancy, revenue, activities, tournaments | Marketplace liquidity + owner operational value matter together |
| EZFacility | Sports facilities | Facility + league operations | SaaS | Calendar, registration, brackets, officials, standings | Competition scheduling should share venue inventory |
| CourtReserve | Clubs/courts | Reservations + memberships | SaaS; from $199/mo public pricing | Public booking, leagues, reporting, custom costs | Flexible price rules are useful; local price point must differ |
| OpenSports | Clubs/leagues | Community + programs + leagues | SaaS; $30/$70/$750+ public tiers | Events, chat, leagues, schedules, payments | Community can drive utilization when tied to operations |
| Bookteq | Facility operators | Facility booking/utilization | SaaS | Facility hierarchy, bookings, reports | Model physical resources explicitly |
| Tournify | Organizers | Tournament/league management | Free + per-event/annual | Schedules, standings, public pages | Competition UX can be lightweight and fast |
| Challonge | Organizers/communities | Brackets/competitions | Free + low-cost premium | Formats, communities, announcements | Simple organizer workflows increase adoption |
| TeamSnap Tournaments | Sports organizations | Structured tournament ops | Commercial add-on | Pools, brackets, officials, scores | Role-specific competition administration is important |

---

# 10. Competitor Strengths

## Strengths worth adopting

- **Playtomic:** tight link between discoverability, reservations, occupancy and club revenue. [R1]
- **EZFacility:** integrated schedules, officials, registration, standings, and tournament operations. [R4]
- **CourtReserve:** configurable prices for different times/conditions and robust public booking. [R3]
- **OpenSports:** organization communication, registration, league/tournament management and staff workflow in one system. [R5]
- **Tournify:** low-friction competition setup and public live standings. [R6]
- **Challonge:** easy bracket/community publishing and accessible entry pricing. [R7]
- **Maidan:** Afghanistan-native language/RTL and futsal-specific scoring detail. [R8]

## Product influence

Futsal should combine these strengths only where they reinforce the primary venue-utilization loop. It should not copy broad membership/academy functionality, generalized multi-sport complexity, or enterprise features that do not help a futsal venue sell and operate capacity.

---

# 11. Competitor Weaknesses

## Verified product limitations / constraints

- Playtomic Manager is a web app rather than a native owner app, and its own documentation says some features are limited on mobile and desktop may be needed for full access. Futsal should make the owner’s daily calendar genuinely mobile-native. [R2]
- CourtReserve’s public pricing currently starts at USD 199/month, which is useful context but not a suitable pricing benchmark for an Afghanistan-first small-venue product. [R3]
- OpenSports’ integrated online payment model is tied to Stripe; Stripe’s supported-country list does not list Afghanistan. Futsal therefore needs a locally viable payment strategy rather than assuming Stripe. [R5][R13]
- Tournify and Challonge are strong competition tools but are not full venue inventory marketplaces. [R6][R7]
- Bookteq is strong for facility bookings but is not positioned as a futsal-specific player/team social layer. [R11]

## Verified recurring user complaints (community-sourced, not treated as universal facts)

Recent Playtomic community discussions include frustration about fees, inconsistent filters/search behavior, and confusion around booking/payment responsibility. These are user reports rather than verified platform-wide defects, but they support the principle that booking rules and fees must be extremely transparent. [R14][R15]

## Product analysis

- Broad multi-sport systems risk higher complexity than a single-venue futsal owner needs.
- Competition-only systems require separate booking and customer systems.
- A social-first product can create engagement without proving revenue impact to the venue owner.

## Assumptions requiring validation

- Afghan venue owners will pay monthly if Futsal clearly fills additional slots.
- Owners prefer one account per venue rather than a multi-location organization account.
- Teams value persistent player statistics enough to improve retention.

These assumptions must be tested in pilot interviews and real usage.

---

# 12. Market Gaps

## Gap 1 — Revenue recovery for unsold futsal slots

**Existing problem:** empty sessions expire unsold.  
**Why users care:** owners lose revenue and players miss available opportunities.  
**Competitor handling:** global booking platforms expose availability; not all are localized for Afghan futsal.  
**Futsal solution:** “Available tonight,” “Tomorrow,” and “Discounted” inventory surfaces plus owner promotions.  
**Improvement:** directly ties software value to recovered revenue.

## Gap 2 — Afghanistan-first venue SaaS

**Existing problem:** global systems may be expensive, broad, payment-dependent, or weakly localized.  
**Futsal solution:** Dari/Pashto/English, RTL, AFN, low-bandwidth behavior, local payment options, simple one-venue account model.

## Gap 3 — Booking + competition + venue social presence

**Existing problem:** owners may need separate calendar, social channel, spreadsheet, and tournament tool.  
**Futsal solution:** one venue profile connects inventory, posts, competitions, fixtures, standings and offers.

## Gap 4 — Operational mobile-first ownership

**Existing problem:** some manager systems are desktop/web optimized.  
**Futsal solution:** today’s schedule, walk-ins, blocking, discounts, results and posts are optimized for phone use.

## Gap 5 — Local payment flexibility

**Existing problem:** international payment assumptions may not hold in Afghanistan.  
**Futsal solution:** pay-at-venue/manual payment first; optional HesabPay integration later; payment layer abstracted from booking logic. HesabPay documents hosted checkout, AFN, AfPay, wallet, cards, sandbox and webhooks. [R16]

---

# 13. Product Vision

Futsal should become the operating and demand platform for independent futsal venues: the place where venue capacity is published, players discover and reserve it, owners run the day, competitions create additional demand, and the resulting activity forms a trusted local futsal network.

Long-term user loop:

**Discover → book → play → follow → join team → enter competition → build history → receive relevant availability → book again.**

Long-term owner loop:

**Configure capacity → receive bookings → fill weak periods → run competitions → publish content → measure occupancy/revenue → optimize pricing → renew subscription.**

---

# 14. Value Proposition

## For players

“See real futsal availability and reserve a suitable venue without calling or visiting multiple owners.”

## For venue owners

“Turn your venue calendar into a public sales channel, reduce empty sessions, manage bookings and competitions from your phone, and see whether Futsal is increasing utilization.”

## For teams and organizers

“Run local futsal competitions with fixtures, standings, brackets, teams and player statistics connected to the venue where matches actually happen.”

---

# 15. Differentiators

1. **Empty-slot revenue engine** — unsold inventory and discounts are first-class product objects.
2. **One-venue operational simplicity** — one owner account, one venue, one subscription, clear data isolation.
3. **Afghanistan-first UX** — Dari, Pashto, English, RTL, AFN, low-bandwidth patterns.
4. **Native mobile owner operations** — schedule and booking management designed for phone use.
5. **Futsal-specific competition engine** — not a generic event list.
6. **Venue profile that converts content to bookings** — posts link to slots/competitions.
7. **Cash-friendly but payment-ready** — product works without requiring online card payment.
8. **Shared inventory between bookings and competitions** — tournament matches block the same physical resource calendar.
9. **Transparent trial economics** — 3-day Premium trial with explicit expiry, no silent lockout of existing obligations.

---

# 16. Product Principles

- Booking accuracy before feature count.
- Mobile-first for both player and owner.
- Three-tap or fewer path to the most common actions where practical.
- One source of truth for venue occupancy.
- No hidden fees or ambiguous booking status.
- Offline-aware, not offline-fiction: clearly distinguish cached information from live availability.
- RTL is a foundational layout mode.
- Preserve entered data on recoverable failures.
- Progressive disclosure for competition complexity.
- Deterministic automation before AI.
- Least-privilege permissions.
- Public data and private operational data must be clearly separated.
- Do not lock owners out of information needed to honor already-accepted bookings.

---

# 17. User Roles

## Visitor

Can browse public venues, selected public posts, competitions, fixtures, standings and brackets. Cannot book or interact until authenticated.

## Player / Registered User

Can book, cancel within policy, follow venues/competitions, create or join teams, view history, receive notifications, and maintain an optional player profile.

## Team Manager

Player permissions plus team roster management, invitations, competition registration and team-level actions.

## Referee

Registered user with assigned-match access and limited officiating actions when granted by a competition admin.

## Venue Staff

Delegated operational role within exactly one venue. Permissions are granular: schedule, bookings, check-in, posts, competition operations, analytics view.

## Competition Admin

Delegated role scoped to one or more competitions owned by a venue. Can manage teams, fixtures, matches, results and competition content within granted scope.

## Venue Owner

Owns exactly one venue account, controls staff/delegation, venue settings, subscription, pricing, schedule, posts, competitions and analytics.

## Platform Admin

Futsal internal role with platform-wide moderation, venue review, subscription override, support, configuration and audit capabilities.

> Product persona “Fan” maps to Visitor or Registered User without requiring a player profile.

---

# 18. Permission Matrix

## 18.1 Public and participant roles

| Capability | Visitor | Player | Team Manager | Referee |
|---|---:|---:|---:|---:|
| Browse public venues | Yes | Yes | Yes | Yes |
| View live availability | Yes | Yes | Yes | Yes |
| Create booking | No | Yes | Yes | Yes |
| Manage own booking | No | Yes | Yes | Yes |
| Create team | No | Yes | Yes | Yes |
| Manage team roster | No | Own team if manager | Yes | Own team if manager |
| Register team for competition | No | If team manager | Yes | If team manager |
| Enter competition result | No | No | No | Only if explicitly granted |
| View public competition data | Yes | Yes | Yes | Yes |
| Moderate users/content | No | No | No | No |

## 18.2 Venue and administrative roles

| Capability | Venue Staff | Competition Admin | Venue Owner | Platform Admin |
|---|---:|---:|---:|---:|
| Create manual venue booking | If granted | No | Yes | Override |
| Block venue time | If granted | No | Yes | Override |
| Edit venue profile | If granted | No | Yes | Override |
| Manage pricing | If granted | No | Yes | Override |
| Create venue posts | If granted | If granted | Yes | Moderate |
| Create competition | If granted | If delegated | Yes | Override |
| Manage teams/registrations in competition | If granted | Yes | Yes | Override |
| Enter competition result | If granted | Yes | Yes | Override |
| Manage venue staff | No | No | Yes | Override |
| View private venue analytics | If granted | No | Yes | Yes |
| Manage subscription | No | No | Yes | Yes |
| Suspend venue/user | No | No | No | Yes |
| Platform-wide moderation | No | No | Own content only | Yes |


# 19. Information Architecture

```text
Futsal
├── Public / Discovery
│   ├── Home
│   ├── Venues
│   │   ├── Venue Detail
│   │   └── Availability
│   ├── Competitions
│   │   ├── Overview
│   │   ├── Fixtures & Results
│   │   ├── Standings / Groups
│   │   ├── Bracket
│   │   ├── Teams
│   │   └── Statistics
│   ├── Feed
│   ├── Team Profiles
│   └── Player Profiles
├── Authentication
│   ├── Register
│   ├── Login
│   ├── Verification / Recovery
│   └── Sessions
├── Player Workspace
│   ├── Discover
│   ├── My Bookings
│   ├── My Teams
│   ├── Following
│   ├── Notifications
│   └── Profile / Settings
├── Venue Owner Workspace
│   ├── Owner Dashboard
│   ├── Today / Schedule
│   ├── Bookings
│   ├── Availability & Pricing
│   ├── Promotions
│   ├── Posts
│   ├── Competitions
│   ├── Teams / Registrations
│   ├── Analytics
│   ├── Staff & Permissions
│   ├── Venue Settings
│   └── Subscription
├── Referee Workspace
│   ├── Assignments
│   └── Match Detail
└── Platform Administration
    ├── Dashboard
    ├── Users
    ├── Venues
    ├── Subscriptions / Trials
    ├── Moderation / Reports
    ├── Configuration
    └── Audit Logs
```

---

# 20. Sitemap

## Public / shared mobile destinations

- `/home`
- `/venues`
- `/venues/:venueId`
- `/venues/:venueId/availability`
- `/competitions`
- `/competitions/:competitionId`
- `/competitions/:competitionId/fixtures`
- `/competitions/:competitionId/standings`
- `/competitions/:competitionId/bracket`
- `/competitions/:competitionId/teams`
- `/competitions/:competitionId/stats`
- `/feed`
- `/posts/:postId`
- `/teams/:teamId`
- `/players/:playerId`

## Authenticated player destinations

- `/bookings`
- `/bookings/:bookingId`
- `/teams/mine`
- `/teams/create`
- `/notifications`
- `/profile`
- `/settings`

## Venue-owner destinations

- `/owner/onboarding`
- `/owner/dashboard`
- `/owner/schedule`
- `/owner/bookings/:bookingId`
- `/owner/availability`
- `/owner/pricing`
- `/owner/promotions`
- `/owner/posts`
- `/owner/competitions`
- `/owner/competitions/create`
- `/owner/competitions/:id/manage`
- `/owner/analytics`
- `/owner/staff`
- `/owner/venue`
- `/owner/subscription`

## Referee destinations

- `/referee/assignments`
- `/referee/matches/:matchId`

## Platform admin destinations

May be implemented as an internal responsive web console or protected mobile/admin surface:

- `/admin`
- `/admin/users`
- `/admin/venues`
- `/admin/subscriptions`
- `/admin/reports`
- `/admin/configuration`
- `/admin/audit`

---

# 21. Page Inventory

## 21.1 Purpose and access

| Page | Route | Roles | Purpose |
|---|---|---|---|
| Home / Discover | `/home` | All | Fast access to availability and activity |
| Venue List | `/venues` | All | Compare venues |
| Venue Detail | `/venues/:id` | All | Convert interest to booking |
| Availability | `/venues/:id/availability` | All | Show live bookable inventory |
| Booking Confirm | modal/screen | Player | Finalize reservation |
| My Bookings | `/bookings` | Player | Manage reservations |
| Booking Detail | `/bookings/:id` | Player/Owner/Staff | Booking source of truth |
| Feed | `/feed` | All | Futsal updates and promotions |
| Competition List | `/competitions` | All | Discover competitions |
| Competition Detail | `/competitions/:id` | All | Competition hub |
| Standings | `/competitions/:id/standings` | All | League/group table |
| Bracket | `/competitions/:id/bracket` | All | Knockout progress |
| Team Detail | `/teams/:id` | All | Team identity |
| Player Profile | `/players/:id` | All subject to privacy | Player history |
| Notifications | `/notifications` | Auth | Actionable updates |
| Owner Onboarding | `/owner/onboarding` | Owner | Configure venue and trial |
| Owner Dashboard | `/owner/dashboard` | Owner/Staff | Daily decisions |
| Owner Schedule | `/owner/schedule` | Owner/Staff | Operate inventory |
| Availability & Pricing | `/owner/availability` | Owner/Staff | Configure rules |
| Promotions | `/owner/promotions` | Owner/Staff | Sell weak slots |
| Competition Manager | `/owner/competitions/:id/manage` | Owner/Admin | Operate competition |
| Analytics | `/owner/analytics` | Owner | Prove business value |
| Staff | `/owner/staff` | Owner | Delegate safely |
| Subscription | `/owner/subscription` | Owner | Trial/billing status |
| Settings | `/settings` | Auth | Preferences/security |
| Admin Console | `/admin/*` | Platform Admin | Operate platform |

## 21.2 Interaction and mobile behavior

| Page | Main Components | Primary Actions | Important States | Mobile Pattern |
|---|---|---|---|---|
| Home / Discover | Date chip, quick search, venue/discount/competition cards | Search, book, follow | offline cache, no venues | Vertical feed + sticky search |
| Venue List | Search, filters, cards | Filter, open venue | no results, stale availability | Bottom-sheet filters |
| Venue Detail | Gallery, location, facilities, price, next slots, posts | View slots, book, follow | closed/suspended/unavailable | Hero + action bar |
| Availability | Date selector, slot cards, price/discount | Select slot | live/stale/full | Day carousel + cards |
| Booking Confirm | Venue, time, policy, price, payment mode | Confirm | conflict, session expired | Full-screen sheet |
| My Bookings | Upcoming/history tabs | Open, cancel, repeat | empty/offline | Cards |
| Booking Detail | Status, venue, time, contact, policy | Cancel/mark arrival | cancelled/no-show | Action sheet |
| Feed | Posts, offer cards | Open venue/competition | empty/offline | Infinite cards |
| Competition Detail | Header, format/status, tabs | Register/follow/view | draft/private/completed | Tabbed detail |
| Standings | Compact table/cards | Open team | not started | Horizontal-safe table |
| Bracket | Bracket rounds | Open match | TBD matches | Pan/zoom bracket |
| Owner Onboarding | Setup steps | Save/start trial | incomplete/review | Stepper |
| Owner Dashboard | Today schedule, occupancy, revenue, alerts | Add booking, discount | trial expired | KPI cards + agenda |
| Owner Schedule | Day/week timeline | Add, block, edit | conflict/offline | Day-first timeline |
| Availability & Pricing | Hours, duration, price, overrides | Save rule | validation | Forms + preview |
| Promotions | Eligible slots, discount | Publish offer | expired/full | Cards |
| Competition Manager | Teams, fixtures, results, publish controls | Generate/edit/result | draft/live/completed | Section tabs |
| Analytics | Occupancy, revenue, empty slots, discounts | Change period | low data | Simple charts/cards |
| Staff | Staff list, permissions | Invite/edit/revoke | invitation pending | Cards + permission sheet |
| Subscription | Plan, expiry, history | Pay/reactivate | trial/active/expired | Status card |
| Settings | Language, notifications, security | Save | offline | Grouped list |
| Admin Console | Queues/tables/details | verify, suspend, override | audit required | Desktop-first internal |


# 22. Detailed Page Specifications

## 22.1 Home / Discover

**Purpose:** Get a player to useful inventory quickly.  
**Allowed users:** Visitor and authenticated users.  
**Entry:** App launch, bottom navigation Home.  
**Mobile layout:** City/location selector, date shortcut (“Today”, “Tomorrow”), prominent “Find a slot” action, discounted/soon-expiring availability, followed venues, live/upcoming competitions and recent venue posts.  
**Primary actions:** Search venues, choose date/time, open slot, open competition.  
**Loading:** Skeleton cards; never show blank white screen.  
**Offline:** Show last cached venue/post content with a clear “Availability may be out of date” banner; booking actions require live connection.  
**Empty:** Encourage changing city/date and show public competitions if no venue inventory exists.

## 22.2 Venue List / Search

**Purpose:** Compare venues for a particular need.  
**Filters:** city/province, date, time range, available-only, price range, discount, facilities, distance when location permission is granted.  
**Sorting:** soonest available, nearest, price low-to-high, rating (after reviews launch).  
**Interaction:** Filters open in a bottom sheet; selected filters persist when opening a venue and returning.  
**No results:** Explain which constraints produced no result and offer one-tap filter reset.

## 22.3 Venue Detail

**Information:** name, verification status, images, address text, map pin, phone/WhatsApp if public, facilities, opening hours, base price, playing areas, cancellation policy, next available slots, active promotions, upcoming competitions, recent posts.  
**Primary action:** “View availability.”  
**Secondary:** Follow, call/contact, directions, share.  
**Suspended venue:** Public booking disabled; page may remain visible with neutral “Online booking unavailable” state unless platform admin hides it.

## 22.4 Availability

**Purpose:** Present live inventory for one venue/date.  
**Data freshness:** Screen must revalidate on entry, pull-to-refresh, foreground return, and immediately before booking confirmation.  
**Slot card:** start time, duration, playing area, normal price, discounted price if any, status.  
**Unavailable reasons:** booked, blocked, competition, closed, pending hold.  
**Cached state:** Cached slots may be shown for orientation but cannot be presented as guaranteed live availability.

## 22.5 Booking Confirmation

**Inputs:** selected venue/area/time, user contact, optional note, acceptance of cancellation/no-show policy, payment method if applicable.  
**Logic:** Server re-checks availability atomically. Client must never assume a slot remains available because it was visible seconds earlier.  
**Success:** booking identifier, confirmation state, calendar time, venue contact, policy, deep link to detail.  
**Conflict:** Explain that another booking took the slot and return the user to refreshed availability with nearby alternatives.

## 22.6 My Bookings / Booking Detail

Tabs: Upcoming, Pending (if venue uses approval mode), History.  
Actions: cancel if policy permits, repeat booking/search same time next week, contact venue.  
Booking detail must show a human-readable status and source-of-truth timestamps.  
Owner/staff version adds customer identity, source (online/manual/competition), payment status, attendance/no-show, internal notes.

## 22.7 Feed / Post Detail

Post types: announcement, empty-slot promotion, competition update, result, general venue update.  
MVP authoring: venue owners/staff and authorized competition admins.  
Every promotional post should support a structured CTA to a venue, slot, or competition rather than relying only on free text.  
Player comments and general user posting are deferred to reduce moderation complexity.

## 22.8 Competition Public Hub

Header: name, logo, venue, format, status, dates, registration state.  
Tabs: Overview, Fixtures/Results, Standings/Groups, Bracket (when relevant), Teams, Statistics.  
Registration action appears only when open and the user is an eligible team manager.  
Draft competitions are visible only to administrators until published.

## 22.9 Team and Player Profiles

Team: logo, manager, captain, roster, competition history, recent results, trophies/achievements, aggregate stats.  
Player: display name, photo, position, current team(s), competition appearances, goals, assists, cards, goalkeeper stats where relevant.  
Private contact information is never public.  
Statistics must identify their competition/source and should not imply official federation status unless explicitly verified.

## 22.10 Owner Onboarding

Steps:
1. Verify owner account.
2. Enter venue identity and contact.
3. Pin location / enter address.
4. Create at least one playing area.
5. Define opening hours.
6. Define default session duration and price.
7. Preview public venue page.
8. Start 3-day Premium trial.

The trial clock starts only when the owner explicitly starts it after minimum setup is complete, not at account creation.

## 22.11 Owner Dashboard

Top priority: today’s schedule.  
Then: booked/available count, occupancy %, booked revenue, unpaid/manual payments, weak upcoming slots, current subscription state, competition tasks.  
Primary actions: “Add booking,” “Block time,” “Create discount,” “Create competition,” “Post update.”  
Expired subscription: dashboard shifts to service-continuity mode with clear reactivation CTA.

## 22.12 Owner Schedule

Default mobile view: day timeline by playing area.  
Colors/status should be backed by text/icon labels, not color alone.  
Tap empty time → manual booking/block/offer.  
Tap occupied time → detail.  
Owner can switch to week overview, but daily operations remain primary.  
Concurrent edits require server conflict validation.

## 22.13 Availability & Pricing

Supports weekly opening hours, closed days, session duration, base price, area-specific rules, date overrides, special hours, maintenance blocks, and one-off prices.  
MVP should avoid an overly complex rules engine: priority order should be explicit and previewable.

Recommended priority:
1. Closed/blocked/competition occupancy.
2. One-off date/time override.
3. Day/time price rule.
4. Default area price.

## 22.14 Promotions

Owner selects an eligible future available interval and sets discounted price or percentage, expiry, optional post text.  
Promotion automatically becomes unavailable if the slot is booked, blocked, or the start time passes.  
No promotion can create a negative price or exceed configured platform limits.

## 22.15 Competition Manager

Admin sections: Setup, Teams, Schedule, Matches, Standings/Bracket, Statistics, Posts, Settings.  
Publishing requires minimum valid configuration for the selected format.  
A scheduled match creates calendar occupancy on the linked playing area.  
Editing a match time must validate venue conflicts.

## 22.16 Analytics

MVP analytics:
- Total bookable sessions/time.
- Booked sessions/time.
- Occupancy percentage.
- Gross booked revenue estimate.
- Collected/confirmed revenue when payment status is used.
- Empty sessions.
- Discounted bookings and discount conversion.
- Online vs manual booking share.
- Returning bookers.

Never imply accounting-grade revenue if cash collection was not confirmed.

## 22.17 Subscription

States: Trial, Active, Grace (optional future), Expired, Cancelled.  
Shows trial/renewal dates and remaining time.  
When expired, user can still access billing and the limited service-continuity screens needed to fulfill existing accepted bookings.

## 22.18 Admin Console

Operational queues: venue verification, trial/subscription exceptions, user reports, duplicate venue suspicion, suspended accounts, payment reconciliation, support cases.  
Every privileged override creates an audit record with actor, timestamp, object, old value/new value and optional reason.

---

# 23. Navigation

## Player bottom navigation

**Home · Venues · Competitions · Feed · Profile**

Notifications appear via a header icon/badge. My Bookings and My Teams live under Profile or contextual shortcuts; if usage data shows bookings are more frequent than Feed, the nav may be A/B validated later without changing product behavior.

## Venue owner bottom navigation

**Dashboard · Schedule · Competitions · Posts · More**

“More” contains Analytics, Promotions, Staff, Venue Settings, Subscription and Account.

## Referee navigation

**Assignments · Competitions · Notifications · Profile**

## Navigation rules

- Do not show owner-only destinations to ordinary players.
- Expired owner accounts still see Schedule in limited continuity mode plus Subscription.
- Deep links from notifications must preserve role/permission checks.
- RTL reverses visual navigation direction where appropriate while preserving semantic order and accessibility labels.

---

# 24. User Journeys

## Journey A — Player books an available slot

**Trigger:** Wants to play at a particular date/time.  
**Steps:** Home → choose date/time or venue → availability → select slot → login if needed → confirm policy/payment mode → server reserves atomically → confirmation.  
**Success:** Confirmed booking visible in both player and owner calendars.  
**Failures:** slot taken, venue suspended, network lost, policy invalid.  
**Recovery:** refreshed alternatives; preserve chosen date/time filters.

## Journey B — Owner gets first value

Register owner → verify → create venue → add playing area → set hours/duration/price → preview → start 3-day Premium trial → publish availability → receive first online booking.

**Activation event:** first successful online booking or first manual/online schedule day completed, whichever occurs first.

## Journey C — Owner fills a weak slot

Owner dashboard identifies open near-term slot → owner creates discount → optional promotional post/push to followers → player opens offer → books → offer closes automatically.

## Journey D — Manual walk-in/phone reservation

Owner Schedule → tap available interval → Manual Booking → enter customer name/phone optional → confirm → calendar blocks interval → analytics marks source as manual.

## Journey E — Create league

Owner → Competitions → Create → select League → details/rules/registration → add/invite teams → generate or manually create fixtures → publish → enter results → standings update automatically → complete/archive.

## Journey F — Create knockout competition

Owner → Create Knockout → team count/seeding → registration → bracket generation → schedule matches → enter winner/results → next round progresses → champion → complete.

## Journey G — Group to knockout

Owner → Create Group + Knockout → groups/team assignment → group fixtures → results/standings → qualification rules → seed knockout → bracket → champion.

## Journey H — Trial expires

Trial reminder → 72 hours reached → owner subscription state Expired → future online booking creation disabled → venue availability stops accepting new online reservations → owner retains access to existing accepted bookings and billing → owner pays/reactivates → full management restored without data loss.

## Journey I — Second venue by same human

Owner attempts to add another venue → system explains one-account-one-venue rule → provides “Create another venue account” guidance → new account/venue requires its own subscription → anti-abuse checks prevent the same physical venue receiving another trial.

---

# 25. Feature Specifications

## 25.1 Venue Discovery

**Problem:** Players cannot efficiently compare live availability.  
**Users:** Visitors/players.  
**Inputs:** city/location, date, time, filters.  
**Output:** relevant venue cards with verified live/near-live availability indicators.  
**Business rules:** availability claims must have freshness timestamp; cached data cannot be presented as guaranteed.  
**Analytics:** search_performed, venue_opened, availability_viewed.

## 25.2 Venue Availability Engine

**Problem:** Manual calendars cause stale or conflicting information.  
**Inputs:** opening rules, areas, blocks, bookings, competition matches, overrides, promotions.  
**Output:** computed available intervals.  
**Logic:** derive availability from rules minus occupancy; enforce overlap protection server-side.  
**Edge cases:** daylight/timezone, overnight hours, owner edit while user is booking, competition reschedule.  
**Analytics:** slot_shown, slot_unavailable_reason, slot_conflict.

## 25.3 Booking

**Modes:** instant-confirm (recommended default) and owner-approval (optional venue setting).  
**Inputs:** user, area, start/end, source, price, policy acceptance.  
**Output:** pending/confirmed booking.  
**Validation:** live availability, account state, venue subscription, cancellation/no-show restrictions.  
**Error:** conflict must be friendly and immediately offer refreshed inventory.  
**Future:** deposits/split payments.

## 25.4 Owner Manual Booking

Allows phone/walk-in business to use the same source-of-truth calendar. Customer account is optional; owner may store a minimal guest contact subject to privacy policy.

## 25.5 Empty-Slot Promotion

Manual in MVP. Owner chooses a real available interval and temporary discounted price. Promotion can appear on venue page, Home and Feed, and optionally trigger follower notifications subject to frequency limits.

## 25.6 Venue Posts

Supports text, images, structured CTA, publish time, optional competition/slot link. Draft/scheduled posting can be V1.1. MVP supports immediate publish/unpublish.

## 25.7 Teams

Players create teams, assign manager/captain, invite roster members, set logo/name, and participate in competitions. Duplicate active membership rules should be competition-configurable rather than globally prohibiting a player from multiple teams.

## 25.8 Competition Engine

MVP formats:
- League.
- Single-elimination knockout.
- Group stage → single-elimination knockout.

Core capabilities: team registration/invites, capacity, fixtures, venue/time assignment, result entry, standings, bracket progression, publish/unpublish, completion.

## 25.9 Standings

Default points: win 3, draw 1, loss 0, configurable per competition.  
Default tie-break order: points → goal difference → goals for → head-to-head (optional/configurable) → admin tie-break.  
All recalculation must be deterministic and auditable.

## 25.10 Match Statistics

MVP: score, scorers, assists optional, yellow/red cards, player of match optional, lineup/appearance, goalkeeper clean sheet where applicable.  
Advanced futsal events such as accumulated fouls/substitutions/live minute-by-minute scoring are V1.1/V2 unless required by pilot organizers.

## 25.11 Notifications

Booking lifecycle, slot promotion, competition invitation, team invitation, fixture/reminder/change, result publication, trial/subscription reminders. Notification preference and frequency control required.

## 25.12 Analytics

Owner-facing business analytics prioritize occupancy and realized/estimated revenue, not decorative charts. Platform analytics measure marketplace liquidity, booking success, venue activation and subscription conversion.

## 25.13 Reviews

V1.1: only completed bookings create review eligibility. Rating dimensions may include ground quality, facilities, cleanliness, staff and value. Review moderation/reporting required.

## 25.14 Staff Delegation

Owner invites staff with explicit capabilities. Staff never gain subscription ownership or ability to transfer venue ownership unless a platform-admin workflow exists.

---

# 26. Business Rules

**RULE-001 — One venue per owner account.** A venue-owner account may own/manage exactly one venue record.

**RULE-002 — One subscription per venue-owner account.** Subscription entitlement applies only to the venue attached to that account.

**RULE-003 — Additional venue requires additional account.** A second distinct venue owned by the same human requires another owner account and separate subscription.

**RULE-004 — Trial duration.** Premium trial lasts exactly 72 hours from `trial_started_at`.

**RULE-005 — Trial starts explicitly.** Creating an account does not start the trial. Minimum venue setup must be complete and the owner must choose Start Trial.

**RULE-006 — One trial per physical venue/business identity.** Creating another account for the same venue does not create a new trial entitlement.

**RULE-007 — Legitimate second venue.** A truly distinct venue may receive its own trial even if beneficial ownership overlaps, subject to anti-abuse checks.

**RULE-008 — Trial expiry enforcement is server-side.** Client UI alone must never grant Premium access.

**RULE-009 — Expired owner accounts cannot accept new online bookings.** New public reservation creation is disabled until reactivation.

**RULE-010 — Existing obligations remain accessible.** After expiry, owner can view upcoming accepted bookings and perform the limited actions necessary to fulfill/close them.

**RULE-011 — No data deletion on ordinary expiry.** Subscription expiry does not delete venue, bookings, competition or analytics data.

**RULE-012 — Venue subscription state controls owner write entitlements.** Trial/Active allow full Premium actions; Expired/Cancelled allow only explicitly permitted continuity actions.

**RULE-013 — Booking conflict protection.** No two active occupancy records may overlap the same playing area/time unless the system explicitly models shared resources.

**RULE-014 — Booking creation is atomic.** Availability check and reservation write occur in one protected transaction/locking strategy.

**RULE-015 — Manual and online bookings share the same calendar.** Manual origin does not bypass conflict rules.

**RULE-016 — Competition matches consume venue capacity.** A scheduled match blocks the linked playing area interval.

**RULE-017 — Blocked/maintenance time cannot be booked.** Owner override requires explicit unblock/edit.

**RULE-018 — Promotions apply only to available future inventory.** Booking/blocking/expiry automatically invalidates the promotion.

**RULE-019 — Price at confirmation is persisted.** Later price-rule changes do not retroactively alter confirmed booking price unless explicit adjustment/refund workflow exists.

**RULE-020 — Cancellation policy is snapshotted.** Relevant policy terms at booking time are stored with the booking.

**RULE-021 — No-show restriction is policy-based.** Repeated no-shows may restrict booking, but platform/venue must expose reason and recovery path.

**RULE-022 — Venue suspension overrides subscription.** A paid subscription does not bypass platform safety/moderation suspension.

**RULE-023 — Suspended venue cannot take new bookings.** Existing bookings require admin/owner resolution workflow.

**RULE-024 — Venue private operational data is tenant-scoped.** Staff/owner from Venue A cannot access Venue B private data.

**RULE-025 — Public profiles expose only approved fields.** Phone numbers, personal contact, internal revenue and customer data are private by default.

**RULE-026 — Competition drafts are private.** They become public only after Publish.

**RULE-027 — Competition format is immutable after material play begins unless explicit migration workflow exists.** Administrators may correct setup before first completed match.

**RULE-028 — Completed match results drive derived tables.** Standings/brackets are recalculated from persisted results, not manually edited totals, except audited admin correction.

**RULE-029 — Knockout advancement is deterministic.** Winner progresses according to bracket mapping.

**RULE-030 — Group qualification is snapshotted at knockout creation.** Later corrections recalculate with explicit warning if knockout has not started; after knockout starts, admin correction requires audit/impact confirmation.

**RULE-031 — Team manager authority is scoped.** A manager can manage only teams they are authorized for.

**RULE-032 — Referees cannot change competition structure.** They may enter only granted match/officiating information.

**RULE-033 — Verified-booking review only.** When reviews launch, only eligible completed bookings may create verified reviews.

**RULE-034 — Notification deduplication.** Same event/user/channel must not generate duplicate alerts due to retry.

**RULE-035 — Subscription price is configuration, not code.** Platform admin can change plans/prices prospectively without redeploying the app.

**RULE-036 — Payment webhook is authoritative for digital payment.** Redirect success alone does not mark payment final.

**RULE-037 — Cash/manual payment is never implied paid automatically.** Owner/staff must mark collection when relevant.

**RULE-038 — AFN is default currency for Afghanistan.** Currency remains a field to support future markets.

**RULE-039 — Store timestamps in UTC.** Display in venue/user local timezone; Afghanistan launch defaults venue timezone to Asia/Kabul.

**RULE-040 — Cached availability cannot create offline bookings.** Booking requires live server confirmation.

**RULE-041 — Language choice persists per user/device.** Dari/Pashto trigger RTL; English LTR.

**RULE-042 — Deletion is dependency-aware.** Entities with financial/competition history should be archived/soft-deleted rather than silently hard-deleted.

**RULE-043 — Platform-admin overrides are audited.** Trial extension, subscription activation, suspension, data correction and impersonation-like support actions must create logs.

**RULE-044 — Trial reminders are informative, not deceptive.** Show exact expiry date/time and what changes afterward.

**RULE-045 — A venue can contain one or more playing areas.** The one-venue subscription rule applies to the physical venue/business location, not the number of futsal pitches inside it.

---

# 27. State Systems

## Venue

```text
Draft → Pending Verification → Active → Suspended → Active
                         ↘ Rejected
Active → Archived
```

- Draft editable by owner.
- Pending may be limited until required verification.
- Suspended disables new bookings.
- Archived is owner/admin initiated; public visibility removed.

## Subscription

```text
Not Started → Trial → Active → Cancelled-at-period-end → Expired
                  ↘ Expired
Expired → Active (reactivation)
```

Optional future `Past Due/Grace` if automated recurring billing requires it.

## Booking

```text
Pending → Confirmed → Completed
   ↘ Rejected
Confirmed → Cancelled
Confirmed → No-show
Pending → Expired
```

Instant-book venues skip Pending.

## Promotion

```text
Draft → Published → Redeemed/Closed
                 ↘ Expired
                 ↘ Cancelled
```

## Competition

```text
Draft → Registration Open → Registration Closed → Scheduled → In Progress → Completed → Archived
```

Draft may be cancelled. Published competition cancellation must notify participants.

## Match

```text
Unscheduled → Scheduled → In Progress (optional) → Completed
Scheduled → Postponed → Scheduled
Scheduled → Cancelled
Completed → Corrected (audited result revision)
```

## Team registration

```text
Invited / Applied → Pending → Accepted
                         ↘ Rejected
Accepted → Withdrawn (policy permitting)
```

## Post

```text
Draft → Published → Unpublished/Archived
```

Scheduled state is V1.1.

---

# 28. Data Model

## Core entities

### User
Fields: id, username/phone/email identifiers as configured, password/auth references, display name, locale, status, timestamps.  
Relationships: sessions, player profile, teams, bookings, follows, notifications, optional delegated roles.

### OwnerAccountProfile
Fields: user_id, verification status, owner contact, business verification metadata, trial eligibility key.  
Relationship: exactly one owned Venue.

### Venue
Fields: id, owner_account_id (unique), name, description, public phone/WhatsApp, province/city/district/address, latitude/longitude, timezone, currency, verification status, publication status, subscription entitlement reference.  
Indexes: city/province, geospatial if supported, active/public.

### PlayingArea
Fields: id, venue_id, name, indoor/outdoor, surface, active.  
Relationship: one Venue → many PlayingAreas.

### OperatingRule
Fields: playing_area/venue, weekday, open/close, effective dates.  
Purpose: recurring availability generation.

### PriceRule
Fields: venue/area, weekday/time range/date override, amount, currency, priority/effective dates.

### CalendarBlock
Fields: area, start_at, end_at, reason, source (maintenance/manual/competition), linked entity.  
Overlap protected.

### Booking
Fields: id, venue, area, user nullable for guest/manual, guest details optional, start_at/end_at, source, status, confirmation mode, price snapshot, currency, cancellation policy snapshot, payment status, attendance status, created_by, timestamps.  
Critical index/constraint: active interval overlap prevention by area.

### Promotion
Fields: booking interval/area reference, normal price, promo price, publish/expiry, status, post link.

### Subscription
Fields: owner account, plan, status, trial_started_at, trial_ends_at, current_period_start/end, payment provider/reference, cancellation info.  
Constraint: one current subscription entitlement per owner account.

### Payment
Fields: payer/payee context, purpose (subscription/booking/competition), amount, currency, method, provider, provider reference, status, webhook timestamps.

### VenueStaffMembership
Fields: venue, user, permissions JSON/normalized capabilities, invited/active/revoked.

### Post
Fields: author context, venue/competition, type, text, media, CTA type/id, status, publish time.

### Follow
Fields: user, target type/id, created_at.  
Unique user-target.

### Team
Fields: id, name, logo, city, manager, captain, status, privacy.

### TeamMembership
Fields: team, user/player, role, shirt number, status, joined/left timestamps.

### PlayerProfile
Fields: user, display name, image, position, privacy settings.  
Derived stats should be queryable from competition/match events rather than only denormalized counters.

### Competition
Fields: venue owner, name, format, status, registration state, fees, rules, dates, team limits, points config, tie-break config, publish state.

### CompetitionTeam
Fields: competition, team, registration status, seed, group id, fee/payment status.

### Group
Fields: competition, name/order.

### Match
Fields: competition, stage/group/round, home/away teams, venue/area, start/end, status, score, winner, referee, occupancy block link.

### MatchEvent / PlayerMatchStat
Fields: match, player/team, event/stat type, minute optional, value, metadata.  
MVP can store summarized stats; event log enables future live scoring.

### Notification
Fields: recipient, type, title/body localization key/params, deep link, read_at, sent channels, dedupe key.

### Report / ModerationCase
Fields: reporter, target, reason, status, assignee, resolution.

### AuditLog
Fields: actor, action, entity type/id, before/after summary, reason, IP/device metadata where appropriate, timestamp.

## Important relationships

```text
OwnerAccountProfile 1 ── 1 Venue
Venue 1 ── many PlayingArea
Venue 1 ── many Booking
Venue 1 ── many Competition
Venue 1 ── many Post
Venue 1 ── many VenueStaffMembership

User 1 ── many Booking
User 1 ── 0..1 PlayerProfile
User many ── many Team (through TeamMembership)

Competition 1 ── many CompetitionTeam
Competition 1 ── many Match
Competition 1 ── many Group
Match 1 ── many PlayerMatchStat / MatchEvent
```

---

# 29. API/System Capabilities

Exact endpoint shape may adapt to the implementation framework, but capabilities are required.

## Authentication

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh
POST   /api/v1/auth/recover
GET    /api/v1/me
GET    /api/v1/me/sessions
DELETE /api/v1/me/sessions/:id
```

## Venues / discovery

```text
GET    /api/v1/venues
GET    /api/v1/venues/:id
GET    /api/v1/venues/:id/availability
POST   /api/v1/owner/venue
PATCH  /api/v1/owner/venue
POST   /api/v1/owner/venue/media
```

Availability query inputs: date/range, playing area optional, timezone. Response must identify freshness and prices.

## Venue schedule / pricing

```text
GET    /api/v1/owner/schedule
POST   /api/v1/owner/blocks
PATCH  /api/v1/owner/blocks/:id
DELETE /api/v1/owner/blocks/:id
GET    /api/v1/owner/operating-rules
PUT    /api/v1/owner/operating-rules
GET    /api/v1/owner/price-rules
POST   /api/v1/owner/price-rules
PATCH  /api/v1/owner/price-rules/:id
```

## Bookings

```text
POST   /api/v1/bookings
GET    /api/v1/bookings/mine
GET    /api/v1/bookings/:id
POST   /api/v1/bookings/:id/cancel
POST   /api/v1/owner/bookings/manual
POST   /api/v1/owner/bookings/:id/confirm
POST   /api/v1/owner/bookings/:id/reject
POST   /api/v1/owner/bookings/:id/attendance
```

Critical: booking creation requires idempotency key and transactional overlap protection.

## Promotions

```text
GET    /api/v1/promotions
POST   /api/v1/owner/promotions
PATCH  /api/v1/owner/promotions/:id
POST   /api/v1/owner/promotions/:id/cancel
```

## Feed

```text
GET    /api/v1/feed
GET    /api/v1/posts/:id
POST   /api/v1/owner/posts
PATCH  /api/v1/owner/posts/:id
POST   /api/v1/owner/posts/:id/unpublish
```

## Teams / players

```text
POST   /api/v1/teams
GET    /api/v1/teams/:id
PATCH  /api/v1/teams/:id
POST   /api/v1/teams/:id/invitations
POST   /api/v1/teams/:id/members/:userId/remove
GET    /api/v1/players/:id
```

## Competitions

```text
GET    /api/v1/competitions
POST   /api/v1/owner/competitions
GET    /api/v1/competitions/:id
PATCH  /api/v1/owner/competitions/:id
POST   /api/v1/owner/competitions/:id/publish
POST   /api/v1/competitions/:id/register-team
POST   /api/v1/owner/competitions/:id/invite-team
POST   /api/v1/owner/competitions/:id/generate-schedule
GET    /api/v1/competitions/:id/fixtures
GET    /api/v1/competitions/:id/standings
GET    /api/v1/competitions/:id/bracket
POST   /api/v1/owner/matches/:id/result
PATCH  /api/v1/owner/matches/:id
```

## Subscription / billing

```text
GET    /api/v1/owner/subscription
POST   /api/v1/owner/trial/start
POST   /api/v1/owner/subscription/checkout
POST   /api/v1/webhooks/payments/:provider
POST   /api/v1/owner/subscription/cancel
POST   /api/v1/owner/subscription/reactivate
```

## Notifications

```text
GET    /api/v1/notifications
POST   /api/v1/notifications/:id/read
PUT    /api/v1/me/notification-preferences
POST   /api/v1/me/push-token
```

## Analytics

```text
GET    /api/v1/owner/analytics/overview
GET    /api/v1/owner/analytics/occupancy
GET    /api/v1/owner/analytics/revenue
GET    /api/v1/owner/analytics/promotions
```

## Admin

Platform-admin APIs for users, venues, subscriptions, moderation, verification, configuration, trial extension and audit retrieval. All write operations require privileged authorization and audit logging.

---

# 30. Third-Party Services

| Capability | Why Needed | Development / Initial Option | Production Recommendation | Limitations / Regional Notes | Data Exchanged |
|---|---|---|---|---|---|
| Maps / location | Venue pin, nearby discovery | Mapbox free tier or OSM-based dev map | Mapbox if cost/coverage acceptable | Allow text address + pin because address quality varies; Mapbox currently includes a mobile free tier [R17] | venue coordinates/search queries |
| Push notifications | Booking, fixture, trial reminders | Expo Notifications | FCM/APNs through Expo or direct where needed | Must handle token churn and opt-out | user/device token + notification payload |
| Media storage | Venue/team/post images | Local dev / object storage emulator | S3-compatible storage such as Cloudflare R2 | Optimize images and control upload abuse | images + metadata |
| Payments | Subscription/booking digital payment | Sandbox/manual payment records | HesabPay for Afghanistan if commercial onboarding succeeds | Stripe is not listed as supported for Afghan merchant accounts; HesabPay documents AFN/AfPay/wallet/cards and webhooks [R13][R16] | order/payment amount, merchant/user refs |
| SMS / phone verification | Trust and anti-abuse | Provider mocked in dev | Select Afghan-reachable SMS/WhatsApp verification provider after commercial validation | Do not lock architecture to one vendor | phone + OTP metadata |
| Email | Support/owner receipts optional | Dev mailbox | Transactional provider with Afghanistan deliverability | Email should not be required for players if phone-first | email + template params |
| Analytics | Product metrics | Self-host/dev events | PostHog or equivalent with privacy controls | Avoid unnecessary personal data | event name + pseudonymous identifiers |
| Error monitoring | Crash/API visibility | Local logs | Sentry or equivalent | Scrub secrets and personal data | stack traces + technical context |

No third-party service should be mandatory for basic offline/cash venue operations except backend/database hosting.

---

# 31. AI Architecture

## MVP decision: no generative AI required

Futsal does not need an LLM to deliver its core value. Adding AI at launch would increase cost, latency, complexity and failure modes without solving the central booking problem.

## Deterministic “smart slot” recommendation (V1.1/V2)

Use historical occupancy first:

```text
Booking history
↓
Normalize by weekday/time/season
↓
Compute occupancy & cancellation rate
↓
Identify weak-demand intervals
↓
Rule-based discount suggestion
↓
Owner accepts/edits/rejects
↓
Track conversion impact
```

Example: “Tuesdays 13:30–15:00 were unbooked in 7 of the last 10 comparable weeks. Consider a 10–15% promotion.”

Only after sufficient data exists should ML forecasting be considered. An LLM may later assist with post copy or summarization, but publication must remain owner-controlled.

---

# 32. Automation

| Automation | Trigger | Condition | Action | Failure Behavior |
|---|---|---|---|---|
| Trial expiry | `trial_ends_at` reached | status Trial | set Expired, disable new booking entitlement, notify owner | retry idempotently |
| Trial reminder | 24h / 3h before expiry | still Trial | push/in-app reminder | skip duplicate via dedupe key |
| Booking reminder | e.g. 3h before start | Confirmed | notify player and venue | retry; no duplicate |
| Pending request expiry | timeout reached | still Pending | expire and release occupancy | transactional |
| Promotion close | slot booked/blocked/start passed | promotion active | close promotion | eventual reconciliation job |
| Match reminder | configured before match | scheduled | notify teams/referee | dedupe |
| Standings recalc | completed/corrected league/group result | valid result | recompute table | fail safely, retry |
| Bracket advance | completed knockout result | winner known | populate next match | idempotent mapping |
| Subscription reactivation | trusted payment confirmed | expired/cancelled | restore entitlements | webhook replay safe |
| Analytics aggregation | daily/hourly | data available | materialize occupancy metrics | retry; raw data remains source |

---

# 33. Notifications

| Event | Recipient | In-App | Email | Push | Priority |
|---|---|---:|---:|---:|---|
| Booking confirmed | Player + venue | Yes | Optional | Yes | High |
| Booking cancelled | Other party | Yes | Optional | Yes | High |
| Booking reminder | Player | Yes | No | Yes | High |
| Slot promotion | Followers / relevant users | Yes | No | Opt-in | Medium |
| Team invitation | User | Yes | Optional | Yes | Medium |
| Competition invitation | Team manager | Yes | Optional | Yes | High |
| Fixture created/changed | Team members/referee | Yes | Optional | Yes | High |
| Result published | Followers/team | Yes | No | Optional | Medium |
| Trial ending | Owner | Yes | Optional | Yes | High |
| Subscription expired | Owner | Yes | Optional | Yes | High |
| Moderation action | Affected user/owner | Yes | Optional | Yes | High |

Requirements:
- Read/unread state.
- Deep link to relevant object.
- Per-category preferences where safe.
- High-priority operational messages cannot be completely hidden if required to fulfill a booking, but channel preferences should still be respected where possible.
- Group repetitive low-value alerts.
- Deduplicate retries.
- Maintain notification history for a practical retention period.

---

# 34. Search and Filtering

## Venue search

Search: venue name, city, district/area, optional landmark text.  
Filters: date, time, live availability, price, discount, facilities, indoor/outdoor, distance.  
Sort: soonest availability, nearest, price, rating after reviews launch.

## Competition search

Search: competition name, venue, organizer.  
Filters: format, registration open, upcoming/live/completed, city.

## Team search

Search: team name/city.  
Future filters: level, looking-for-opponent.

## Owner booking search

Search: player/customer name, phone where authorized, booking id.  
Filters: date, source, status, payment, area.

## Mobile behavior

Filters appear in bottom sheet with sticky Apply and Clear. Current selection persists during navigation. Avoid URL-state dependency in native app; use route/search state that can be deep-linked where useful.

---

# 35. Mobile-First UX

- Minimum comfortable touch targets (~44–48 dp).
- Sticky primary action on booking/owner forms where it reduces scrolling.
- Day carousel for availability; not a desktop calendar shrunk to phone width.
- Bottom sheets for filters, permissions, short forms and confirmations.
- Cards for owner schedule on very small screens; timeline where space permits.
- Horizontal scrolling only for inherently wide information such as standings/brackets.
- Lazy-load images; text and availability should appear before decorative media.
- Cache public content, bookings and competition data for read access, but mark stale data.
- Booking creation, cancellation and schedule writes require live server confirmation.
- Resume/foreground events revalidate session and time-sensitive data.
- All destructive actions require clear confirmation and outcome feedback.
- Dari/Pashto UI mirrors directional layout and uses tested typography; IDs, phone numbers and certain numeric identifiers remain readable LTR where appropriate.

---

# 36. Design System

## Visual personality

Athletic, confident, local and practical. Use energetic accents for sports moments but keep operations legible and calm.

## Layout

- 4/8-point spacing system.
- Safe-area aware mobile layouts.
- Max readable content width for future tablet/web views.
- Strong card hierarchy but avoid excessive shadows.

## Typography

- Dari/Pashto: use a high-quality Arabic-script font such as Vazirmatn or another tested open font.
- English: use a clear modern sans serif.
- Headings must scale without clipping in localized strings.

## Color semantics

- Success: confirmed/available/completed.
- Warning: pending/expiring/trial ending.
- Danger: cancelled/suspended/payment failure.
- Info: neutral system updates.
- Competition/team branding must not override status readability.

Never communicate status by color alone.

## Core components

Button, icon button, text input, phone input, amount input, select, segmented control, date picker, time picker, search field, filter chip, venue card, slot card, booking card, competition card, post card, team/player avatar, status badge, tabs, bottom sheet, dialog, toast/banner, skeleton, empty state, compact table, bracket node, chart/KPI card.

---

# 37. Dashboard

## Venue owner dashboard priority

1. **Today:** next bookings, open gaps, conflicts/actions.
2. **Needs attention:** pending requests, unpaid items, subscription/trial warning, competition tasks.
3. **Quick actions:** add booking, block time, discount slot, create post.
4. **Business metrics:** today occupancy/revenue estimate, week occupancy, online booking share.
5. **Recommendations:** deterministic weak-slot suggestions only when enough data exists.

No chart should exist solely for decoration.

## Mobile layout

Single vertical stack with Today first. Metrics use 2-column compact cards. Long schedules link to Schedule screen rather than overloading dashboard.

---

# 38. Onboarding

## Player onboarding

Minimum fields: phone/username identifier, password or verified auth method, display name, language. Location permission is optional and requested only when nearby discovery needs it.

First value: see venues and availability before being forced through long profile creation.

## Owner onboarding

Minimum to start trial:
- verified owner account;
- venue name;
- city/address + map pin when possible;
- at least one playing area;
- opening hours;
- session duration;
- default price;
- public contact method;
- acceptance of venue-owner terms.

Optional data such as full photo gallery and long description should not block first value.

Progress should be resumable.

---

# 39. Authentication

Recommended product behavior:

- Phone-first registration for Afghanistan; email optional.
- Username may be offered as a memorable secondary login identifier.
- Password login with secure session/refresh-token model.
- Phone verification provider selected after regional commercial validation.
- Password recovery via verified phone/email.
- Session list and remote logout for owners/admins.
- Platform admins require stronger authentication; MFA recommended.
- Rate-limit login, recovery and verification attempts.
- Account deletion request supported, with dependency/retention rules for financial and competition records.

If WhatsApp verification is considered, it must be a replaceable provider capability, not embedded into core domain logic.

---

# 40. Billing

## Player plan

Core player usage is free.

## Venue owner plan

One paid Premium plan is sufficient for MVP. Avoid multiple tiers before product-market fit.

### Trial

- 3 days / 72 hours.
- Starts only after explicit activation.
- One trial per physical venue/business identity.
- Full Premium feature access during trial.
- Exact end timestamp visible.

### Active subscription

- Covers exactly one owner account / one venue.
- Monthly price and optional annual price are platform configuration.
- Separate account/subscription for each additional venue.

### Expiry behavior

- Disable new online booking acceptance and most Premium writes.
- Keep owner access to existing upcoming confirmed bookings and billing/reactivation.
- Public venue may remain visible but must not advertise stale bookable availability.
- Preserve data for reactivation.

### Payments

MVP can support manual/admin-recorded subscription payment while local digital payment integration is completed. HesabPay is the preferred Afghanistan-specific integration candidate based on current public gateway documentation. [R16]

### Invoices/history

Owner sees payment history, plan periods, provider reference and downloadable receipt/invoice where legally/operationally supported.

---

# 41. Administration

Platform admin modules:

- User accounts and statuses.
- Venue verification and duplicate detection queue.
- Venue suspension/restoration.
- Trial/subscription search and manual extension/activation.
- Payment reconciliation.
- Content/review/report moderation.
- Support notes/cases.
- Configurable plan price, trial duration (product default remains 72h), notification templates and feature flags.
- Audit logs.
- Operational metrics: active venues, trial conversion, booking GMV estimate, booking success, occupancy uplift cohorts, error rates.

Admin must not casually edit derived standings/revenue without a documented correction workflow.

---

# 42. Settings

## Player settings

- Profile.
- Language.
- Notification preferences.
- Privacy/public player profile.
- Security/sessions.
- Account deletion.

## Owner settings

- Venue public profile.
- Booking confirmation mode.
- Cancellation/no-show policy.
- Operating hours/pricing links.
- Notifications.
- Staff.
- Language.
- Security.
- Subscription.

## Platform configuration

Separate from owner settings and only accessible to platform admins.

---

# 43. Security

- Passwords hashed with modern adaptive password hashing.
- Short-lived access tokens / secure session design; refresh-token rotation where applicable.
- RBAC plus object-level ownership checks on every private operation.
- Tenant/venue scope enforced server-side, not inferred from client route.
- Parameterized queries / ORM safe patterns.
- Server validation for all inputs.
- File type/size validation and malware-aware upload controls.
- Signed/private URLs for non-public media where needed.
- Rate limits for auth, booking creation, promotion spam, invitations and public search abuse.
- Booking idempotency and database overlap constraint.
- Payment webhook signature/verification according to provider docs.
- Secrets only server-side.
- Audit privileged actions.
- Encrypted transport (HTTPS).
- Database backups and restore testing.
- Avoid exposing customer phone lists to staff without permission.

---

# 44. Privacy

## Collected data

Account identifiers, profile data, booking history, venue details, team/competition data, device push token, optional location permission, payment references, moderation/audit metadata.

## Principles

- Collect only what supports the product.
- Player precise live location is not stored by default.
- Venue coordinates are public business location data when owner publishes them.
- Phone/email are private unless the user/venue explicitly marks business contact public.
- Analytics should use pseudonymous IDs where possible.
- Users can request data export/deletion subject to records that must be retained for legitimate operational/legal reasons.
- Third-party processors must be documented in privacy disclosures.

Legal/privacy requirements for Afghanistan and any future launch country require professional review; this specification does not claim legal compliance.

If minors are intended to create accounts, parental-consent and youth-data requirements must be explicitly designed before launch rather than assumed.

---

# 45. Accessibility

Even as a native mobile product:

- Screen-reader labels for controls, status and bracket elements.
- Logical reading/focus order in LTR and RTL.
- Adequate contrast.
- Touch targets at least ~44–48 dp.
- Status not conveyed by color alone.
- Dynamic text/font scaling without clipped critical actions.
- Error messages associated with fields.
- Reduced-motion support for non-essential animation.
- Captions/alt text for meaningful uploaded media when practical.
- Tables have meaningful row/column labels in accessible representation.

---

# 46. Error Handling

## Network loss

Message: “You’re offline. Showing saved information; live availability and booking actions need a connection.”  
Retry: automatic on reconnect plus manual retry.  
Preserve unsent form fields locally when safe.

## API timeout

Show specific retry state, not “unknown error.” Never duplicate booking submission; use idempotency key.

## Booking conflict

Message: “That time was just taken. We refreshed the available times.”  
Return to same date with alternatives.

## Session expiration

Attempt safe refresh once. If refresh fails, preserve navigation intent and ask user to sign in again.

## Subscription expired

Owner message must explain exact effect and provide Reactivate. Existing-booking continuity remains available.

## Payment failure

Do not activate paid entitlement from client redirect alone. Explain that payment was not confirmed and offer retry/contact support.

## Permission failure

Explain that the user does not have access; do not expose hidden object details.

## Upload failure

Keep local preview, allow retry/remove, and avoid losing rest of form.

Never expose stack traces, SQL, provider secrets or raw internal errors.

---

# 47. Empty States

- **No venues in city:** “No venues are live here yet.” Allow changing city and optionally “Suggest a venue.”
- **No slots on date:** suggest next available day/time and other venues.
- **No bookings:** CTA “Find a futsal slot.”
- **Owner no bookings today:** show available inventory and CTA to promote a slot.
- **No competitions:** CTA for owner “Create your first competition”; for player “Check another city/status.”
- **No team:** explain team benefit and Create/Join.
- **No posts:** owner CTA “Publish an update”; player should still see venue facts rather than a dead page.
- **No analytics data:** explain that metrics appear after bookings; avoid meaningless zero charts.

---

# 48. Analytics

## Player/marketplace events

- app_opened
- venue_search_performed
- venue_viewed
- availability_viewed
- slot_selected
- booking_started
- booking_confirmed
- booking_conflict
- booking_cancelled
- promotion_viewed
- promotion_booked
- competition_viewed
- team_created
- competition_registration_completed

## Owner events

- owner_onboarding_completed
- trial_started
- first_availability_published
- first_online_booking_received
- manual_booking_created
- slot_blocked
- promotion_created
- post_published
- competition_created
- result_entered
- subscription_checkout_started
- subscription_activated
- subscription_expired

## Product metrics

- Venue activation rate.
- Time to first published availability.
- Time to first online booking.
- Player search → booking conversion.
- Booking conflict rate.
- Cancellation/no-show rate.
- Venue weekly occupancy.
- Online-booking share.
- Discounted-slot conversion.
- Trial → paid conversion.
- 30/90-day venue retention.
- Weekly active players/owners.
- Competition completion rate.

North-star candidate for owner value: **incremental booked venue-hours / sessions through Futsal**, supplemented by paid venue retention.

---

# 49. Performance

- Availability query target should feel near-instant on normal mobile data; optimize indexes before adding caching complexity.
- Lazy-load media and generate thumbnails.
- Paginate feeds/posts/competitions.
- Cache public venue/profile data; use short TTL for availability.
- Prefetch next day’s availability only when useful and cheap.
- Use database indexes on venue/city/status, booking area/time, competition/status/date, notification recipient/read state.
- Background aggregate analytics rather than expensive live scans for long periods.
- Keep mobile bundle lean and avoid heavy SDKs without value.
- Optimistic UI is acceptable for non-critical actions such as follow/read-notification, but not for confirmed booking inventory without server acknowledgement.

---

# 50. Edge Cases

- Two players attempt the final slot simultaneously.
- Owner manually books a slot while player confirmation screen is open.
- Owner changes opening hours with future bookings outside the new hours.
- Venue subscription expires while a player is mid-booking.
- Venue is suspended with future bookings.
- Trial-start button tapped repeatedly.
- Same physical venue registered under a new owner account for another free trial.
- Legitimate owner has two venues and same contact phone.
- Playing area is deleted while future bookings exist.
- Promotion price conflicts with later price update.
- Competition match overlaps public booking.
- Match rescheduled after teams/referee received notification.
- League result corrected after standings publication.
- Knockout result corrected after next round started.
- Team withdraws after schedule generation.
- Odd number of teams requires bye.
- Group tie cannot be resolved with configured tie-breaks.
- Player belongs to multiple teams across competitions.
- Network disappears after user taps Confirm Booking but before response returns.
- Payment succeeds at provider but app closes before redirect.
- Duplicate payment webhook delivery.
- Device clock is wrong.
- Owner timezone changes / future international market.
- RTL mixed with phone numbers, IDs and Latin team names.
- Cached availability shown after long offline period.
- Account permissions revoked while screen remains open.
- Deleted/suspended content is open from an old notification deep link.

---

# 51. Recommended Technical Architecture

## Architecture style

**Structured monolith** with clear domain modules. Do not start with microservices.

## Mobile frontend

- React Native with Expo.
- TypeScript.
- Role-aware navigation.
- Query/cache layer supporting offline read cache and explicit revalidation.
- i18n with Dari/Pashto/English and RTL from the first screen.

## Backend

- Node.js + TypeScript.
- Express or Fastify REST API.
- Domain modules: auth, venues, scheduling, bookings, billing, teams, competitions, content, notifications, analytics, admin.
- Validation schemas shared where practical.

## Database

- PostgreSQL.
- Drizzle ORM is a strong fit if the implementation team is comfortable with it.
- Use database-level constraints for uniqueness/ownership and interval overlap where practical.

## Authentication

Self-managed secure session/token architecture or a mature auth library that demonstrably supports Expo/mobile and server-side RBAC. Avoid provider lock-in that makes phone-first Afghan authentication difficult.

## Storage

S3-compatible object storage for images, with CDN delivery and generated thumbnails.

## Realtime

Not required for MVP. Push notifications + refresh/revalidation are sufficient. WebSocket/SSE can be introduced for live scoring or high-frequency competition updates later.

## Search

PostgreSQL search/filtering is sufficient initially. Add dedicated search only if scale/quality demands it.

## Background jobs

Database-backed queue or a small worker process for reminders, expiry, notifications, analytics aggregation and payment reconciliation. Jobs must be idempotent.

## Payments

Payment abstraction interface. Implement manual/cash first; HesabPay adapter when commercial credentials are available. Do not couple booking status directly to Stripe-specific models.

## Deployment

- Managed Postgres such as Neon or another provider with a region/latency/cost profile validated for Afghanistan users.
- API/worker on a long-running service such as Railway, Render, Fly.io or equivalent.
- Object storage/CDN separately.
- Internal admin can be a lightweight Next.js web app if operationally useful; the customer product remains mobile-first.

## Monitoring

Structured logs, error monitoring, uptime/health endpoint, job failure visibility, payment webhook logs, booking-conflict metrics.

---

# 52. Project Architecture

Recommended monorepo shape:

```text
apps/
├── mobile/                 # Expo React Native player + owner app
├── api/                    # Node API
└── admin/                  # optional internal web console

packages/
├── database/               # schema, migrations, repository helpers
├── contracts/              # shared request/response schemas & types
├── localization/           # Dari/Pashto/English resources
├── design-tokens/          # color, spacing, typography tokens
└── config/                 # lint/ts/shared configuration

docs/
├── PRODUCT-SPEC.md
├── DOMAIN-RULES.md
└── PROJECT-STATE.md        # maintained by development workflow
```

Backend domain modules:

```text
src/modules/
├── auth/
├── users/
├── venues/
├── scheduling/
├── bookings/
├── promotions/
├── teams/
├── competitions/
├── content/
├── billing/
├── notifications/
├── analytics/
└── admin/
```

Keep domain rules server-side and reusable; do not embed subscription/booking authority solely in UI components.

---

# 53. MVP

MVP must be complete enough to test the business, not merely a prototype.

## Player

- Dari/Pashto/English + RTL.
- Authentication/account.
- Venue discovery by city/date/time.
- Venue detail and live availability.
- Instant or request booking.
- Booking history/cancellation.
- Basic notifications.
- Follow venues.
- Public feed/posts.
- Teams and basic player profiles.
- Competition discovery, fixtures, results, standings, brackets.

## Venue owner

- Owner onboarding.
- One account / one venue enforcement.
- 3-day Premium trial.
- One or more playing areas within the venue.
- Opening hours/session duration/base pricing.
- Day schedule.
- Online + manual bookings.
- Blocks/maintenance.
- Manual empty-slot discount promotions.
- Posts.
- League, knockout, group→knockout competitions.
- Team invites/registration.
- Fixtures and result entry.
- Basic player stats.
- Basic occupancy/revenue analytics.
- Staff role with limited permissions.
- Subscription state and manual/admin payment activation if digital gateway is not ready.

## Platform admin

- Venue/user search.
- Venue verification/suspension.
- Trial/subscription override.
- Duplicate venue review.
- Content/report moderation basics.
- Audit logs.

## Excluded from MVP

- In-app chat.
- General player posting/comments.
- Advanced live minute-by-minute match center.
- Automatic dynamic pricing.
- Machine-learning forecasting.
- Multi-venue owner dashboard.
- Full accounting/ERP.
- Sponsorship marketplace.
- Complex membership plans.

---

# 54. V1.1

- HesabPay subscription payment integration if merchant onboarding is successful.
- Optional booking deposits/digital payments.
- Reviews from completed bookings.
- Scheduled posts.
- Referee assignment workflow.
- Improved competition schedule generator.
- Recurring reservations.
- Waitlist / “notify me if this time opens.”
- Weak-slot deterministic recommendations.
- Better team/player stat history.
- Venue QR code linking to public booking page.
- Solar Hijri display option after localization validation.
- More granular owner staff permissions.

---

# 55. V2

- Live futsal scoring and event feed.
- In-app team/venue chat.
- Challenge / opponent matchmaking.
- Smart discount experimentation and demand forecasting.
- Digital booking payments / split payments if market adoption supports them.
- Sponsor placements for competitions.
- Advanced CRM/returning-customer segmentation.
- League seasons and historical records.
- Multi-ground utilization optimization.
- Public leaderboards with anti-manipulation rules.
- Cross-venue competition support.

---

# 56. Future

- Expansion beyond Afghanistan.
- Federation/official competition integrations where agreements exist.
- Streaming/video highlights.
- Sponsor marketplace.
- Equipment/services upsells.
- Venue financing/insurance partnerships where appropriate.
- Advanced demand forecasting.
- API for external venue systems.
- Optional multi-location enterprise product only if business evidence justifies changing the current one-account-one-venue strategy.

---

# 57. Implementation Phase Outcomes

## Phase 1 — Product Foundation and Localization

**Outcome:** Stable mobile/API foundation with three-language RTL-ready design system.  
**Features:** app shell, localization, auth foundation, role model, database base, error/loading/offline patterns.  
**Pages:** splash, login/register, home shell, settings language.  
**Backend/data:** users, sessions, localization conventions, audit foundation.  
**Dependencies:** none.  
**Acceptance:** Dari/Pashto/English switch correctly; RTL layouts tested; protected routes work; network failures are non-destructive.  
**Excluded:** venue booking.

## Phase 2 — Venue Owner Onboarding, Trial and Venue Model

**Outcome:** Owner can create exactly one venue and start 72-hour Premium trial.  
**Features:** venue profile, playing areas, owner dashboard shell, trial state, one-venue enforcement.  
**Acceptance:** second venue creation is blocked; duplicate trial rule exists server-side; owner can resume incomplete onboarding.  
**Excluded:** public booking.

## Phase 3 — Availability, Schedule and Booking

**Outcome:** Real booking marketplace loop works end to end.  
**Features:** operating hours, prices, blocks, live availability, player booking, manual booking, cancellation, conflict protection, player/owner booking views.  
**Acceptance:** concurrent booking test produces exactly one winner; manual and online occupancy never overlap; cached slots cannot confirm offline.  
**Excluded:** promotions/competitions.

## Phase 4 — Promotions, Feed and Notifications

**Outcome:** Owner can market empty capacity and communicate with followers.  
**Features:** discounts, venue posts, follow, push/in-app notification foundation.  
**Acceptance:** booked/expired promotion closes automatically; CTA deep links correctly; spam/frequency limits work.  
**Excluded:** player comments/chat.

## Phase 5 — Teams and Player Identity

**Outcome:** Persistent team/roster layer exists for competitions.  
**Features:** team creation, manager/captain, invites, roster, player profile.  
**Acceptance:** permission boundaries tested; private contact data not public.  
**Excluded:** matchmaking.

## Phase 6 — Competition Engine

**Outcome:** Venue owner can run League, Knockout, and Group→Knockout competitions.  
**Features:** setup, registration, teams, fixtures, calendar occupancy, results, standings, bracket progression, basic stats, public pages.  
**Acceptance:** standings recalculate deterministically; knockout progression correct; competition schedule conflicts with venue bookings are prevented.  
**Excluded:** advanced live scoring.

## Phase 7 — Subscription Enforcement, Analytics and Admin

**Outcome:** Commercial SaaS loop is enforceable and measurable.  
**Features:** expiry, continuity mode, payment/manual activation, analytics, venue verification, suspension, trial extension, audit logs.  
**Acceptance:** expired owners cannot create new bookable inventory but can service existing bookings; reactivation restores functionality without data loss.  
**Excluded:** full automated recurring payment if local gateway is not ready.

## Phase 8 — Release Readiness

**Outcome:** Pilot-ready Android release.  
**Features:** performance, accessibility, security hardening, localization review, resilience, app-store assets, support tooling.  
**Acceptance:** all critical E2E journeys pass; no raw errors/secrets; low-connectivity behavior verified; backup/restore and monitoring procedures validated.  
**Excluded:** V1.1/V2 features.

---

# 58. Test Requirements

## Unit tests

- Price rule precedence.
- Trial expiry calculation.
- Subscription entitlement.
- Standings/tie-break calculations.
- Knockout advancement.
- Promotion validity.

## API/business-rule tests

- Owner cannot create second venue.
- Same venue cannot obtain repeated trial through duplicate account.
- Distinct second venue can be onboarded separately.
- Booking overlap prevention.
- Manual vs online conflict.
- Competition match conflict.
- Expired subscription restrictions.
- Continuity-mode allowed actions.
- Tenant isolation.
- Permission revocation.

## Integration tests

- Booking + notification.
- Result + standings.
- Knockout result + next match.
- Subscription payment webhook + entitlement.
- Venue suspension + booking availability.

## E2E critical journeys

1. Player finds and books a slot.
2. Two players race for one slot.
3. Owner creates manual booking.
4. Owner blocks a slot.
5. Owner discounts empty slot; player books it.
6. Owner trial expires and continuity mode activates.
7. Owner reactivates subscription.
8. Owner attempts second venue and is blocked.
9. League creation through result/standings.
10. Knockout creation through champion.
11. Group→knockout qualification and bracket.
12. Team invite/accept/competition registration.
13. Network loss during booking submission.
14. RTL/Dari and RTL/Pashto end-to-end navigation.
15. Venue suspension with existing upcoming bookings.

## Responsive/mobile tests

Small Android screens, large Android, tablet where supported, keyboard/form behavior, safe areas, large text, RTL, slow network, reconnect.

## Accessibility tests

Screen reader, focus order, contrast, touch targets, dynamic text, semantic status.

## Security tests

Authorization/object-scope, rate limits, upload validation, token/session rotation, webhook verification, audit log coverage.

Tests are requirements; this document does not claim they have been executed.

---

# 59. Competitive Capability Matrix

Legend: **Yes** = publicly documented capability; **Partial** = adjacent/limited or not core; **Unknown** = not verified in current research.

## 59.1 Local and booking-oriented products

| Capability | Futsal Proposed | Maidan | Futsaly | Playtomic |
|---|---|---|---|---|
| Afghan Dari/Pashto/English RTL | Yes | Yes | Afghan focus; full language scope not fully verified | No Afghan-specific focus |
| Live venue availability | Yes | Yes / booking request described | Booking-ready information described | Yes |
| Player self-service booking | Yes | Request-confirm flow described | Partial/under development | Yes |
| Owner daily operations | Yes | Partial/venue confirmation described | Unknown | Yes |
| Empty-slot discount workflow | Yes | Unknown | Unknown | Offers/discounts exist |
| Occupancy/revenue analytics | Yes | Unknown | Unknown | Yes |
| League/tournament management | Yes | Planned | Yes | Yes |
| Player/team statistics | Yes | Yes | Yes | Ratings/activity features |
| Venue social/content presence | Yes | Partial/unknown | Community/news focus | Communication/activity |
| Cash/pay-at-venue friendly core | Yes | Unknown | Unknown | Club-dependent |

## 59.2 Operations and competition products

| Capability | Futsal Proposed | EZFacility | OpenSports | Tournify | Challonge |
|---|---|---|---|---|---|
| Venue/facility scheduling | Yes | Yes | Yes | No | No |
| Public booking / registration | Yes | Yes | Yes | Competition registration | Competition registration |
| League management | Yes | Yes | Yes | Yes | Round robin supported |
| Knockout bracket | Yes | Yes | Yes | Yes | Yes |
| Group → knockout | Yes | Tournament formats | Yes | Multi-phase supported | Yes |
| Officials/referees | Yes | Yes | Yes | Partial | Partial |
| Standings/results | Yes | Yes | Yes | Yes | Yes |
| Venue occupancy/revenue analytics | Yes | Yes | Reports | No | No |
| Venue posts/community | Yes | Communication tools | Chat/events/community | Public event pages | Community announcements |
| Afghanistan-specific localization/payment model | Yes | No documented focus | No documented focus | No documented focus | No documented focus |

The matrices are not rankings. They show that Futsal’s intended differentiation is the **combination** of localized venue economics, operational inventory, and competition/community—not that competitors lack useful capabilities.


# 60. Risks and Mitigations

| Risk | Type | Impact | Mitigation |
|---|---|---|---|
| Too few venues at launch | Adoption | Players see little value | City-by-city pilot; onboard supply before broad player marketing |
| Owners do not keep availability current | Product | Marketplace trust collapses | Make owner calendar operational source of truth; manual bookings easy; reminders |
| No-shows | Product/revenue | Owners distrust online bookings | phone verification, cancellation/no-show policy, future deposit |
| Trial abuse via duplicate accounts | Revenue | Lost subscription conversion | physical venue identity checks, admin review, no repeat trial for same venue |
| One-account-one-venue becomes inconvenient for chains | Product | Multi-location owners dislike model | Treat as deliberate current strategy; revisit only with evidence; future enterprise model possible |
| Competition scope delays booking core | Delivery | Slow launch | Phase booking before full competition engine; keep MVP formats limited |
| Payment provider limitations | Dependency | Subscription friction | Manual activation/cash first; payment abstraction; HesabPay validation |
| Stripe unavailable for Afghan merchant setup | Regional | Global integrations unusable | Do not depend on Stripe; local provider path [R13][R16] |
| Poor internet | Regional | Failed bookings/stale data | cache reads, clear stale state, idempotent writes, reconnect handling |
| RTL/localization defects | UX | Low trust/adoption | RTL from Phase 1; native language review; automated layout checks where possible |
| Direct Afghan competitors | Market | Feature parity pressure | Differentiate on owner ROI, inventory accuracy, analytics and operational SaaS; validate before feature races |
| Moderation/content abuse | Safety | Trust issues | limited MVP posting roles, reporting, suspension, audit logs |
| Booking race conditions | Technical | Double booking | database-level overlap constraint + transaction/idempotency |
| Standings/bracket correction complexity | Technical/product | Wrong public results | deterministic source data, audited correction workflow |
| Owner subscription expires with bookings pending | Business | Operational harm | continuity mode for existing obligations |
| Pricing misfit | Commercial | Low conversion | pilot interviews, configurable price, measure recovered revenue vs fee |

---

# 61. IMPLEMENTATION HANDOFF SPECIFICATION

## 1. Product objective

Increase futsal venue utilization and revenue by exposing reliable live availability and enabling mobile booking, while giving venues integrated operations, competition management and a futsal-specific public presence.

## 2. Target users

Venue owners/staff, players, team managers, competition admins, referees, fans, platform admins.

## 3. Product scope

Mobile marketplace + venue calendar/booking SaaS + promotions/feed + teams/player profiles + league/knockout/group→knockout competitions + analytics + subscription/admin.

## 4. MVP scope

Three languages/RTL, auth, one venue owner model, 72h trial, availability/pricing, online/manual booking, promotions, venue posts, teams, competitions, standings/brackets/stats, basic analytics, admin/subscription enforcement.

## 5. User roles

Visitor, Player, Team Manager, Referee, Venue Staff, Competition Admin, Venue Owner, Platform Admin.

## 6. Permission model

RBAC plus object/venue/competition ownership. Venue staff and competition admin permissions are delegated and scoped. Platform admin overrides audited.

## 7. Route/page inventory

See Sections 20–22. Player core: Home, Venues, Availability, Bookings, Competitions, Feed, Teams, Profile. Owner core: Dashboard, Schedule, Availability/Pricing, Promotions, Posts, Competitions, Analytics, Staff, Subscription.

## 8. Core workflows

Player booking; owner onboarding/trial; manual booking; discount weak slot; competition creation/result; trial expiry/reactivation; separate account for second venue.

## 9. Main features

Venue discovery, real availability, atomic booking, owner schedule, pricing, promotions, posts, teams, competitions, stats, notifications, analytics, billing, admin.

## 10. Business rules

Most critical: one owner account = one venue; one subscription = one venue; trial = 72 hours; same physical venue cannot repeat free trial; booking overlap forbidden; competition matches share venue inventory; expiry disables new booking while preserving continuity access.

## 11. Entity states

Venue, Subscription, Booking, Promotion, Competition, Match, Team Registration, Post state machines defined in Section 27.

## 12. Main data entities

User, OwnerAccountProfile, Venue, PlayingArea, OperatingRule, PriceRule, CalendarBlock, Booking, Promotion, Subscription, Payment, StaffMembership, Post, Follow, Team, TeamMembership, PlayerProfile, Competition, CompetitionTeam, Group, Match, PlayerMatchStat/MatchEvent, Notification, Report, AuditLog.

## 13. System/API capabilities

REST domains: auth, venues, availability, scheduling, bookings, promotions, feed, teams, competitions, billing, notifications, analytics, admin. Booking endpoints require idempotency and overlap protection.

## 14. Required integrations

Maps, push, media storage, optional SMS verification, analytics/error monitoring, local payment provider. HesabPay is current preferred Afghanistan payment candidate; cash/manual remains valid.

## 15. AI capabilities

None required for MVP. Weak-slot suggestions should begin with deterministic historical analytics.

## 16. Automation

Trial reminders/expiry, booking reminders, pending expiry, promotion close, standings recalculation, bracket progression, subscription activation and analytics aggregation.

## 17. Notifications

In-app + push primary; email optional for owners/receipts. Deep-link, preference, dedupe and frequency controls required.

## 18. Billing rules

Players free. Owner gets one 72h Premium trial per physical venue. Paid plan covers one venue. Additional venue requires additional owner account/subscription. Pricing is configurable.

## 19. Admin requirements

Venue verification, duplicate review, subscription/trial override, suspension, moderation, payment reconciliation, support/configuration, audit logs.

## 20. UX principles

Mobile-first, availability-first, explicit status, low friction, no stale availability claims, no raw errors, strong RTL, transparent fees/policies.

## 21. Mobile behavior

Bottom navigation by role, bottom-sheet filters/actions, cached read data with stale indicators, live confirmation for writes, safe-area/touch/large-text support.

## 22. Security requirements

Secure auth/session, RBAC/object scope, tenant isolation, input validation, rate limits, secure uploads, idempotency, webhook verification, audit, backups.

## 23. Critical edge cases

Concurrent booking, owner edit during booking, subscription expiry mid-flow, venue suspension, duplicate trial, match/booking conflict, result correction, offline submit uncertainty, webhook replay, RTL mixed content.

## 24. Recommended stack

Expo React Native + TypeScript; Node/TypeScript REST API; PostgreSQL + Drizzle; S3-compatible media; structured monolith; managed Postgres/API worker; optional Next.js internal admin.

## 25. Implementation phases

1. Foundation/localization.  
2. Owner onboarding/trial.  
3. Availability/booking.  
4. Promotions/feed/notifications.  
5. Teams/player identity.  
6. Competition engine.  
7. Subscription/analytics/admin.  
8. Release readiness.

## 26. Acceptance criteria

Core E2E journeys in Section 58; especially no double booking, one-venue enforcement, correct trial expiry, correct competition tables/brackets, tenant isolation and reliable RTL/offline behavior.

## 27. Known assumptions

- Venue owners will pay if recovered revenue is visible.
- One-account-one-venue is intentionally preferred over chain management.
- Cash/pay-at-venue remains important at launch.
- Phone-first auth is preferable, but final OTP provider requires regional validation.
- “Futsal” is the canonical product name by explicit product-owner decision.

## 28. Known risks

Marketplace liquidity, stale owner calendars, no-shows, direct Afghan competitors, regional payment/provider constraints, trial abuse, competition scope, localization quality, and pricing fit.

---

# Research Sources

**R1 — Playtomic Manager introduction / club outcomes**  
https://helpmanager.playtomic.com/hc/en-gb/articles/20535516949009-Brief-introduction-to-Playtomic-Manager

**R2 — Playtomic Manager mobile limitations**  
https://helpmanager.playtomic.com/hc/en-gb/articles/46212092028561-How-to-use-Playtomic-Manager-on-mobile

**R3 — CourtReserve pricing (current snapshot)**  
https://courtreserve.com/pricing/

**R4 — EZFacility league/tournament management**  
https://www.ezfacility.com/features/league-scheduling-management

**R5 — OpenSports product and pricing**  
https://opensports.net/  
https://opensports.net/pricing

**R6 — Tournify pricing and league management**  
https://tournifyapp.com/en/pricing  
https://help.tournifyapp.com/en/articles/13790816-create-and-manage-a-competition-or-league-in-tournify

**R7 — Challonge pricing/features**  
https://help.challonge.com/pricing  
https://help.challonge.com/features/communities

**R8 — Maidan (Afghanistan futsal product, coming soon)**  
https://maidan-app.com/

**R9 — Futsaly Afghanistan futsal platform**  
https://futsaly.com/

**R10 — Playtomic third-party booking API (includes FUTSAL sport type)**  
https://third-party.playtomic.io/endpoints/bookings/

**R11 — Bookteq facility booking**  
https://www.bookteq.com/bookteq/

**R12 — TeamSnap Tournaments documentation**  
https://helpme.teamsnap.com/category/1209-teamsnap-tournaments

**R13 — Stripe global availability**  
https://stripe.com/global

**R14 — Reddit: Playtomic fee discussion (user-reported experience)**  
https://www.reddit.com/r/padel/comments/1p3du6x/confused_about_playtomic_fees/

**R15 — Reddit: Playtomic UX complaints (user-reported experience)**  
https://www.reddit.com/r/playtomic/comments/1vstm0h/playtomic_ux_feedbackrant/

**R16 — HesabPay payment gateway documentation**  
https://docs.hesab.com/  
https://docs.hesab.com/introduction/overview/

**R17 — Mapbox mobile maps pricing**  
https://www.mapbox.com/pricing

---

# Final Consistency Check

- Major features map to identified player or venue-owner problems.
- Booking inventory is the central source of truth for both ordinary reservations and competition occupancy.
- One-account-one-venue and 72-hour trial rules are consistently enforced across billing, roles, data and user journeys.
- Expired subscriptions do not create unsafe lockout from existing accepted bookings.
- Public competition data derives from match results rather than manually maintained totals.
- Player contact/private operational data is separated from public profiles.
- Mobile behavior, RTL, offline states, errors and permission states are defined.
- Competition scope is limited enough for MVP while still matching the core product promise.
- No AI dependency exists for MVP.
- Payment architecture does not assume Stripe availability in Afghanistan.
- The specification acknowledges emerging Afghan competitors and differentiates Futsal around owner ROI and inventory operations rather than nationality/localization alone.

**This document is the authoritative Futsal product specification unless the product owner explicitly changes a requirement.**
