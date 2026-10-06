# LeagueKick Role Demo Users

This setup is for manual role-by-role testing. It uses six **existing login accounts** and does not create or replace passwords.

Run after migrations:

```powershell
pnpm db:seed:roles
```

The seed is idempotent and can be run again to restore the demo relationships/data.

| Login | Demo type | Persistent authority | Seeded data to test |
| --- | --- | --- | --- |
| `shams` | Normal User | Base authenticated account; no privileged `user_roles` entry | Follows Mahdi's venue, Alisina's team and LeagueKick Demo Cup; mixed Home feed; sample confirmed booking; seeded like/comment |
| `abdul` | Player | `PLAYER` role + active `PLAYER` membership in Alisina's team | Public Player profile, #7 shirt, team roster/member experience |
| `mahdi` | Venue Owner | Active `VENUE_OWNER` role subscription at 1000 AFN/month + `VENUE_OWNER` role | Active/verified venue, main court, opening hours, active venue subscription/payment, promotion, venue post, demo competition, referee assignment |
| `alisina` | Team Owner | Active `TEAM_MANAGER` role subscription at 300 AFN/month + `TEAM_MANAGER` role | Active public team, manager membership, Abdul in roster, team post, competition registration |
| `Saeed` | Referee | `REFEREE` role + venue-scoped row in `venue_referees` for Mahdi's venue | Eligible to be assigned to Mahdi venue competition matches |
| `ali` | Platform Admin | `PLATFORM_ADMIN` role | Admin actor for paid-role activation, venue verification/payment, and role-demo audit record |

## Important role semantics

Normal User is the base account state, so `shams` intentionally has no privileged role row. Player and Referee have a visible role marker **plus** the scoped relationship that carries real authority: team membership for Abdul and venue-referee assignment for Saeed. Venue Owner and Team Owner require both the role marker and a currently active paid-role subscription.

The seed prefers Mahdi's existing venue and Alisina's existing active managed team when present. If either does not exist, it creates a demo venue/team. It never changes passwords.
