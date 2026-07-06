import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '../db'
import { projectReviews, reviewStatus } from '../db/schema'

export type ProjectReview = typeof projectReviews.$inferSelect
export type ReviewStatus = (typeof reviewStatus.enumValues)[number]

export async function createReview(projectId: number, hackatimeSeconds: number) {
	const [row] = await db
		.insert(projectReviews)
		.values({ projectId, status: 'pending', hackatimeSeconds })
		.returning()
	return row!
}

export async function getReviewById(id: string) {
	return db.query.projectReviews.findFirst({ where: { id } })
}

export async function getLatestReviewForProject(projectId: number) {
	const rows = await db
		.select()
		.from(projectReviews)
		.where(eq(projectReviews.projectId, projectId))
		.orderBy(desc(projectReviews.createdAt))
		.limit(1)
	return rows[0]
}

export async function getLatestApprovedReviewForProject(projectId: number) {
	const rows = await db
		.select()
		.from(projectReviews)
		.where(and(eq(projectReviews.projectId, projectId), eq(projectReviews.status, 'approved')))
		.orderBy(desc(projectReviews.createdAt))
		.limit(1)
	return rows[0]
}

export async function getReviewsForProjects(projectIds: number[]) {
	const map = new Map<number, ProjectReview[]>()
	if (!projectIds.length) return map
	const rows = await db
		.select()
		.from(projectReviews)
		.where(inArray(projectReviews.projectId, projectIds))
		.orderBy(desc(projectReviews.createdAt))
	for (const row of rows) {
		const list = map.get(row.projectId) ?? []
		list.push(row)
		map.set(row.projectId, list)
	}
	return map
}

export async function attachReviewMessage(id: string, channelId: string, messageTs: string) {
	await db
		.update(projectReviews)
		.set({ channelId, messageTs })
		.where(eq(projectReviews.id, id))
}

export async function decideReview(
	id: string,
	decision: {
		status: Exclude<ReviewStatus, 'pending'>
		reviewerId: string
		comment: string | null
		justification: string | null
		hoursAdjustment: number | null
	},
) {
	const [row] = await db
		.update(projectReviews)
		.set({
			status: decision.status,
			reviewerId: decision.reviewerId,
			comment: decision.comment,
			justification: decision.justification,
			hoursAdjustment: decision.hoursAdjustment,
			decidedAt: new Date(),
		})
		.where(and(eq(projectReviews.id, id), eq(projectReviews.status, 'pending')))
		.returning()
	return row
}

export interface ProjectReviewState {
	latest: ProjectReview | null
	underReview: boolean
	shipped: boolean
	lastRejectionComment: string | null
}

export function computeReviewState(reviews: ProjectReview[]): ProjectReviewState {
	// reviews expected in desc createdAt order
	const latest = reviews[0] ?? null
	const shipped = reviews.some((r) => r.status === 'approved')
	const lastRejection = reviews.find((r) => r.status === 'rejected')
	return {
		latest,
		underReview: latest?.status === 'pending',
		shipped,
		lastRejectionComment:
			latest?.status === 'rejected' ? (lastRejection?.comment ?? null) : null,
	}
}
