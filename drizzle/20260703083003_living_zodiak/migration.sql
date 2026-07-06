ALTER TABLE "project_reviews" ALTER COLUMN "hackatimeSeconds" SET DEFAULT '{}';--> statement-breakpoint
UPDATE "project_reviews" SET "hackatimeSeconds" = '{}'::jsonb WHERE "hackatimeSeconds" IS NULL;--> statement-breakpoint
ALTER TABLE "project_reviews" ALTER COLUMN "hackatimeSeconds" SET NOT NULL;
