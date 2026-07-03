import { eq } from 'drizzle-orm'
import { db } from '../db'
import { projects } from '../db/schema'

export type Project = typeof projects.$inferSelect

export async function getProjectsByUserId(userId: string) {
	return db.query.projects.findMany({ where: { userId } })
}

export async function getProjectById(id: number) {
	return db.query.projects.findFirst({ where: { id } })
}

export async function createProject(data: typeof projects.$inferInsert) {
	const [row] = await db.insert(projects).values(data).returning()
	return row!
}

export async function updateProject(id: number, data: Partial<typeof projects.$inferInsert>) {
	const [row] = await db.update(projects).set(data).where(eq(projects.id, id)).returning()
	return row
}

export async function deleteProject(id: number) {
	const [row] = await db.delete(projects).where(eq(projects.id, id)).returning()
	return row
}

export function isProjectShippable(project: Project): boolean {
	return !!(
		project.name &&
		project.description &&
		project.playableUrl &&
		project.codeUrl &&
		project.screenshotFileId &&
		project.hackatimeProjects.length > 0
	)
}

export function missingShippableFields(project: Project): string[] {
	const missing: string[] = []
	if (!project.playableUrl) missing.push('demo url')
	if (!project.codeUrl) missing.push('code url')
	if (!project.screenshotFileId) missing.push('screenshot')
	if (project.hackatimeProjects.length === 0) missing.push('hackatime projects')
	return missing
}
