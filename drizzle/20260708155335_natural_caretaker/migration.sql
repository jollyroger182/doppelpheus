CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"userId" text NOT NULL,
	"shopItemId" uuid NOT NULL,
	"priceMinutes" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "balanceMinutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "purchases_userId_index" ON "purchases" ("userId");--> statement-breakpoint
CREATE INDEX "purchases_shopItemId_index" ON "purchases" ("shopItemId");--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_userId_users_id_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_shopItemId_shop_items_id_fkey" FOREIGN KEY ("shopItemId") REFERENCES "shop_items"("id");