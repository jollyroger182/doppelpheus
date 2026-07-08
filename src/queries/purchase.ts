import { desc, eq } from 'drizzle-orm'
import { db } from '../db'
import { purchases } from '../db/schema'

export type Purchase = typeof purchases.$inferSelect

export async function createPurchase(data: typeof purchases.$inferInsert) {
	const [row] = await db.insert(purchases).values(data).returning()
	return row!
}

export async function getPurchasesByUser(userId: string) {
	return db
		.select()
		.from(purchases)
		.where(eq(purchases.userId, userId))
		.orderBy(desc(purchases.createdAt))
}
