ALTER TABLE "purchases" ADD COLUMN "channelId" text;--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "messageTs" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "selectedHcaAddressId" text;