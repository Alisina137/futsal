-- WhatsApp invite links are team-private; member-only access is enforced at API read time.
ALTER TABLE "team_manager_profiles" ADD COLUMN "whatsapp_group_url" varchar(400);
