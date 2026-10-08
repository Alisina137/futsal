CREATE TABLE "account_profile_images" (
  "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "public_token" varchar(64) NOT NULL,
  "mime_type" varchar(40) NOT NULL,
  "byte_size" integer NOT NULL,
  "data_base64" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "account_profile_images_public_token_uq" UNIQUE("public_token")
);
