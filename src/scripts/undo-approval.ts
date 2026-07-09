import { eq } from 'drizzle-orm'
import { db } from '../db'
import { projectReviews } from '../db/schema'
import { logAudit } from '../queries/audit-log'
import { getProjectWithUserById } from '../queries/project'
import { getReviewById } from '../queries/project-review'
import { adjustUserBalance } from '../queries/user'
import { bot } from '../slack/client'
import { buildReviewMessage } from '../slack/review'

async function main() {
	const reviewId = process.argv[2]
	if (!reviewId) {
		console.error('usage: bun run undo:approval <reviewId>')
		process.exit(1)
	}

	const review = await getReviewById(reviewId)
	if (!review) throw new Error(`review ${reviewId} not found`)
	if (review.status !== 'approved')
		throw new Error(`review ${reviewId} is ${review.status}, not approved`)

	const project = await getProjectWithUserById(review.projectId)
	if (!project) throw new Error(`project ${review.projectId} not found`)

	const adjustmentSeconds = Math.round((review.hoursAdjustment ?? 0) * 3600)
	const creditMinutes = Math.max(0, Math.round((review.hackatimeSeconds + adjustmentSeconds) / 60))

	if (creditMinutes > 0) {
		const newBalance = await adjustUserBalance(project.userId, -creditMinutes)
		console.log(`debited ${creditMinutes}m from ${project.userId}, new balance=${newBalance}m`)
	} else {
		console.log('no credit to reverse')
	}

	const [reverted] = await db
		.update(projectReviews)
		.set({
			status: 'pending',
			reviewerId: null,
			comment: null,
			justification: null,
			hoursAdjustment: null,
			decidedAt: null,
		})
		.where(eq(projectReviews.id, reviewId))
		.returning()

	if (reverted && review.channelId && review.messageTs) {
		try {
			await bot
				.channel(review.channelId)
				.message(review.messageTs)
				.edit(buildReviewMessage(project, reverted))
			console.log(`restored slack message ${review.channelId}/${review.messageTs}`)
		} catch (err) {
			console.error('failed to edit slack message', err)
		}
	}

	logAudit('project.approval.undone', 'USLACKBOT', {
		reviewId,
		projectId: project.id,
		userId: project.userId,
		debitedMinutes: creditMinutes,
	})

	console.log(`✓ undone approval for review ${reviewId}`)
}

await main()
process.exit(0)
