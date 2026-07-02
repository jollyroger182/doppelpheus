import { eq, isNotNull } from 'drizzle-orm'
import { db } from '../db'
import { projects, shopItems, users } from '../db/schema'

export async function getProgramStats() {
	const [totalUsers, hcaLinked, hackatimeLinked, projectCount, enabledShopItems] =
		await Promise.all([
			db.$count(users),
			db.$count(users, isNotNull(users.hcaToken)),
			db.$count(users, isNotNull(users.hackatimeToken)),
			db.$count(projects),
			db.$count(shopItems, eq(shopItems.enabled, true)),
		])
	return { totalUsers, hcaLinked, hackatimeLinked, projectCount, enabledShopItems }
}
