import { desc, eq, sql } from 'drizzle-orm'
import { db } from '../db'
import { purchases } from '../db/schema'

export type Purchase = typeof purchases.$inferSelect
export type PurchaseStatus = Purchase['status']
export type PurchaseWithUser = Awaited<ReturnType<typeof getPendingPurchasesForShopItem>>[number]

export async function createPurchase(data: typeof purchases.$inferInsert) {
	const [row] = await db.insert(purchases).values(data).returning()
	return row!
}

export async function getPurchaseById(id: string) {
	return db.query.purchases.findFirst({ where: { id } })
}

export async function getPurchasesByUser(userId: string) {
	return db
		.select()
		.from(purchases)
		.where(eq(purchases.userId, userId))
		.orderBy(desc(purchases.createdAt))
}

export async function getPendingPurchaseCountsByShopItem() {
	return db
		.select({ shopItemId: purchases.shopItemId, count: sql<number>`count(*)::int` })
		.from(purchases)
		.where(eq(purchases.status, 'pending'))
		.groupBy(purchases.shopItemId)
}

export async function getPendingPurchasesForShopItem(shopItemId: string) {
	return db.query.purchases.findMany({
		where: { shopItemId, status: 'pending' },
		with: { user: true },
		orderBy: { createdAt: 'desc' },
	})
}

export async function setPurchaseStatus(id: string, status: PurchaseStatus) {
	const [row] = await db
		.update(purchases)
		.set({ status })
		.where(eq(purchases.id, id))
		.returning()
	return row
}

export async function attachPurchaseMessage(id: string, channelId: string, messageTs: string) {
	const [row] = await db
		.update(purchases)
		.set({ channelId, messageTs })
		.where(eq(purchases.id, id))
		.returning()
	return row
}
