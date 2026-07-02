import { db } from '../db'
import { auditLog } from '../db/schema'

export async function createAuditLog(data: typeof auditLog.$inferInsert) {
	return await db.insert(auditLog).values(data).returning()
}

export function logAudit(action: string, user?: string | null, details?: unknown) {
	const detailsStr =
		details === undefined || details === null
			? undefined
			: typeof details === 'string'
				? details
				: JSON.stringify(details)
	db.insert(auditLog)
		.values({ action, user: user ?? null, details: detailsStr })
		.catch((err) => console.error('audit log failed', action, err))
}
