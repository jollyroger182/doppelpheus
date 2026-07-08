CREATE TYPE "purchase_status" AS ENUM('pending', 'refunded', 'fulfilled');--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "status" "purchase_status" DEFAULT 'pending'::"purchase_status" NOT NULL;--> statement-breakpoint
CREATE INDEX "purchases_status_index" ON "purchases" ("status");