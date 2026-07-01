import { db } from '../db'
import { users } from '../db/schema'

export async function createUser(id: string) {
	const [user] = await db.insert(users).values({ id }).onConflictDoNothing().returning()
	return user
}

export async function getUserWithProjectsById(id: string) {
	return db.query.users.findFirst({ where: { id }, with: { projects: true } })
}

export async function upsertUser(data: typeof users.$inferInsert) {
	const [user] = await db
		.insert(users)
		.values(data)
		.onConflictDoUpdate({ target: users.id, set: { ...data, id: undefined } })
		.returning()
	return user!
}
