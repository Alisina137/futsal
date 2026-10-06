DO $$ BEGIN
  CREATE TYPE "social_entity_type" AS ENUM ('VENUE', 'TEAM', 'COMPETITION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "social_follows" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "entity_type" "social_entity_type" NOT NULL,
  "entity_id" uuid NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "social_follows_pk" PRIMARY KEY ("user_id","entity_type","entity_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_follows_entity_idx" ON "social_follows" ("entity_type","entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_follows_user_idx" ON "social_follows" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "social_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_type" "social_entity_type" NOT NULL,
  "entity_id" uuid NOT NULL,
  "created_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "legacy_venue_post_id" uuid REFERENCES "venue_posts"("id") ON DELETE cascade,
  "body" text NOT NULL,
  "image_url" text,
  "status" "post_status" NOT NULL DEFAULT 'PUBLISHED',
  "published_at" timestamp with time zone NOT NULL DEFAULT now(),
  "unpublished_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "social_posts_legacy_venue_post_uq" ON "social_posts" ("legacy_venue_post_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_posts_entity_status_idx" ON "social_posts" ("entity_type","entity_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_posts_published_at_idx" ON "social_posts" ("published_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "social_post_likes" (
  "post_id" uuid NOT NULL REFERENCES "social_posts"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "social_post_likes_pk" PRIMARY KEY ("post_id","user_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_post_likes_user_idx" ON "social_post_likes" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "social_post_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "post_id" uuid NOT NULL REFERENCES "social_posts"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "body" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_post_comments_post_created_idx" ON "social_post_comments" ("post_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_post_comments_user_idx" ON "social_post_comments" ("user_id");
--> statement-breakpoint
INSERT INTO "social_follows" ("user_id","entity_type","entity_id","created_at")
SELECT "user_id",'VENUE'::"social_entity_type","venue_id","created_at"
FROM "venue_follows"
ON CONFLICT ("user_id","entity_type","entity_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "social_posts" (
  "entity_type","entity_id","created_by_user_id","legacy_venue_post_id",
  "body","image_url","status","published_at","unpublished_at","created_at","updated_at"
)
SELECT
  'VENUE'::"social_entity_type","venue_id","created_by_user_id","id",
  "body","image_url","status","published_at","unpublished_at","created_at","updated_at"
FROM "venue_posts"
ON CONFLICT ("legacy_venue_post_id") DO NOTHING;
