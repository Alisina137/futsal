ALTER TABLE "social_post_comments"
ADD COLUMN IF NOT EXISTS "edited_at" timestamp with time zone;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "social_post_comment_likes" (
  "comment_id" uuid NOT NULL REFERENCES "social_post_comments"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "social_post_comment_likes_pk" PRIMARY KEY ("comment_id","user_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_post_comment_likes_user_idx"
  ON "social_post_comment_likes" ("user_id");
