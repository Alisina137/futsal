import { sql } from "drizzle-orm";
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
export const venueVerificationStatusEnum = pgEnum("venue_verification_status", ["PENDING", "VERIFIED", "REJECTED"]);
export const subscriptionPaymentStatusEnum = pgEnum("subscription_payment_status", ["RECORDED", "VOIDED"]);
export const paidRoleSubscriptionStatusEnum = pgEnum("paid_role_subscription_status", ["PENDING", "ACTIVE", "EXPIRED", "CANCELLED"]);
export const bookingModeEnum = pgEnum("booking_mode", ["INSTANT", "APPROVAL"]);
export const bookingStatusEnum = pgEnum("booking_status", ["PENDING", "CONFIRMED", "CANCELLED"]);
export const bookingSourceEnum = pgEnum("booking_source", ["ONLINE", "MANUAL"]);
export const promotionStatusEnum = pgEnum("promotion_status", ["ACTIVE", "CLOSED", "EXPIRED"]);
export const postStatusEnum = pgEnum("post_status", ["PUBLISHED", "UNPUBLISHED"]);
export const postCtaTypeEnum = pgEnum("post_cta_type", ["NONE", "VENUE", "PROMOTION", "COMPETITION"]);
export const socialEntityTypeEnum = pgEnum("social_entity_type", ["VENUE", "TEAM", "COMPETITION"]);
export const notificationTypeEnum = pgEnum("notification_type", ["BOOKING_CONFIRMED", "BOOKING_CANCELLED", "SLOT_PROMOTION", "VENUE_POST", "TEAM_INVITATION", "COMPETITION_UPDATE"]);
export const notificationChannelEnum = pgEnum("notification_channel", ["IN_APP", "PUSH"]);
export const notificationDeliveryStatusEnum = pgEnum("notification_delivery_status", ["PENDING", "SENT", "SKIPPED", "FAILED"]);
export const devicePlatformEnum = pgEnum("device_platform", ["ANDROID", "IOS"]);
export const playerPositionEnum = pgEnum("player_position", ["UNSPECIFIED", "GOALKEEPER", "FIXO", "ALA", "PIVO", "UNIVERSAL"]);
export const profileVisibilityEnum = pgEnum("profile_visibility", ["PUBLIC", "PRIVATE"]);
export const teamStatusEnum = pgEnum("team_status", ["ACTIVE", "ARCHIVED"]);
export const teamPrivacyEnum = pgEnum("team_privacy", ["PUBLIC", "PRIVATE"]);
export const teamMemberRoleEnum = pgEnum("team_member_role", ["MANAGER", "CAPTAIN", "PLAYER"]);
export const teamMembershipStatusEnum = pgEnum("team_membership_status", ["ACTIVE", "REMOVED"]);
export const teamInvitationStatusEnum = pgEnum("team_invitation_status", ["PENDING", "ACCEPTED", "DECLINED", "REVOKED", "EXPIRED"]);
export const teamJoinRequestStatusEnum = pgEnum("team_join_request_status", ["PENDING", "ACCEPTED", "REJECTED", "CANCELLED"]);
export const competitionFormatEnum = pgEnum("competition_format", ["LEAGUE", "KNOCKOUT", "GROUP_KNOCKOUT"]);
export const competitionStatusEnum = pgEnum("competition_status", ["DRAFT", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "ARCHIVED", "CANCELLED"]);
export const competitionRegistrationStatusEnum = pgEnum("competition_registration_status", ["INVITED", "APPLIED", "PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN"]);
export const competitionFeeStatusEnum = pgEnum("competition_fee_status", ["UNPAID", "PENDING", "PAID", "WAIVED"]);
export const competitionMatchStageEnum = pgEnum("competition_match_stage", ["LEAGUE", "GROUP", "KNOCKOUT"]);
export const competitionMatchStatusEnum = pgEnum("competition_match_status", ["UNSCHEDULED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "POSTPONED", "CANCELLED", "CORRECTED"]);
export const venueTimetableStatusEnum = pgEnum("venue_timetable_status", ["DRAFT", "PUBLISHED", "ARCHIVED"]);

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
    profileImageUrl: text("profile_image_url"),
    age: integer("age"),
    city: varchar("city", { length: 80 }),
    bio: varchar("bio", { length: 280 }),
    lastCredentialResetAt: timestamp("last_credential_reset_at", { withTimezone: true }),
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

export const roleSubscriptions = pgTable(
  "role_subscriptions",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: userRoleEnum("role").notNull(),
    status: paidRoleSubscriptionStatusEnum("status").notNull().default("PENDING"),
    monthlyPriceAfn: integer("monthly_price_afn").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    activeUntil: timestamp("active_until", { withTimezone: true }),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    activatedByUserId: uuid("activated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    paymentReference: varchar("payment_reference", { length: 120 }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.role] }),
    index("role_subscriptions_status_idx").on(table.status, table.requestedAt),
    index("role_subscriptions_active_until_idx").on(table.activeUntil),
  ],
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

export const passwordResetChallenges = pgTable(
  "password_reset_challenges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    phoneE164: varchar("phone_e164", { length: 20 }).notNull(),
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    resetTokenHash: varchar("reset_token_hash", { length: 64 }),
    resetTokenExpiresAt: timestamp("reset_token_expires_at", { withTimezone: true }),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("password_reset_phone_created_idx").on(table.phoneE164, table.createdAt),
    index("password_reset_expires_idx").on(table.expiresAt),
    index("password_reset_user_idx").on(table.userId),
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
    verificationStatus: venueVerificationStatusEnum("verification_status").notNull().default("PENDING"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verifiedByUserId: uuid("verified_by_user_id").references(() => users.id, { onDelete: "set null" }),
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

export const venueReferees = pgTable(
  "venue_referees",
  {
    venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    assignedByUserId: uuid("assigned_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.venueId, table.userId] }),
    index("venue_referees_user_idx").on(table.userId),
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

export const venueTimetables = pgTable(
  "venue_timetables",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull().default("Weekly timetable"),
    status: venueTimetableStatusEnum("status").notNull().default("DRAFT"),
    effectiveFrom: varchar("effective_from", { length: 10 }).notNull(),
    effectiveUntil: varchar("effective_until", { length: 10 }),
    defaultSlotDurationMinutes: integer("default_slot_duration_minutes").notNull().default(90),
    bufferMinutes: integer("buffer_minutes").notNull().default(0),
    createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("venue_timetables_venue_status_idx").on(table.venueId, table.status),
    index("venue_timetables_effective_idx").on(table.venueId, table.effectiveFrom, table.effectiveUntil),
  ],
);

export const venueTimetablePeriods = pgTable(
  "venue_timetable_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    timetableId: uuid("timetable_id").notNull().references(() => venueTimetables.id, { onDelete: "cascade" }),
    areaId: uuid("area_id").references(() => venueAreas.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(),
    startsAt: time("starts_at").notNull(),
    endsAt: time("ends_at").notNull(),
  },
  (table) => [
    index("venue_timetable_periods_timetable_day_idx").on(table.timetableId, table.dayOfWeek),
    index("venue_timetable_periods_area_idx").on(table.areaId),
  ],
);

export const venueTimetableExceptions = pgTable(
  "venue_timetable_exceptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    areaId: uuid("area_id").references(() => venueAreas.id, { onDelete: "cascade" }),
    date: varchar("date", { length: 10 }).notNull(),
    isClosed: boolean("is_closed").notNull().default(false),
    periods: jsonb("periods").$type<Array<{ startsAt: string; endsAt: string }>>().notNull().default([]),
    note: varchar("note", { length: 240 }),
    createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("venue_timetable_exceptions_venue_date_idx").on(table.venueId, table.date),
    index("venue_timetable_exceptions_area_idx").on(table.areaId),
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


export const subscriptionPayments = pgTable(
  "subscription_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "restrict" }),
    amountAfn: integer("amount_afn").notNull(),
    periodStartsAt: timestamp("period_starts_at", { withTimezone: true }).notNull(),
    periodEndsAt: timestamp("period_ends_at", { withTimezone: true }).notNull(),
    provider: varchar("provider", { length: 40 }).notNull().default("MANUAL"),
    providerReference: varchar("provider_reference", { length: 120 }),
    status: subscriptionPaymentStatusEnum("status").notNull().default("RECORDED"),
    note: varchar("note", { length: 500 }),
    recordedByUserId: uuid("recorded_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedByUserId: uuid("voided_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("subscription_payments_venue_created_idx").on(table.venueId, table.createdAt),
    uniqueIndex("subscription_payments_provider_reference_uq")
      .on(table.provider, table.providerReference)
      .where(sql`${table.providerReference} is not null`),
  ],
);

export const platformSettings = pgTable(
  "platform_settings",
  {
    id: varchar("id", { length: 20 }).primaryKey().default("default"),
    monthlyPriceAfn: integer("monthly_price_afn").notNull().default(1000),
    annualPriceAfn: integer("annual_price_afn").notNull().default(12000),
    trialDurationHours: integer("trial_duration_hours").notNull().default(72),
    featureFlags: jsonb("feature_flags").$type<Record<string, boolean>>().notNull().default({}),
    notificationTemplates: jsonb("notification_templates").$type<Record<string, string>>().notNull().default({}),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
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
    uniqueIndex("venue_promotions_active_slot_uq")
      .on(table.areaId, table.startsAt, table.endsAt)
      .where(sql`${table.status} = 'ACTIVE'`),
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


export const socialFollows = pgTable(
  "social_follows",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    entityType: socialEntityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.entityType, table.entityId] }),
    index("social_follows_entity_idx").on(table.entityType, table.entityId),
    index("social_follows_user_idx").on(table.userId),
  ],
);

export const socialPosts = pgTable(
  "social_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityType: socialEntityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    legacyVenuePostId: uuid("legacy_venue_post_id").references(() => venuePosts.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    imageUrl: text("image_url"),
    status: postStatusEnum("status").notNull().default("PUBLISHED"),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    unpublishedAt: timestamp("unpublished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("social_posts_legacy_venue_post_uq").on(table.legacyVenuePostId),
    index("social_posts_entity_status_idx").on(table.entityType, table.entityId, table.status),
    index("social_posts_published_at_idx").on(table.publishedAt),
  ],
);

export const socialPostLikes = pgTable(
  "social_post_likes",
  {
    postId: uuid("post_id").notNull().references(() => socialPosts.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.userId] }),
    index("social_post_likes_user_idx").on(table.userId),
  ],
);

export const socialPostComments = pgTable(
  "social_post_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id").notNull().references(() => socialPosts.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
  },
  (table) => [
    index("social_post_comments_post_created_idx").on(table.postId, table.createdAt),
    index("social_post_comments_user_idx").on(table.userId),
  ],
);

export const socialPostCommentLikes = pgTable(
  "social_post_comment_likes",
  {
    commentId: uuid("comment_id").notNull().references(() => socialPostComments.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.commentId, table.userId] }),
    index("social_post_comment_likes_user_idx").on(table.userId),
  ],
);


export const playerProfiles = pgTable(
  "player_profiles",
  {
    userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
    publicDisplayName: varchar("public_display_name", { length: 80 }).notNull(),
    imageUrl: text("image_url"),
    position: playerPositionEnum("position").notNull().default("UNSPECIFIED"),
    visibility: profileVisibilityEnum("visibility").notNull().default("PUBLIC"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("player_profiles_visibility_idx").on(table.visibility),
  ],
);

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    logoUrl: text("logo_url"),
    city: varchar("city", { length: 80 }).notNull(),
    managerUserId: uuid("manager_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    captainUserId: uuid("captain_user_id").references(() => users.id, { onDelete: "set null" }),
    status: teamStatusEnum("status").notNull().default("ACTIVE"),
    privacy: teamPrivacyEnum("privacy").notNull().default("PUBLIC"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("teams_manager_idx").on(table.managerUserId),
    index("teams_city_status_idx").on(table.city, table.status),
    index("teams_privacy_status_idx").on(table.privacy, table.status),
  ],
);

export const teamMemberships = pgTable(
  "team_memberships",
  {
    teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: teamMemberRoleEnum("role").notNull().default("PLAYER"),
    shirtNumber: integer("shirt_number"),
    status: teamMembershipStatusEnum("status").notNull().default("ACTIVE"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.teamId, table.userId] }),
    index("team_memberships_user_status_idx").on(table.userId, table.status),
    index("team_memberships_team_status_idx").on(table.teamId, table.status),
  ],
);

