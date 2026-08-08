ALTER TYPE "public"."alert_channel" ADD VALUE 'WHATSAPP';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "whatsapp_phone" varchar(24);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ghl_contact_id" varchar(80);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "whatsapp_notifications_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "users_ghl_contact_idx" ON "users" USING btree ("ghl_contact_id");