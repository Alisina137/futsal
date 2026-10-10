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
export const venuePostTypeEnum = pgEnum("venue_post_type", ["GENERAL", "ANNOUNCEMENT", "PROMOTION", "COMPETITION", "RESULT"]);
export const venuePostVisibilityEnum = pgEnum("venue_post_visibility", ["PUBLIC", "FOLLOWERS", "PRIVATE"]);
export const venuePostScheduledActionEnum = pgEnum("venue_post_scheduled_action", ["PUBLISH", "UNPUBLISH", "MAKE_PUBLIC", "MAKE_FOLLOWERS", "MAKE_PRIVATE", "DELETE"]);
export const socialEntityTypeEnum = pgEnum("social_entity_type", ["VENUE", "TEAM", "COMPETITION", "USER"]);
export const notificationTypeEnum = pgEnum("notification_type", ["BOOKING_CONFIRMED", "BOOKING_CANCELLED", "SLOT_PROMOTION", "VENUE_POST", "TEAM_INVITATION", "COMPETITION_UPDATE", "TEAM_ACTIVITY", "TEAM_CHALLENGE", "TEAM_ANNOUNCEMENT"]);
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
    defaultLatitude:doublePrecision("default_latitude"),
    defaultLongitude:doublePrecision("default_longitude"),
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

