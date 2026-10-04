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
export const bookingModeEnum = pgEnum("booking_mode", ["INSTANT", "APPROVAL"]);
export const bookingStatusEnum = pgEnum("booking_status", ["PENDING", "CONFIRMED", "CANCELLED"]);
export const bookingSourceEnum = pgEnum("booking_source", ["ONLINE", "MANUAL"]);
export const promotionStatusEnum = pgEnum("promotion_status", ["ACTIVE", "CLOSED", "EXPIRED"]);
export const postStatusEnum = pgEnum("post_status", ["PUBLISHED", "UNPUBLISHED"]);
export const postCtaTypeEnum = pgEnum("post_cta_type", ["NONE", "VENUE", "PROMOTION", "COMPETITION"]);
export const notificationTypeEnum = pgEnum("notification_type", ["BOOKING_CONFIRMED", "BOOKING_CANCELLED", "SLOT_PROMOTION", "VENUE_POST"]);
export const notificationChannelEnum = pgEnum("notification_channel", ["IN_APP", "PUSH"]);
export const notificationDeliveryStatusEnum = pgEnum("notification_delivery_status", ["PENDING", "SENT", "SKIPPED", "FAILED"]);
export const devicePlatformEnum = pgEnum("device_platform", ["ANDROID", "IOS"]);

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
    timezone: varchar("timezone", { length: 64 }).notNull().default("Asia/Kabul"),
    bookingMode: bookingModeEnum("booking_mode").notNull().default("INSTANT"),
    cancellationPolicy: text("cancellation_policy").notNull().default("Cancellation is allowed before the booking start time."),
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


export const venueBlocks = pgTable(
  "venue_blocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    areaId: uuid("area_id").notNull().references(() => venueAreas.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    reason: varchar("reason", { length: 240 }),
    createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("venue_blocks_area_time_idx").on(table.areaId, table.startsAt, table.endsAt),
    index("venue_blocks_venue_time_idx").on(table.venueId, table.startsAt),
  ],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "restrict" }),
    areaId: uuid("area_id").notNull().references(() => venueAreas.id, { onDelete: "restrict" }),
    playerUserId: uuid("player_user_id").references(() => users.id, { onDelete: "set null" }),
    createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    source: bookingSourceEnum("source").notNull(),
    status: bookingStatusEnum("status").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    priceAfn: integer("price_afn").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("AFN"),
    customerName: varchar("customer_name", { length: 120 }),
    customerPhone: varchar("customer_phone", { length: 20 }),
    note: varchar("note", { length: 500 }),
    cancellationPolicySnapshot: text("cancellation_policy_snapshot").notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 80 }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledByUserId: uuid("cancelled_by_user_id").references(() => users.id, { onDelete: "set null" }),
    cancellationReason: varchar("cancellation_reason", { length: 240 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("bookings_actor_idempotency_uq").on(table.createdByUserId, table.idempotencyKey),
    index("bookings_area_time_idx").on(table.areaId, table.startsAt, table.endsAt),
    index("bookings_venue_time_idx").on(table.venueId, table.startsAt),
    index("bookings_player_time_idx").on(table.playerUserId, table.startsAt),
    index("bookings_status_idx").on(table.status),
  ],
);


export const venuePromotions = pgTable(
  "venue_promotions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    areaId: uuid("area_id").notNull().references(() => venueAreas.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    originalPriceAfn: integer("original_price_afn").notNull(),
    discountedPriceAfn: integer("discounted_price_afn").notNull(),
    status: promotionStatusEnum("status").notNull().default("ACTIVE"),
    title: varchar("title", { length: 120 }).notNull(),
    note: varchar("note", { length: 500 }),
    notifyFollowers: boolean("notify_followers").notNull().default(true),
    createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closeReason: varchar("close_reason", { length: 80 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("venue_promotions_slot_uq").on(table.areaId, table.startsAt, table.endsAt),
    index("venue_promotions_venue_status_idx").on(table.venueId, table.status),
    index("venue_promotions_area_time_idx").on(table.areaId, table.startsAt, table.endsAt),
  ],
);

export const venuePosts = pgTable(
  "venue_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    imageUrl: text("image_url"),
    ctaType: postCtaTypeEnum("cta_type").notNull().default("NONE"),
    ctaTargetId: uuid("cta_target_id"),
    status: postStatusEnum("status").notNull().default("PUBLISHED"),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    unpublishedAt: timestamp("unpublished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("venue_posts_venue_status_idx").on(table.venueId, table.status),
    index("venue_posts_published_at_idx").on(table.publishedAt),
  ],
);

export const venueFollows = pgTable(
  "venue_follows",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.venueId] }),
    index("venue_follows_venue_idx").on(table.venueId),
  ],
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
    inAppEnabled: boolean("in_app_enabled").notNull().default(true),
    pushEnabled: boolean("push_enabled").notNull().default(true),
    promotionsEnabled: boolean("promotions_enabled").notNull().default(true),
    venuePostsEnabled: boolean("venue_posts_enabled").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    body: varchar("body", { length: 500 }).notNull(),
    deepLink: varchar("deep_link", { length: 500 }).notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    dedupeKey: varchar("dedupe_key", { length: 160 }).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("notifications_user_dedupe_uq").on(table.userId, table.dedupeKey),
    index("notifications_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const pushDevices = pgTable(
  "push_devices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expoPushToken: varchar("expo_push_token", { length: 220 }).notNull(),
    platform: devicePlatformEnum("platform").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("push_devices_token_uq").on(table.expoPushToken),
    index("push_devices_user_idx").on(table.userId),
  ],
);

export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    notificationId: uuid("notification_id").notNull().references(() => notifications.id, { onDelete: "cascade" }),
    channel: notificationChannelEnum("channel").notNull(),
    status: notificationDeliveryStatusEnum("status").notNull().default("PENDING"),
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    error: varchar("error", { length: 500 }),
  },
  (table) => [
    primaryKey({ columns: [table.notificationId, table.channel] }),
    index("notification_deliveries_status_idx").on(table.status),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type VenueRow = typeof venues.$inferSelect;
export type VenueAreaRow = typeof venueAreas.$inferSelect;
export type VenueOpeningHourRow = typeof venueOpeningHours.$inferSelect;
export type VenueSubscriptionRow = typeof venueSubscriptions.$inferSelect;
export type VenueBlockRow = typeof venueBlocks.$inferSelect;
export type BookingRow = typeof bookings.$inferSelect;
export type VenuePromotionRow = typeof venuePromotions.$inferSelect;
export type VenuePostRow = typeof venuePosts.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
