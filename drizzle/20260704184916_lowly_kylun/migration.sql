ALTER TABLE "project_reviews" ADD COLUMN "hackatimeSeconds_new" integer NOT NULL DEFAULT 0;--> statement-breakpoint
UPDATE "project_reviews" pr
SET "hackatimeSeconds_new" = COALESCE(sub.total, 0)
FROM (
	SELECT pr2.id, SUM((value)::bigint)::integer AS total
	FROM "project_reviews" pr2, jsonb_each_text(pr2."hackatimeSeconds")
	GROUP BY pr2.id
) sub
WHERE pr.id = sub.id;--> statement-breakpoint
ALTER TABLE "project_reviews" DROP COLUMN "hackatimeSeconds";--> statement-breakpoint
ALTER TABLE "project_reviews" RENAME COLUMN "hackatimeSeconds_new" TO "hackatimeSeconds";
