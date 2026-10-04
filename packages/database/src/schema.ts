import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const languageCodeEnum = pgEnum("language_code", ["fa-AF", "ps-AF", "en"]);
export const userStatusEnum = pgEnum("user_status", ["ACTIVE", "SUSPENDED", "DELETED"]);
export const userRoleEnum = pgEnum("user_role", [
  "PLAYER",
  "TEAM_MANAGER",
  "REFEREE",
  "VENUE_STAFF",
  "COMPETITION_ADMIN",
  "VENUE_OWNER",
  "PLATFORM_ADMIN",
]);
export const venueStatusEnum = pgEnum("venue_status", ["DRAFT", "READY", "ACTIVE", "SUSPENDED"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["TRIAL", "ACTIVE", "EXPIRED", "CANCELLED"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    displayName: varchar("display_name", { length: 80 }).notNull(),
    username: varchar("username", { length: 30 }),
    usernameNormalized: varchar("username_normalized", { length: 30 }),
    phoneE164: varchar("phone_e164", { length: 20 }).notNull(),
    phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
    emailNormalized: varchar("email_normalized", { length: 320 }),
    passwordHash: text("password_hash").notNull(),
    preferredLanguage: languageCodeEnum("preferred_language").notNull().default("fa-AF"),
    status: userStatusEnum("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("users_phone_e164_uq").on(table.phoneE164),
    uniqueIndex("users_username_normalized_uq").on(table.usernameNormalized),
    uniqueIndex("users_email_normalized_uq").on(table.emailNormalized),
    index("users_status_idx").on(table.status),
  ],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: userRoleEnum("role").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.role] }), index("user_roles_role_idx").on(table.role)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    refreshTokenHash: varchar("refresh_token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    deviceLabel: varchar("device_label", { length: 120 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_refresh_token_hash_uq").on(table.refreshTokenHash),
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 100 }).notNull(),
    targetType: varchar("target_type", { length: 80 }).notNull(),
    targetId: varchar("target_id", { length: 100 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_logs_actor_idx").on(table.actorUserId), index("audit_logs_created_at_idx").on(table.createdAt)],
);

export const venues = pgTable(
  "venues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 120 }).notNull(),
    publicPhone: varchar("public_phone", { length: 20 }).notNull(),
    whatsappPhone: varchar("whatsapp_phone", { length: 20 }),
    province: varchar("province", { length: 80 }).notNull(),
    city: varchar("city", { length: 80 }).notNull(),
    address: varchar("address", { length: 240 }).notNull(),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    status: venueStatusEnum("status").notNull().default("DRAFT"),
    setupCompletedAt: timestamp("setup_completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("venues_owner_user_id_uq").on(table.ownerUserId),
    index("venues_status_idx").on(table.status),
    index("venues_location_idx").on(table.province, table.city),
  ],
);

export const venueAreas = pgTable(
  "venue_areas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    defaultSessionDurationMinutes: integer("default_session_duration_minutes").notNull(),
    basePriceAfn: integer("base_price_afn").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("venue_areas_name_uq").on(table.venueId, table.name),
    index("venue_areas_venue_id_idx").on(table.venueId),
  ],
);

export const venueOpeningHours = pgTable(
  "venue_opening_hours",
  {
    venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(),
    isClosed: boolean("is_closed").notNull().default(false),
    opensAt: time("opens_at"),
    closesAt: time("closes_at"),
  },
  (table) => [
    primaryKey({ columns: [table.venueId, table.dayOfWeek] }),
    index("venue_opening_hours_venue_id_idx").on(table.venueId),
  ],
);

export const venueSubscriptions = pgTable(
  "venue_subscriptions",
  {
    venueId: uuid("venue_id").primaryKey().references(() => venues.id, { onDelete: "cascade" }),
    status: subscriptionStatusEnum("status").notNull(),
    trialStartedAt: timestamp("trial_started_at", { withTimezone: true }),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    activeUntil: timestamp("active_until", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("venue_subscriptions_status_idx").on(table.status),
    index("venue_subscriptions_trial_ends_idx").on(table.trialEndsAt),
  ],
);

export const venueTrialClaims = pgTable(
  "venue_trial_claims",
  {
    identityHash: varchar("identity_hash", { length: 64 }).primaryKey(),
    venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "restrict" }),
    ownerUserId: uuid("owner_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("venue_trial_claims_venue_id_uq").on(table.venueId),
    index("venue_trial_claims_owner_idx").on(table.ownerUserId),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type VenueRow = typeof venues.$inferSelect;
export type VenueAreaRow = typeof venueAreas.$inferSelect;
export type VenueOpeningHourRow = typeof venueOpeningHours.$inferSelect;
export type VenueSubscriptionRow = typeof venueSubscriptions.$inferSelect;
