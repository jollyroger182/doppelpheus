import { db } from '../db'

export async function getEnabledShopItems() {
	return db.query.shopItems.findMany({ where: { enabled: true } })
}

export async function getAllShopItems() {
	return db.query.shopItems.findMany()
}
