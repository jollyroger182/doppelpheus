import { eq } from 'drizzle-orm'
import { db } from '../db'
import { users } from '../db/schema'

export async function getUserWithProjectsById(id: string) {
	return db.query.users.findFirst({ where: { id }, with: { projects: true } })
}

export async function getUserByAuthState(authState: string) {
	return db.query.users.findFirst({ where: { authState } })
}

export async function upsertUser(data: typeof users.$inferInsert) {
	const [user] = await db
		.insert(users)
		.values(data)
		.onConflictDoUpdate({ target: users.id, set: { ...data, id: undefined } })
		.returning()
	return user!
}
