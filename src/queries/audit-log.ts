import { db } from '../db'
import { auditLog } from '../db/schema'

export async function createAuditLog(data: typeof auditLog.$inferInsert) {
	return await db.insert(auditLog).values(data).returning()
}
