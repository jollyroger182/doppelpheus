import { eq } from 'drizzle-orm'
import { db } from '../db'
import { authAttempts } from '../db/schema'

export async function getAuthAttemptWithUserById(id: string) {
	return db.query.authAttempts.findFirst({ where: { id }, with: { user: true } })
}

export async function createAuthAttempt(userId: string) {
	const [attempt] = await db.insert(authAttempts).values({ userId }).returning()
	return attempt!
}

export async function markAuthAttemptUsed(id: string) {
	await db.update(authAttempts).set({ used: true }).where(eq(authAttempts.id, id))
}