export const teamInvitations = pgTable(
  "team_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    invitedUserId: uuid("invited_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    invitedByUserId: uuid("invited_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    role: teamMemberRoleEnum("role").notNull().default("PLAYER"),
    shirtNumber: integer("shirt_number"),
    status: teamInvitationStatusEnum("status").notNull().default("PENDING"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("team_invitations_pending_uq")
      .on(table.teamId, table.invitedUserId)
      .where(sql`${table.status} = 'PENDING'`),
    index("team_invitations_invited_status_idx").on(table.invitedUserId, table.status),
    index("team_invitations_team_status_idx").on(table.teamId, table.status),
  ],
);


export const teamJoinRequests = pgTable(
  "team_join_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    requesterUserId: uuid("requester_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    status: teamJoinRequestStatusEnum("status").notNull().default("PENDING"),
    respondedByUserId: uuid("responded_by_user_id").references(() => users.id, { onDelete: "set null" }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("team_join_requests_pending_uq")
      .on(table.teamId, table.requesterUserId)
      .where(sql`${table.status} = 'PENDING'`),
    index("team_join_requests_team_status_idx").on(table.teamId, table.status),
    index("team_join_requests_user_status_idx").on(table.requesterUserId, table.status),
  ],
);


export const competitions = pgTable(
  "competitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 140 }).notNull(),
    description: text("description"),
    format: competitionFormatEnum("format").notNull(),
    status: competitionStatusEnum("status").notNull().default("DRAFT"),
    published: boolean("published").notNull().default(false),
    maxTeams: integer("max_teams").notNull(),
    registrationFeeAfn: integer("registration_fee_afn").notNull().default(0),
    winPoints: integer("win_points").notNull().default(3),
    drawPoints: integer("draw_points").notNull().default(1),
    lossPoints: integer("loss_points").notNull().default(0),
    tieBreakOrder: jsonb("tie_break_order").$type<string[]>().notNull().default(["POINTS", "GOAL_DIFFERENCE", "GOALS_FOR"]),
    groupCount: integer("group_count"),
    qualifiersPerGroup: integer("qualifiers_per_group"),
    registrationClosesAt: timestamp("registration_closes_at", { withTimezone: true }),
    matchDurationMinutes: integer("match_duration_minutes").notNull().default(60),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    materialPlayStartedAt: timestamp("material_play_started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("competitions_venue_status_idx").on(table.venueId, table.status),
    index("competitions_public_idx").on(table.published, table.status, table.startsAt),
  ],
);

export const competitionGroups = pgTable(
  "competition_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    competitionId: uuid("competition_id").notNull().references(() => competitions.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 40 }).notNull(),
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("competition_groups_name_uq").on(table.competitionId, table.name),
    uniqueIndex("competition_groups_order_uq").on(table.competitionId, table.sortOrder),
  ],
);

