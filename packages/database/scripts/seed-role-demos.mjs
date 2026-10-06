import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const { Pool } = pg;
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../../.env") });

function normalizeTlsMode(value) {
  const url = new URL(value);
  const mode = url.searchParams.get("sslmode");
  if (mode === "prefer" || mode === "require" || mode === "verify-ca") {
    url.searchParams.set("sslmode", "verify-full");
  }
  return url.toString();
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function atHour(date, daysFromNow, hour, minute = 0) {
  const next = addDays(date, daysFromNow);
  next.setUTCHours(hour, minute, 0, 0);
  return next;
}

const rawUrl = process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL;
if (!rawUrl) {
  console.error("Role demo seed failed: DATABASE_DIRECT_URL or DATABASE_URL is required.");
  process.exit(1);
}

const pool = new Pool({ connectionString: normalizeTlsMode(rawUrl) });
const client = await pool.connect();

const requestedUsers = [
  ["shams", "NORMAL_USER"],
  ["abdul", "PLAYER"],
  ["mahdi", "VENUE_OWNER"],
  ["alisina", "TEAM_MANAGER"],
  ["saeed", "REFEREE"],
  ["ali", "PLATFORM_ADMIN"],
];

async function getUser(username) {
  const result = await client.query(
    `select id, username, display_name, phone_e164
       from users
      where lower(coalesce(username_normalized, username, '')) = lower($1)
      limit 1`,
    [username],
  );
  return result.rows[0] ?? null;
}

async function normalizeRole(userId, role) {
  await client.query("delete from user_roles where user_id = $1", [userId]);
  if (role) {
    await client.query(
      "insert into user_roles (user_id, role, assigned_at) values ($1, $2::user_role, now()) on conflict do nothing",
      [userId, role],
    );
  }
}

async function upsertPaidRole({ userId, role, monthlyPriceAfn, adminUserId, activeUntil }) {
  await client.query(
    `insert into role_subscriptions (
       user_id, role, status, monthly_price_afn, requested_at, active_until,
       activated_at, activated_by_user_id, payment_reference, updated_at
     ) values ($1, $2::user_role, 'ACTIVE', $3, now(), $4, now(), $5, $6, now())
     on conflict (user_id, role) do update set
       status = 'ACTIVE',
       monthly_price_afn = excluded.monthly_price_afn,
       active_until = excluded.active_until,
       activated_at = excluded.activated_at,
       activated_by_user_id = excluded.activated_by_user_id,
       payment_reference = excluded.payment_reference,
       updated_at = now()`,
    [userId, role, monthlyPriceAfn, activeUntil, adminUserId, `ROLE-DEMO-${role}`],
  );
}

try {
  await client.query("begin");

  const requiredTables = ["role_subscriptions", "social_posts", "team_join_requests", "venue_referees"];
  for (const table of requiredTables) {
    const check = await client.query("select to_regclass($1) as name", [`public.${table}`]);
    if (!check.rows[0]?.name) {
      throw new Error(`Required table "${table}" is missing. Run pnpm db:migrate before pnpm db:seed:roles.`);
    }
  }

  const users = {};
  const missing = [];
  for (const [username] of requestedUsers) {
    const user = await getUser(username);
    if (!user) missing.push(username);
    else users[username] = user;
  }
  if (missing.length) {
    throw new Error(`Create these existing login accounts first: ${missing.join(", ")}. The role demo seeder never creates login credentials.`);
  }

  const now = new Date();
  const entitlementEnd = addDays(now, 180);

  for (const user of Object.values(users)) {
    await client.query(
      "update users set status = 'ACTIVE', deleted_at = null, updated_at = now() where id = $1",
      [user.id],
    );
    await client.query("delete from role_subscriptions where user_id = $1", [user.id]);
  }

  await normalizeRole(users.shams.id, null);
  await normalizeRole(users.abdul.id, "PLAYER");
  await normalizeRole(users.mahdi.id, "VENUE_OWNER");
  await normalizeRole(users.alisina.id, "TEAM_MANAGER");
  await normalizeRole(users.saeed.id, "REFEREE");
  await normalizeRole(users.ali.id, "PLATFORM_ADMIN");

  await upsertPaidRole({
    userId: users.mahdi.id,
    role: "VENUE_OWNER",
    monthlyPriceAfn: 1000,
    adminUserId: users.ali.id,
    activeUntil: entitlementEnd,
  });
  await upsertPaidRole({
    userId: users.alisina.id,
    role: "TEAM_MANAGER",
    monthlyPriceAfn: 300,
    adminUserId: users.ali.id,
    activeUntil: entitlementEnd,
  });

  // Mahdi: real active venue-owner workspace.
  let venueResult = await client.query(
    "select id, name from venues where owner_user_id = $1 limit 1",
    [users.mahdi.id],
  );
  let venue = venueResult.rows[0];
  if (!venue) {
    venueResult = await client.query(
      `insert into venues (
         owner_user_id, name, public_phone, province, city, address, timezone,
         booking_mode, cancellation_policy, status, verification_status,
         verified_at, verified_by_user_id, setup_completed_at, created_at, updated_at
       ) values (
         $1, 'Mahdi Futsal Arena', $2, 'Kabul', 'Kabul',
         'Demo Sports Complex, Kabul', 'Asia/Kabul', 'INSTANT',
         'Free cancellation before the booking start time.',
         'ACTIVE', 'VERIFIED', now(), $3, now(), now(), now()
       )
       returning id, name`,
      [users.mahdi.id, users.mahdi.phone_e164, users.ali.id],
    );
    venue = venueResult.rows[0];
  } else {
    await client.query(
      `update venues set
         status = 'ACTIVE',
         verification_status = 'VERIFIED',
         verified_at = coalesce(verified_at, now()),
         verified_by_user_id = coalesce(verified_by_user_id, $2),
         setup_completed_at = coalesce(setup_completed_at, now()),
         updated_at = now()
       where id = $1`,
      [venue.id, users.ali.id],
    );
  }

  await client.query(
    `insert into venue_subscriptions (
       venue_id, status, trial_started_at, trial_ends_at, active_until, created_at, updated_at
     ) values ($1, 'ACTIVE', null, null, $2, now(), now())
     on conflict (venue_id) do update set
       status = 'ACTIVE',
       active_until = excluded.active_until,
       cancelled_at = null,
       updated_at = now()`,
    [venue.id, entitlementEnd],
  );

  await client.query(
    `insert into subscription_payments (
       venue_id, amount_afn, period_starts_at, period_ends_at, provider,
       provider_reference, status, note, recorded_by_user_id, created_at
     ) values ($1, 1000, now(), $2, 'MANUAL', 'ROLE-DEMO-MAHDI-VENUE', 'RECORDED',
       'Role demo seed: active Venue Owner subscription', $3, now())
     on conflict (provider, provider_reference) where provider_reference is not null
     do update set
       amount_afn = excluded.amount_afn,
       period_starts_at = excluded.period_starts_at,
       period_ends_at = excluded.period_ends_at,
       status = 'RECORDED',
       note = excluded.note,
       recorded_by_user_id = excluded.recorded_by_user_id`,
    [venue.id, entitlementEnd, users.ali.id],
  );

  let areaResult = await client.query(
    "select id from venue_areas where venue_id = $1 and name = 'Demo Main Court' limit 1",
    [venue.id],
  );
  let area = areaResult.rows[0];
  if (!area) {
    areaResult = await client.query(
      `insert into venue_areas (
         venue_id, name, default_session_duration_minutes, base_price_afn, active, created_at, updated_at
       ) values ($1, 'Demo Main Court', 90, 1200, true, now(), now())
       returning id`,
      [venue.id],
    );
    area = areaResult.rows[0];
  } else {
    await client.query(
      "update venue_areas set active = true, default_session_duration_minutes = 90, base_price_afn = 1200, updated_at = now() where id = $1",
      [area.id],
    );
  }

  for (let day = 0; day < 7; day += 1) {
    await client.query(
      `insert into venue_opening_hours (venue_id, day_of_week, is_closed, opens_at, closes_at)
       values ($1, $2, false, '08:00', '23:00')
       on conflict (venue_id, day_of_week) do update set
         is_closed = false, opens_at = '08:00', closes_at = '23:00'`,
      [venue.id, day],
    );
  }

  // Alisina: paid Team Owner with a public team.
  let teamResult = await client.query(
    "select id, name from teams where manager_user_id = $1 and status = 'ACTIVE' order by created_at asc limit 1",
    [users.alisina.id],
  );
  let team = teamResult.rows[0];
  if (!team) {
    teamResult = await client.query(
      `insert into teams (
         name, city, manager_user_id, status, privacy, created_at, updated_at
       ) values ('Alisina United', 'Kabul', $1, 'ACTIVE', 'PUBLIC', now(), now())
       returning id, name`,
      [users.alisina.id],
    );
    team = teamResult.rows[0];
  } else {
    await client.query(
      "update teams set status = 'ACTIVE', privacy = 'PUBLIC', archived_at = null, updated_at = now() where id = $1",
      [team.id],
    );
  }

  await client.query(
    `insert into player_profiles (
       user_id, public_display_name, position, visibility, created_at, updated_at
     ) values ($1, $2, 'UNIVERSAL', 'PUBLIC', now(), now())
     on conflict (user_id) do update set
       public_display_name = excluded.public_display_name,
       position = 'UNIVERSAL',
       visibility = 'PUBLIC',
       updated_at = now()`,
    [users.alisina.id, users.alisina.display_name],
  );
  await client.query(
    `insert into player_profiles (
       user_id, public_display_name, position, visibility, created_at, updated_at
     ) values ($1, $2, 'ALA', 'PUBLIC', now(), now())
     on conflict (user_id) do update set
       public_display_name = excluded.public_display_name,
       position = 'ALA',
       visibility = 'PUBLIC',
       updated_at = now()`,
    [users.abdul.id, users.abdul.display_name],
  );

  await client.query(
    `insert into team_memberships (
       team_id, user_id, role, shirt_number, status, joined_at, left_at, updated_at
     ) values ($1, $2, 'MANAGER', 10, 'ACTIVE', now(), null, now())
     on conflict (team_id, user_id) do update set
       role = 'MANAGER', status = 'ACTIVE', left_at = null, updated_at = now()`,
    [team.id, users.alisina.id],
  );
  await client.query(
    `insert into team_memberships (
       team_id, user_id, role, shirt_number, status, joined_at, left_at, updated_at
     ) values ($1, $2, 'PLAYER', 7, 'ACTIVE', now(), null, now())
     on conflict (team_id, user_id) do update set
       role = 'PLAYER', shirt_number = 7, status = 'ACTIVE', left_at = null, updated_at = now()`,
    [team.id, users.abdul.id],
  );

  // Saeed: venue-scoped referee authority for Mahdi's venue.
  await client.query(
    `insert into venue_referees (venue_id, user_id, assigned_by_user_id, assigned_at)
     values ($1, $2, $3, now())
     on conflict (venue_id, user_id) do update set
       assigned_by_user_id = excluded.assigned_by_user_id,
       assigned_at = excluded.assigned_at`,
    [venue.id, users.saeed.id, users.mahdi.id],
  );

  // Shared public competition owned by Mahdi's venue.
  const competitionName = "LeagueKick Demo Cup";
  let competitionResult = await client.query(
    "select id from competitions where venue_id = $1 and name = $2 limit 1",
    [venue.id, competitionName],
  );
  let competition = competitionResult.rows[0];
  const competitionStarts = addDays(now, 14);
  const competitionEnds = addDays(now, 28);
  if (!competition) {
    competitionResult = await client.query(
      `insert into competitions (
         venue_id, created_by_user_id, name, description, format, status, published,
         max_teams, registration_fee_afn, win_points, draw_points, loss_points,
         tie_break_order, starts_at, ends_at, published_at, created_at, updated_at
       ) values (
         $1, $2, $3,
         'Demo competition for testing Normal User, Team Owner, Venue Owner, Player and Referee experiences.',
         'LEAGUE', 'REGISTRATION_OPEN', true, 8, 500, 3, 1, 0,
         '["POINTS","GOAL_DIFFERENCE","GOALS_FOR"]'::jsonb,
         $4, $5, now(), now(), now()
       )
       returning id`,
      [venue.id, users.mahdi.id, competitionName, competitionStarts, competitionEnds],
    );
    competition = competitionResult.rows[0];
  } else {
    await client.query(
      `update competitions set
         status = 'REGISTRATION_OPEN',
         published = true,
         published_at = coalesce(published_at, now()),
         starts_at = $2,
         ends_at = $3,
         updated_at = now()
       where id = $1`,
      [competition.id, competitionStarts, competitionEnds],
    );
  }

  await client.query(
    `insert into competition_teams (
       competition_id, team_id, status, seed, fee_status,
       applied_by_user_id, responded_by_user_id, responded_at, created_at, updated_at
     ) values ($1, $2, 'ACCEPTED', 1, 'PAID', $3, $4, now(), now(), now())
     on conflict (competition_id, team_id) do update set
       status = 'ACCEPTED',
       seed = 1,
       fee_status = 'PAID',
       applied_by_user_id = excluded.applied_by_user_id,
       responded_by_user_id = excluded.responded_by_user_id,
       responded_at = now(),
       updated_at = now()`,
    [competition.id, team.id, users.alisina.id, users.mahdi.id],
  );

  // Venue post mirrored into the social feed.
  const venuePostBody = "Weekend futsal slots are open at Mahdi's venue. Follow us for booking updates and offers.";
  let venuePostResult = await client.query(
    "select id from venue_posts where venue_id = $1 and body = $2 limit 1",
    [venue.id, venuePostBody],
  );
  let venuePost = venuePostResult.rows[0];
  if (!venuePost) {
    venuePostResult = await client.query(
      `insert into venue_posts (
         venue_id, created_by_user_id, body, cta_type, cta_target_id,
         status, published_at, created_at, updated_at
       ) values ($1, $2, $3, 'VENUE', $1, 'PUBLISHED', now(), now(), now())
       returning id`,
      [venue.id, users.mahdi.id, venuePostBody],
    );
    venuePost = venuePostResult.rows[0];
  } else {
    await client.query(
      "update venue_posts set status = 'PUBLISHED', unpublished_at = null, updated_at = now() where id = $1",
      [venuePost.id],
    );
  }

  let socialVenuePostResult = await client.query(
    "select id from social_posts where legacy_venue_post_id = $1 limit 1",
    [venuePost.id],
  );
  let socialVenuePost = socialVenuePostResult.rows[0];
  if (!socialVenuePost) {
    socialVenuePostResult = await client.query(
      `insert into social_posts (
         entity_type, entity_id, created_by_user_id, legacy_venue_post_id,
         body, status, published_at, created_at, updated_at
       ) values ('VENUE', $1, $2, $3, $4, 'PUBLISHED', now(), now(), now())
       returning id`,
      [venue.id, users.mahdi.id, venuePost.id, venuePostBody],
    );
    socialVenuePost = socialVenuePostResult.rows[0];
  } else {
    await client.query(
      "update social_posts set status = 'PUBLISHED', unpublished_at = null, updated_at = now() where id = $1",
      [socialVenuePost.id],
    );
  }

  const teamPostBody = "Alisina United is preparing for the LeagueKick Demo Cup. Follow the team for roster and match updates.";
  let teamPostResult = await client.query(
    "select id from social_posts where entity_type = 'TEAM' and entity_id = $1 and body = $2 limit 1",
    [team.id, teamPostBody],
  );
  let teamPost = teamPostResult.rows[0];
  if (!teamPost) {
    teamPostResult = await client.query(
      `insert into social_posts (
         entity_type, entity_id, created_by_user_id, body, status, published_at, created_at, updated_at
       ) values ('TEAM', $1, $2, $3, 'PUBLISHED', now(), now(), now())
       returning id`,
      [team.id, users.alisina.id, teamPostBody],
    );
    teamPost = teamPostResult.rows[0];
  } else {
    await client.query(
      "update social_posts set status = 'PUBLISHED', unpublished_at = null, updated_at = now() where id = $1",
      [teamPost.id],
    );
  }

  const competitionPostBody = "LeagueKick Demo Cup registration is open. Follow the competition for fixtures, results and standings.";
  let competitionPostResult = await client.query(
    "select id from social_posts where entity_type = 'COMPETITION' and entity_id = $1 and body = $2 limit 1",
    [competition.id, competitionPostBody],
  );
  let competitionPost = competitionPostResult.rows[0];
  if (!competitionPost) {
    competitionPostResult = await client.query(
      `insert into social_posts (
         entity_type, entity_id, created_by_user_id, body, status, published_at, created_at, updated_at
       ) values ('COMPETITION', $1, $2, $3, 'PUBLISHED', now(), now(), now())
       returning id`,
      [competition.id, users.mahdi.id, competitionPostBody],
    );
    competitionPost = competitionPostResult.rows[0];
  } else {
    await client.query(
      "update social_posts set status = 'PUBLISHED', unpublished_at = null, updated_at = now() where id = $1",
      [competitionPost.id],
    );
  }

  // Shams: normal-user Home feed follows all three demo entities.
  await client.query(
    "insert into venue_follows (user_id, venue_id, created_at) values ($1, $2, now()) on conflict do nothing",
    [users.shams.id, venue.id],
  );
  for (const [entityType, entityId] of [
    ["VENUE", venue.id],
    ["TEAM", team.id],
    ["COMPETITION", competition.id],
  ]) {
    await client.query(
      `insert into social_follows (user_id, entity_type, entity_id, created_at)
       values ($1, $2::social_entity_type, $3, now())
       on conflict do nothing`,
      [users.shams.id, entityType, entityId],
    );
  }

  await client.query(
    "insert into social_post_likes (post_id, user_id, created_at) values ($1, $2, now()) on conflict do nothing",
    [teamPost.id, users.shams.id],
  );
  await client.query(
    "insert into social_post_likes (post_id, user_id, created_at) values ($1, $2, now()) on conflict do nothing",
    [socialVenuePost.id, users.abdul.id],
  );

  const commentBody = "Looking forward to the Demo Cup!";
  const existingComment = await client.query(
    "select id from social_post_comments where post_id = $1 and user_id = $2 and body = $3 limit 1",
    [competitionPost.id, users.shams.id, commentBody],
  );
  if (!existingComment.rows[0]) {
    await client.query(
      "insert into social_post_comments (post_id, user_id, body, created_at) values ($1, $2, $3, now())",
      [competitionPost.id, users.shams.id, commentBody],
    );
  }

  // Shams: sample confirmed booking at Mahdi's venue.
  const existingBooking = await client.query(
    "select id from bookings where created_by_user_id = $1 and idempotency_key = 'role-demo-shams-booking' limit 1",
    [users.shams.id],
  );
  if (!existingBooking.rows[0]) {
    const bookingStart = atHour(now, 5, 13, 30);
    const bookingEnd = new Date(bookingStart.getTime() + 90 * 60 * 1000);
    await client.query(
      `insert into bookings (
         venue_id, area_id, player_user_id, created_by_user_id, source, status,
         starts_at, ends_at, price_afn, currency, customer_name, customer_phone,
         note, cancellation_policy_snapshot, idempotency_key, created_at, updated_at
       ) values (
         $1, $2, $3, $3, 'ONLINE', 'CONFIRMED',
         $4, $5, 1200, 'AFN', $6, $7,
         'Role demo booking for the Normal User account.',
         'Free cancellation before the booking start time.',
         'role-demo-shams-booking', now(), now()
       )`,
      [
        venue.id,
        area.id,
        users.shams.id,
        bookingStart,
        bookingEnd,
        users.shams.display_name,
        users.shams.phone_e164,
      ],
    );
  }

  // Mahdi: an active promotion for owner operations testing.
  const promotionTitle = "Role Demo Evening Discount";
  const existingPromotion = await client.query(
    "select id from venue_promotions where venue_id = $1 and title = $2 limit 1",
    [venue.id, promotionTitle],
  );
  if (!existingPromotion.rows[0]) {
    const promoStart = atHour(now, 6, 14, 0);
    const promoEnd = new Date(promoStart.getTime() + 90 * 60 * 1000);
    await client.query(
      `insert into venue_promotions (
         venue_id, area_id, starts_at, ends_at, original_price_afn,
         discounted_price_afn, status, title, note, notify_followers,
         created_by_user_id, created_at, updated_at
       ) values (
         $1, $2, $3, $4, 1200, 900, 'ACTIVE', $5,
         'Demo promotion for Venue Owner testing.', true, $6, now(), now()
       )
       on conflict do nothing`,
      [venue.id, area.id, promoStart, promoEnd, promotionTitle, users.mahdi.id],
    );
  }

  const auditExists = await client.query(
    "select id from audit_logs where action = 'ROLE_DEMO_SEEDED' and target_type = 'ROLE_DEMO' and target_id = 'six-role-demo' limit 1",
  );
  if (!auditExists.rows[0]) {
    await client.query(
      `insert into audit_logs (
         actor_user_id, action, target_type, target_id, metadata, created_at
       ) values (
         $1, 'ROLE_DEMO_SEEDED', 'ROLE_DEMO', 'six-role-demo',
         $2::jsonb, now()
       )`,
      [
        users.ali.id,
        JSON.stringify({
          shams: "NORMAL_USER",
          abdul: "PLAYER",
          mahdi: "VENUE_OWNER",
          alisina: "TEAM_MANAGER",
          saeed: "REFEREE",
          ali: "PLATFORM_ADMIN",
        }),
      ],
    );
  }

  await client.query("commit");

  console.log("Role demo seed completed.");
  console.table([
    { login: "shams", role: "Normal User", demo: "Mixed Home feed + confirmed booking" },
    { login: "abdul", role: "Player", demo: `Player in ${team.name} (#7)` },
    { login: "mahdi", role: "Venue Owner", demo: `${venue.name} + court + promotion + competition` },
    { login: "alisina", role: "Team Owner", demo: `${team.name} + Abdul roster` },
    { login: "Saeed", role: "Referee", demo: `Assigned to ${venue.name}` },
    { login: "ali", role: "Platform Admin", demo: "Admin actor + subscription/payment/audit data" },
  ]);
} catch (error) {
  await client.query("rollback");
  console.error("Role demo seed failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
