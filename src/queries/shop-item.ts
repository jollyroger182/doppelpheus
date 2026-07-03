import { eq } from 'drizzle-orm'
import { db } from '../db'
import { shopItems } from '../db/schema'

export type ShopItem = typeof shopItems.$inferSelect

export async function getEnabledShopItems() {
	return db.query.shopItems.findMany({
		where: { enabled: true },
		orderBy: { priceMinutes: 'asc', name: 'asc' },
	})
}

export async function getAllShopItems() {
	return db.query.shopItems.findMany({ orderBy: { priceMinutes: 'asc', name: 'asc' } })
}

export async function getShopItemById(id: string) {
	return db.query.shopItems.findFirst({ where: { id } })
}

export async function createShopItem(data: typeof shopItems.$inferInsert) {
	const [row] = await db.insert(shopItems).values(data).returning()
	return row!
}

export async function updateShopItem(id: string, data: Partial<typeof shopItems.$inferInsert>) {
	const [row] = await db.update(shopItems).set(data).where(eq(shopItems.id, id)).returning()
	return row
}

export async function deleteShopItem(id: string) {
	const [row] = await db.delete(shopItems).where(eq(shopItems.id, id)).returning()
	return row
}

export async function setShopItemEnabled(id: string, enabled: boolean) {
	const [row] = await db
		.update(shopItems)
		.set({ enabled })
		.where(eq(shopItems.id, id))
		.returning()
	return row
}
