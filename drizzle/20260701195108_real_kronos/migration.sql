CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"action" text NOT NULL,
	"user" text,
	"details" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "description" text NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "playableUrl" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "codeUrl" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "hca_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "hackatime_token" text;--> statement-breakpoint
CREATE INDEX "audit_log_createdAt_index" ON "audit_log" ("createdAt");--> statement-breakpoint
CREATE INDEX "projects_userId_index" ON "projects" ("userId");