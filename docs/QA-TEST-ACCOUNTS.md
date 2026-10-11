# QA authentication and role fixtures (25 accounts)

## Purpose

This is an **opt-in, development/staging-only** seed for five each of:
Normal User, Team Owner, Venue Owner, Referee, and Player.
It does **not** create real customers or send email.

**Do not run against a production database.** The seeder refuses to run
when `NODE_ENV=production`. Always double-check the `.env` database URL and
make a backup before modifying an existing staging database.

## Credentials are NOT in Git

The matching **private** `test-accounts-private.csv` is delivered separately
to the product owner in chat. Copy it into the Futsal repository root:

```text
C:\projects\futsal\test-accounts-private.csv
```

The file is gitignored. It contains 25 distinct passwords and should
not be published, committed, or used in production. Username and email
naming conventions are `ftn01..05`, `ftt01..05`, `ftv01..05`,
`ftr01..05`, `ftp01..05`. Emails use the reserved domain
`@futsal.test`; these mailboxes do not receive messages.

**Verified email** in these QA records means `users.email_verified_at`
is explicitly set by the trusted database seed for test purposes.
No verification email was actually delivered or clicked. Password recovery
using these addresses will not work with a real email service.

## Prepare and seed

In Windows PowerShell, from `C:\projects\futsal`:

```powershell
git pull origin main
pnpm install
pnpm db:migrate
pnpm db:seed:test-accounts seed --confirm
pnpm db:seed:test-accounts verify
```

The script loads `DATABASE_DIRECT_URL` (preferred) or `DATABASE_URL`
from the root `.env`. It executes all inserts within a single transaction
and rolls back if any check fails.

## Data created

- **5 Normal User**: basic accounts, no extra roles.
- **5 Team Owner**: active Team Manager role subscriptions (12 months),
  five separate public teams, a manager membership on each.
- **5 Venue Owner**: active Venue Owner subscriptions (12 months),
  five separate verified QA venues and **one court per venue**, one
  venue subscription for each.
- **5 Referee**: venue-scoped grants, one per QA venue; no Player profile,
  Team membership, explicit role, or owned venue; role is derived from venue grant.
- **5 Player**: five scoped Player team memberships, Player profiles,
  and explicit Player demo role as used by the existing role demo.

No actual payment transaction, receipt, or delivery is created.
The new venues are mock data and use `0000000000` as their public
contact number. Subscription entitlements are **test only**.

Re-running `seed --confirm` is idempotent if the original credential
file is unchanged. It refuses existing username/email collisions or
changed passwords rather than taking ownership of another account.

## Later removal

Use the **same** private CSV and database connection:

```powershell
pnpm db:seed:test-accounts cleanup --confirm --delete-test-accounts
```

Cleanup is **transactional** and scoped to all 25 users with an exact
test-only marker and matching username/email. It first deletes their
referee grants, mock teams and mock venues, then user records.
If test activity has created extra foreign-key dependencies, cleanup
fails and rolls back; investigate those test rows explicitly rather
than weakening referential integrity or deleting unrelated records.

Finally delete the private CSV from your computer or keep it in a
secure local location until cleanup is complete.
