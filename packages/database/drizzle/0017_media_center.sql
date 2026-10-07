CREATE TYPE "venue_post_type" AS ENUM ('GENERAL','ANNOUNCEMENT','PROMOTION','COMPETITION','RESULT');
--> statement-breakpoint
CREATE TYPE "venue_post_visibility" AS ENUM ('PUBLIC','FOLLOWERS','PRIVATE');
--> statement-breakpoint
CREATE TYPE "venue_post_scheduled_action" AS ENUM ('PUBLISH','UNPUBLISH','MAKE_PUBLIC','MAKE_FOLLOWERS','MAKE_PRIVATE','DELETE');
--> statement-breakpoint
ALTER TABLE "venue_posts" ADD COLUMN "post_type" "venue_post_type" NOT NULL DEFAULT 'GENERAL';
--> statement-breakpoint
ALTER TABLE "venue_posts" ADD COLUMN "visibility" "venue_post_visibility" NOT NULL DEFAULT 'PUBLIC';
--> statement-breakpoint
ALTER TABLE "venue_posts" ADD COLUMN "notify_followers" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "post_type" "venue_post_type" NOT NULL DEFAULT 'GENERAL';
--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "visibility" "venue_post_visibility" NOT NULL DEFAULT 'PUBLIC';
--> statement-breakpoint
CREATE TABLE "venue_post_scheduled_actions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "post_id" uuid NOT NULL REFERENCES "venue_posts"("id") ON DELETE cascade,
  "action" "venue_post_scheduled_action" NOT NULL,
  "execute_at" timestamp with time zone NOT NULL,
  "executed_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "venue_post_scheduled_actions_pending_idx"
ON "venue_post_scheduled_actions" USING btree ("execute_at","post_id")
WHERE "executed_at" IS NULL AND "cancelled_at" IS NULL;
--> statement-breakpoint
CREATE INDEX "venue_post_scheduled_actions_post_idx" ON "venue_post_scheduled_actions" USING btree ("post_id");
--> statement-breakpoint
CREATE INDEX "venue_posts_visibility_status_idx" ON "venue_posts" USING btree ("visibility","status","published_at");