export const accountProfileImages = pgTable(
  "account_profile_images",
  {
    userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
    publicToken: varchar("public_token", { length: 64 }).notNull().unique(),
    mimeType: varchar("mime_type", { length: 40 }).notNull(),
    byteSize: integer("byte_size").notNull(),
    dataBase64: text("data_base64").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
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
    onlineBookingEnabled: boolean("online_booking_enabled").notNull().default(true),
    minimumBookingNoticeMinutes: integer("minimum_booking_notice_minutes").notNull().default(0),
    maximumAdvanceBookingDays: integer("maximum_advance_booking_days").notNull().default(30),
    cancellationPolicy: text("cancellation_policy").notNull().default("Cancellation is allowed before the booking start time."),
    pageProfileImageUrl: text("page_profile_image_url"),
    pageCoverImageUrl: text("page_cover_image_url"),
    pageBio: varchar("page_bio", { length: 500 }),
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

export const venueMediaAssets = pgTable(
  "venue_media_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    venueId: uuid("venue_id").notNull().references(() => venues.id, { onDelete: "cascade" }),
    ownerUserId: uuid("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    publicToken: varchar("public_token", { length: 64 }).notNull().unique(),
    purpose: varchar("purpose", { length: 20 }).notNull(),
    mimeType: varchar("mime_type", { length: 40 }).notNull(),
    byteSize: integer("byte_size").notNull(),
    dataBase64: text("data_base64").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("venue_media_assets_venue_idx").on(table.venueId, table.createdAt),
    index("venue_media_assets_owner_idx").on(table.ownerUserId, table.createdAt),
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
    uniqueIndex("venue_areas_one_active_per_venue_uq")
      .on(table.venueId)
      .where(sql`${table.active} = true`),
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
    priceAfn: integer("price_afn").notNull(),
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
    periods: jsonb("periods").$type<Array<{ startsAt: string; endsAt: string; priceAfn?: number | null }>>().notNull().default([]),
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
    postType: venuePostTypeEnum("post_type").notNull().default("GENERAL"),
    visibility: venuePostVisibilityEnum("visibility").notNull().default("PUBLIC"),
    notifyFollowers: boolean("notify_followers").notNull().default(false),
    status: postStatusEnum("status").notNull().default("PUBLISHED"),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    unpublishedAt: timestamp("unpublished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("venue_posts_venue_status_idx").on(table.venueId, table.status),
    index("venue_posts_published_at_idx").on(table.publishedAt),
    index("venue_posts_visibility_status_idx").on(table.visibility, table.status, table.publishedAt),
  ],
);

export const venuePostScheduledActions = pgTable(
  "venue_post_scheduled_actions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id").notNull().references(() => venuePosts.id, { onDelete: "cascade" }),
    action: venuePostScheduledActionEnum("action").notNull(),
    executeAt: timestamp("execute_at", { withTimezone: true }).notNull(),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("venue_post_scheduled_actions_pending_idx").on(table.executeAt, table.postId),
    index("venue_post_scheduled_actions_post_idx").on(table.postId),
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
    postType: venuePostTypeEnum("post_type").notNull().default("GENERAL"),
    visibility: venuePostVisibilityEnum("visibility").notNull().default("PUBLIC"),
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

export const socialUserPostImages = pgTable(
  "social_user_post_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    publicToken: varchar("public_token", { length: 64 }).notNull().unique(),
    mimeType: varchar("mime_type", { length: 40 }).notNull(),
    byteSize: integer("byte_size").notNull(),
    dataBase64: text("data_base64").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("social_user_post_images_owner_idx").on(table.ownerUserId)],
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
    offlineVenueId: uuid("offline_venue_id").references(() => venues.id, { onDelete: "restrict" }),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    captainUserId: uuid("captain_user_id").references(() => users.id, { onDelete: "set null" }),
    status: teamStatusEnum("status").notNull().default("ACTIVE"),
    privacy: teamPrivacyEnum("privacy").notNull().default("PUBLIC"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("teams_manager_idx").on(table.managerUserId),
    index("teams_offline_venue_idx").on(table.offlineVenueId, table.claimedAt),
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
    rewards:jsonb("rewards").$type<Array<{category:"TEAM"|"INDIVIDUAL";title:string;prize:string;description:string|null}>>().notNull().default([]),
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

/** Assignment responses are tied to a specific referee and match.
 * Reassigning a match never grants access to its previous official's report. */
export const refereeMatchResponses=pgTable("referee_match_responses",{
  matchId:uuid("match_id").notNull().references(()=>competitionMatches.id,{onDelete:"cascade"}),
  refereeUserId:uuid("referee_user_id").notNull().references(()=>users.id,{onDelete:"cascade"}),
  status:varchar("status",{length:24}).notNull().default("PENDING"),
  reason:varchar("reason",{length:400}),
  respondedAt:timestamp("responded_at",{withTimezone:true}),
  updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
},table=>[
  primaryKey({columns:[table.matchId,table.refereeUserId]}),
  index("referee_responses_user_idx").on(table.refereeUserId,table.status),
]);

export const refereeProfiles=pgTable("referee_profiles",{
  userId:uuid("user_id").primaryKey().references(()=>users.id,{onDelete:"cascade"}),
  level:varchar("level",{length:60}),
  experienceYears:integer("experience_years").notNull().default(0),
  biography:varchar("biography",{length:500}),
  weeklyAvailability:jsonb("weekly_availability").$type<{day:number;start:string;end:string}[]>().notNull().default([]),
  exceptions:jsonb("exceptions").$type<{date:string;available:boolean}[]>().notNull().default([]),
  updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
});

export const refereeMatchReports=pgTable("referee_match_reports",{
  matchId:uuid("match_id").primaryKey().references(()=>competitionMatches.id,{onDelete:"cascade"}),
  refereeUserId:uuid("referee_user_id").notNull().references(()=>users.id,{onDelete:"restrict"}),
  status:varchar("status",{length:24}).notNull().default("DRAFT"),
  events:jsonb("events").$type<Array<{id:string;kind:string;side:string|null;playerUserId:string|null;elapsedSeconds:number;period:number;details:string}>>().notNull().default([]),
  checks:jsonb("checks").$type<{homePresent:boolean;awayPresent:boolean;rosterChecked:boolean;venueReady:boolean}>().notNull().default({homePresent:false,awayPresent:false,rosterChecked:false,venueReady:false}),
  startedAt:timestamp("started_at",{withTimezone:true}),
  finishedAt:timestamp("finished_at",{withTimezone:true}),
  summary:varchar("summary",{length:2000}).notNull().default(""),
  revision:integer("revision").notNull().default(0),
  submittedAt:timestamp("submitted_at",{withTimezone:true}),
  reviewedAt:timestamp("reviewed_at",{withTimezone:true}),
  reviewedByUserId:uuid("reviewed_by_user_id").references(()=>users.id,{onDelete:"set null"}),
  feedback:varchar("feedback",{length:800}),
  updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
},table=>[
  index("referee_reports_referee_idx").on(table.refereeUserId,table.status),
]);

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


/** Phase 1: extended team identity and membership preferences. */
export const teamManagerProfiles = pgTable("team_manager_profiles",{
  teamId:uuid("team_id").primaryKey().references(()=>teams.id,{onDelete:"cascade"}),
  province:varchar("province",{length:80}),
  district:varchar("district",{length:80}),
  description:text("description"),
  foundedOn:varchar("founded_on",{length:10}),
  primaryColor:varchar("primary_color",{length:7}),
  secondaryColor:varchar("secondary_color",{length:7}),
  contactPhone:varchar("contact_phone",{length:24}),
  homeVenueId:uuid("home_venue_id").references(()=>venues.id,{onDelete:"set null"}),
  allowJoinRequests:boolean("allow_join_requests").notNull().default(true),
  whatsappGroupUrl:varchar("whatsapp_group_url",{length:400}),
  updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
});

export const teamGuestPlayers = pgTable("team_guest_players",{
  id:uuid("id").defaultRandom().primaryKey(),
  teamId:uuid("team_id").notNull().references(()=>teams.id,{onDelete:"cascade"}),
  name:varchar("name",{length:100}).notNull(),
  position:playerPositionEnum("position").notNull().default("UNSPECIFIED"),
  shirtNumber:integer("shirt_number"),
  createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
},table=>[index("team_guest_players_team_idx").on(table.teamId)]);


/** Phase 2: per-competition player eligibility, manager-owned lineup and team calendar. */
export const teamCompetitionRoster = pgTable("team_competition_roster",{
  competitionId:uuid("competition_id").notNull(),
  teamId:uuid("team_id").notNull(),
  userId:uuid("user_id").notNull().references(()=>users.id,{onDelete:"cascade"}),
  addedAt:timestamp("added_at",{withTimezone:true}).notNull().defaultNow(),
},table=>[
  primaryKey({columns:[table.competitionId,table.teamId,table.userId]}),
  index("team_competition_roster_team_idx").on(table.teamId,table.competitionId),
]);

export const teamMatchLineups = pgTable("team_match_lineups",{
  matchId:uuid("match_id").notNull().references(()=>competitionMatches.id,{onDelete:"cascade"}),
  teamId:uuid("team_id").notNull().references(()=>teams.id,{onDelete:"cascade"}),
  starters:jsonb("starters").$type<string[]>().notNull().default([]),
  substitutes:jsonb("substitutes").$type<string[]>().notNull().default([]),
  captainUserId:uuid("captain_user_id").references(()=>users.id,{onDelete:"set null"}),
  updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
},table=>[primaryKey({columns:[table.matchId,table.teamId]})]);

export const teamActivities = pgTable("team_activities",{
  id:uuid("id").defaultRandom().primaryKey(),
  teamId:uuid("team_id").notNull().references(()=>teams.id,{onDelete:"cascade"}),
  kind:varchar("kind",{length:16}).notNull(),
  title:varchar("title",{length:120}).notNull(),
  notes:text("notes"),
  location:varchar("location",{length:200}),
  startsAt:timestamp("starts_at",{withTimezone:true}).notNull(),
  endsAt:timestamp("ends_at",{withTimezone:true}).notNull(),
  createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
  updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
},table=>[index("team_activities_team_start_idx").on(table.teamId,table.startsAt)]);

export const teamActivityResponses = pgTable("team_activity_responses",{
  activityId:uuid("activity_id").notNull().references(()=>teamActivities.id,{onDelete:"cascade"}),
  userId:uuid("user_id").notNull().references(()=>users.id,{onDelete:"cascade"}),
  availability:varchar("availability",{length:12}).notNull(),
  updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
},table=>[primaryKey({columns:[table.activityId,table.userId]})]);


export const teamFriendlyChallenges=pgTable("team_friendly_challenges",{
  id:uuid("id").defaultRandom().primaryKey(),
  fromTeamId:uuid("from_team_id").notNull().references(()=>teams.id,{onDelete:"cascade"}),
  toTeamId:uuid("to_team_id").notNull().references(()=>teams.id,{onDelete:"cascade"}),
  proposedAt:timestamp("proposed_at",{withTimezone:true}).notNull(),
  venueName:varchar("venue_name",{length:160}),
  message:varchar("message",{length:500}),
  status:varchar("status",{length:12}).notNull().default("PENDING"),
  respondedAt:timestamp("responded_at",{withTimezone:true}),
  createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
},table=>[index("team_friendly_from_idx").on(table.fromTeamId,table.createdAt),
  index("team_friendly_to_idx").on(table.toTeamId,table.createdAt),
  uniqueIndex("team_friendly_pending_unique").on(table.fromTeamId,table.toTeamId).where(sql`${table.status}='PENDING'`) ]);

export const teamAnnouncements=pgTable("team_announcements",{
  id:uuid("id").defaultRandom().primaryKey(),
  teamId:uuid("team_id").notNull().references(()=>teams.id,{onDelete:"cascade"}),
  authorId:uuid("author_id").notNull().references(()=>users.id,{onDelete:"restrict"}),
  title:varchar("title",{length:120}).notNull(),
  body:text("body").notNull(),
  createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
  updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
},table=>[index("team_announcements_team_date_idx").on(table.teamId,table.createdAt)]);

export const playerDashboardPreferences=pgTable("player_dashboard_preferences",{
  userId:uuid("user_id").primaryKey().references(()=>users.id,{onDelete:"cascade"}),
  defaultTeamId:uuid("default_team_id").references(()=>teams.id,{onDelete:"set null"}),
  biography:varchar("biography",{length:500}),
  province:varchar("province",{length:80}),
  district:varchar("district",{length:80}),
  secondaryPosition:playerPositionEnum("secondary_position"),
  preferredFoot:varchar("preferred_foot",{length:8}),
  updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
},table=>[index("player_dashboard_default_team_idx").on(table.defaultTeamId)]);

/** Paid extra Team Manager subscriptions: the first owned team uses the paid role;
 * every additional managed team consumes one independently renewable extra slot.
 * A slot without a teamId is a paid, one-time provisioning entitlement.
 */
export const teamExtraSubscriptions=pgTable("team_extra_subscriptions",{
  id:uuid("id").defaultRandom().primaryKey(),
  userId:uuid("user_id").notNull().references(()=>users.id,{onDelete:"cascade"}),
  teamId:uuid("team_id").unique().references(()=>teams.id,{onDelete:"set null"}),
  status:paidRoleSubscriptionStatusEnum("status").notNull().default("PENDING"),
  monthlyPriceAfn:integer("monthly_price_afn").notNull().default(300),
  requestedAt:timestamp("requested_at",{withTimezone:true}).notNull().defaultNow(),
  activeUntil:timestamp("active_until",{withTimezone:true}),
  activatedAt:timestamp("activated_at",{withTimezone:true}),
  activatedByUserId:uuid("activated_by_user_id").references(()=>users.id,{onDelete:"set null"}),
  paymentReference:varchar("payment_reference",{length:120}),
  updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow(),
},table=>[
  index("team_extra_subscriptions_user_idx").on(table.userId,table.status),
  index("team_extra_subscriptions_status_idx").on(table.status,table.requestedAt),
]);
