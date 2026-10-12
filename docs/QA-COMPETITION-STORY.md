# Three realistic QA tournaments and Abdul's player story

This opt-in seed creates competitive, connected test data in the database
configured in the root .env. It does not contain credentials, change account
roles, alter ownership, or execute automatically after pulling.

## Account / ownership resolution

The user request names Alisina as venue owner and Mahdi as team manager.
The existing six-role seed in this repository instead gives **Mahdi** the
venue and **Alisina** the team, with **Abdul** as that team's player. The
seed therefore first attempts the requested Alisina-venue and Mahdi-team
targets; if absent, it uses the matching real owner venue / team without
changing ownership or roles. It requires Abdul to already have an active
player membership on the chosen team. The console prints the resolved
target names. Do not interchange owners just to run tests.

The named base demo users, a subscribed venue, a managed team and Abdul's
active membership must already exist. The older role-demo seeder can reset
roles/subscriptions of six named accounts; **do not run it on a database with
real user data or user-customized role ownership**.

## Command

From PowerShell in C:\projects\futsal:

    git pull origin main
    pnpm install
    pnpm db:migrate
    pnpm db:seed:competition-story --confirm

Review DATABASE_DIRECT_URL / DATABASE_URL in local .env before running.
Run only against development/staging, with a backup. NODE_ENV=production
is rejected. The entire operation is transactional, and an advisory lock
serializes concurrent runs. Existing competitions with the same names but
missing the QA marker are never adopted.

## Competitions

1. **QA Story Premier League**: 15 teams, 15 weekly matchweeks, a bye
   each matchweek, 105 fixtures total, matchweeks 1-3 complete (21
   recorded results) and week 4 scheduled relative to the seed date.
   Standings are derived dynamically from the official score records.
2. **QA Story Groups and Knockout Cup**: 12 teams, 4 groups of 3,
   2 qualifiers/group, 12 group fixtures (8 completed, 4 scheduled)
   plus a connected 8-team knockout bracket (7 placeholder games).
   Placeholder bracket participants are intentionally TBD until group
   qualifications conclude.
3. **QA Story Knockout Championship**: 16 teams and a full 15-match
   bracket. Four completed first-round results advance winners into
   linked quarterfinal places; four other round-of-16 games and later
   rounds remain scheduled.

These are simulations, not real matches or financial transactions.
Registrations are accepted with WAIVED fees, not fictional payments.
All three competitions are published and in progress, with sample rewards.
If the host venue has an assigned referee, the same venue-scoped referee is
placed on seeded fixtures, with accepted past matches and pending upcoming
assignments.

Fifteen additional non-login QA athlete records (no usernames, emails or
active sign-in access) are attached to those offline teams. They record
sample goals and awards so competition leaderboards show multiple players,
not just Abdul. The synthetic users are SUSPENDED and marked for cleanup.

Fifteen extra teams are specifically labelled QA Story Offline Team and
attached to the selected venue as *unclaimed offline teams*. This
preserves the rule that a manager must pay separately for each additional
claimed managed team. The team's actual manager-controlled team is one
of the league participants and Abdul's active player team.

## Player Abdul

- Official stat rows for completed matches involving his team; cumulative
  career goals, assists, cards, man-of-the-match flags and match history.
- Competition rosters, team lineups, a forthcoming fixture and results.
- Player preferences (only if blank), three training/meeting events,
  availability responses, competition follows, a confirmed friendly and\n  several in-app notifications.

## Team manager (existing owner of Abdul's team)

- Team manager profile details (only if missing), three guest reserve
  players, sample team announcements and public media post.
- Registrations and rosters across all three competitions, match lineups
  and result-based team performance, upcoming fixtures.
- Three upcoming activities, member RSVPs, accepted friendly
  challenge, public competition posts.

This seed does not overwrite previously edited profile fields, passwords,
roles or existing user-owned social content. It is repeat-safe for its
three named competitions, with counts verified at the end. Because
the story references existing demo accounts and a real venue, removal
should be performed by a reviewed, database-scoped cleanup rather than
blind cascading deletion of the base demo accounts.

No live database was available to run the command from ChatGPT.
A passing CI verification proves source syntax / static guards,
**not** that SQL inserts have run successfully against your DB.
