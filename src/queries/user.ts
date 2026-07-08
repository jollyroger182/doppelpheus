import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '../db'
import { authAttempts, projectReviews, projects, users } from '../db/schema'

export type User = typeof users.$inferSelect

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

export async function getAllUsers() {
	return db.select().from(users)
}

export async function getUserSignupAt(userId: string): Promise<Date> {
	const [row] = await db
		.select({ createdAt: authAttempts.createdAt })
		.from(authAttempts)
		.where(eq(authAttempts.userId, userId))
		.orderBy(asc(authAttempts.createdAt))
		.limit(1)
	return row?.createdAt ?? new Date()
}

export async function getUserLastShipAt(userId: string): Promise<Date | null> {
	const [row] = await db
		.select({ decidedAt: projectReviews.decidedAt })
		.from(projectReviews)
		.innerJoin(projects, eq(projects.id, projectReviews.projectId))
		.where(and(eq(projects.userId, userId), eq(projectReviews.status, 'approved')))
		.orderBy(desc(projectReviews.decidedAt))
		.limit(1)
	return row?.decidedAt ?? null
}