export const competitionTeams = pgTable(
  "competition_teams",
  {
    competitionId: uuid("competition_id").notNull().references(() => competitions.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "restrict" }),
    status: competitionRegistrationStatusEnum("status").notNull().default("PENDING"),
    seed: integer("seed"),
    groupId: uuid("group_id").references(() => competitionGroups.id, { onDelete: "set null" }),
    feeStatus: competitionFeeStatusEnum("fee_status").notNull().default("UNPAID"),
    feePaymentReference: varchar("fee_payment_reference", { length: 120 }),
    feeConfirmedAt: timestamp("fee_confirmed_at", { withTimezone: true }),
    feeConfirmedByUserId: uuid("fee_confirmed_by_user_id").references(() => users.id, { onDelete: "set null" }),
    appliedByUserId: uuid("applied_by_user_id").references(() => users.id, { onDelete: "set null" }),
    respondedByUserId: uuid("responded_by_user_id").references(() => users.id, { onDelete: "set null" }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    qualifiedAt: timestamp("qualified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.competitionId, table.teamId] }),
    index("competition_teams_status_idx").on(table.competitionId, table.status),
    index("competition_teams_group_idx").on(table.groupId),
  ],
);

export const competitionMatches = pgTable(
  "competition_matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    competitionId: uuid("competition_id").notNull().references(() => competitions.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references(() => competitionGroups.id, { onDelete: "set null" }),
    stage: competitionMatchStageEnum("stage").notNull(),
    roundNumber: integer("round_number").notNull(),
    slotNumber: integer("slot_number").notNull(),
    homeTeamId: uuid("home_team_id").references(() => teams.id, { onDelete: "restrict" }),
    awayTeamId: uuid("away_team_id").references(() => teams.id, { onDelete: "restrict" }),
    venueId: uuid("venue_id").references(() => venues.id, { onDelete: "restrict" }),
    areaId: uuid("area_id").references(() => venueAreas.id, { onDelete: "restrict" }),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    status: competitionMatchStatusEnum("status").notNull().default("UNSCHEDULED"),
    homeScore: integer("home_score"),
    awayScore: integer("away_score"),
    winnerTeamId: uuid("winner_team_id").references(() => teams.id, { onDelete: "restrict" }),
    nextMatchId: uuid("next_match_id"),
    nextMatchSide: varchar("next_match_side", { length: 4 }),
    refereeUserId: uuid("referee_user_id").references(() => users.id, { onDelete: "set null" }),
    resultEnteredByUserId: uuid("result_entered_by_user_id").references(() => users.id, { onDelete: "set null" }),
    resultEnteredAt: timestamp("result_entered_at", { withTimezone: true }),
    correctionReason: varchar("correction_reason", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("competition_matches_slot_uq").on(table.competitionId, table.stage, table.roundNumber, table.slotNumber, table.groupId),
    index("competition_matches_competition_status_idx").on(table.competitionId, table.status),
    index("competition_matches_area_time_idx").on(table.areaId, table.startsAt, table.endsAt),
  ],
);

export const playerMatchStats = pgTable(
  "player_match_stats",
  {
    matchId: uuid("match_id").notNull().references(() => competitionMatches.id, { onDelete: "cascade" }),
    playerUserId: uuid("player_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "restrict" }),
    appeared: boolean("appeared").notNull().default(true),
    goals: integer("goals").notNull().default(0),
    assists: integer("assists").notNull().default(0),
    yellowCards: integer("yellow_cards").notNull().default(0),
    redCards: integer("red_cards").notNull().default(0),
    cleanSheet: boolean("clean_sheet").notNull().default(false),
    playerOfMatch: boolean("player_of_match").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.matchId, table.playerUserId] }),
    index("player_match_stats_team_idx").on(table.teamId),
    index("player_match_stats_player_idx").on(table.playerUserId),
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
    teamInvitesEnabled: boolean("team_invites_enabled").notNull().default(true),
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
export type PasswordResetChallengeRow = typeof passwordResetChallenges.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
export type PlayerProfileRow = typeof playerProfiles.$inferSelect;
export type TeamRow = typeof teams.$inferSelect;
export type TeamMembershipRow = typeof teamMemberships.$inferSelect;
export type TeamInvitationRow = typeof teamInvitations.$inferSelect;

export type CompetitionRow = typeof competitions.$inferSelect;
export type CompetitionGroupRow = typeof competitionGroups.$inferSelect;
export type CompetitionTeamRow = typeof competitionTeams.$inferSelect;
export type CompetitionMatchRow = typeof competitionMatches.$inferSelect;
export type PlayerMatchStatRow = typeof playerMatchStats.$inferSelect;
