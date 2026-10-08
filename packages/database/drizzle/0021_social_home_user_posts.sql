-- Personal social posts are stored in the existing social_posts/reactions tables.
-- The USER entity is the public account itself, never a venue administration role.
ALTER TYPE "social_entity_type" ADD VALUE IF NOT EXISTS 'USER';

CREATE TABLE "social_user_post_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "public_token" varchar(64) NOT NULL UNIQUE,
  "mime_type" varchar(40) NOT NULL,
  "byte_size" integer NOT NULL,
  "data_base64" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "social_user_post_images_owner_idx" ON "social_user_post_images" ("owner_user_id");
