CREATE TYPE "review_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "project_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"projectId" integer NOT NULL,
	"status" "review_status" NOT NULL,
	"reviewerId" text,
	"comment" text,
	"channelId" text,
	"messageTs" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"decidedAt" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "hackatimeProjects" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
CREATE INDEX "project_reviews_projectId_index" ON "project_reviews" ("projectId");--> statement-breakpoint
CREATE INDEX "project_reviews_status_index" ON "project_reviews" ("status");--> statement-breakpoint
ALTER TABLE "project_reviews" ADD CONSTRAINT "project_reviews_projectId_projects_id_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE;