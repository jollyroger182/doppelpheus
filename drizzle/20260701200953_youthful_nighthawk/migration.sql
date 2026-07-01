ALTER TABLE "users" RENAME COLUMN "hca_token" TO "hcaToken";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "hackatime_token" TO "hackatimeToken";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "authState" text;