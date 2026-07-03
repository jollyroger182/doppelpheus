import type { AnyBlock } from '@slack/types'
import { actions, blocks, button, context, divider, header, image, section } from 'slack.ts'
import { syncApprovedProjectToAirtable } from '../airtable'
import { formatSeconds, getHackatimeProjectStats } from '../hackatime'
import { logAudit } from '../queries/audit-log'
import { getEventStartDate } from '../queries/config'
import { getProjectWithUserById, isProjectShippable, type Project } from '../queries/project'
import {
	attachReviewMessage,
	createReview,
	decideReview,
	getLatestReviewForProject,
	getReviewById,
	type ProjectReview,
} from '../queries/project-review'
import { bot, userBot } from './client'

function projectFieldBlocks(
	project: Project,
	hackatimeSeconds: Record<string, number> | null,
): AnyBlock[] {
	const lines: string[] = [`*${project.name}*`, project.description]
	if (project.playableUrl) lines.push(`_demo:_ ${project.playableUrl}`)
	if (project.codeUrl) lines.push(`_code:_ ${project.codeUrl}`)
	if (project.hackatimeProjects.length) {
		const parts = project.hackatimeProjects.map((name) => {
			const seconds = hackatimeSeconds?.[name]
			return seconds !== undefined ? `${name} (${formatSeconds(seconds)})` : name
		})
		lines.push(`_hackatime:_ ${parts.join(', ')}`)
	}

	const body = section(lines.join('\n'))
	return [
		(project.screenshotFileId
			? body.accessory(image(`${project.name} screenshot`).file(project.screenshotFileId))
			: body
		).build(),
	]
}

function buildReviewMessage(project: Project, review: ProjectReview) {
	return {
		text: `new project submitted by <@${project.userId}>: ${project.name}`,
		blocks: [
			...blocks(
				header('project submitted for review'),
				section(`<@${project.userId}> shipped a project — take a look:`),
			),
			...projectFieldBlocks(project, review.hackatimeSeconds),
			...blocks(
				actions(
					button('approve').style('primary').id('review.approve').value(review.id),
					button('reject').style('danger').id('review.reject').value(review.id),
				),
			),
		],
	}
}

function buildDecidedReviewMessage(
	project: Project,
	review: ProjectReview,
): { text: string; blocks: AnyBlock[] } {
	const decisionLine =
		review.status === 'approved'
			? `✓ approved by <@${review.reviewerId}>`
			: `✗ rejected by <@${review.reviewerId}>${review.comment ? `\n> ${review.comment}` : ''}`

	return {
		text: `project ${review.status}: ${project.name}`,
		blocks: [
			...blocks(
				header(review.status === 'approved' ? 'project approved' : 'project rejected'),
				section(`<@${project.userId}> — ${project.name}`),
			),
			...projectFieldBlocks(project, review.hackatimeSeconds),
			...blocks(divider(), context(decisionLine)),
		],
	}
}

async function editReviewMessage(review: ProjectReview, project: Project) {
	if (!review.channelId || !review.messageTs) return
	try {
		await bot
			.channel(review.channelId)
			.message(review.messageTs)
			.edit(buildDecidedReviewMessage(project, review))
	} catch (err) {
		console.error('failed to edit reviews-channel message', err)
	}
}

export type SubmitResult =
	| { ok: true; reviewId: string }
	| { ok: false; reason: 'not_found' | 'not_shippable' | 'already_pending' | 'no_channel' }

export async function submitProjectForReview(
	userId: string,
	projectId: number,
): Promise<SubmitResult> {
	const project = await getProjectWithUserById(projectId)
	if (!project || project.userId !== userId) return { ok: false, reason: 'not_found' }
	if (!isProjectShippable(project)) return { ok: false, reason: 'not_shippable' }

	const latest = await getLatestReviewForProject(projectId)
	if (latest?.status === 'pending') return { ok: false, reason: 'already_pending' }

	const { REVIEWS_CHANNEL } = process.env
	if (!REVIEWS_CHANNEL) {
		console.error('REVIEWS_CHANNEL not configured; cannot submit project for review')
		return { ok: false, reason: 'no_channel' }
	}

	const windowEnd = new Date()
	const windowStart = latest?.createdAt ?? (await getEventStartDate()) ?? new Date(0)
	const stats = await getHackatimeProjectStats(userId, windowStart, windowEnd)
	const selected = new Set(project.hackatimeProjects)
	const hackatimeSeconds: Record<string, number> = {}
	for (const stat of stats) {
		if (selected.has(stat.project)) hackatimeSeconds[stat.project] = stat.seconds
	}

	const review = await createReview(projectId, hackatimeSeconds)
	const posted = await bot.channel(REVIEWS_CHANNEL).send(buildReviewMessage(project, review))
	if (posted) {
		await attachReviewMessage(review.id, REVIEWS_CHANNEL, posted.ts)
	}
	logAudit('project.submitted', userId, { projectId, reviewId: review.id })
	return { ok: true, reviewId: review.id }
}

async function decideAndNotify(
	reviewId: string,
	reviewerId: string,
	status: 'approved' | 'rejected',
	comment: string | null,
) {
	const existing = await getReviewById(reviewId)
	if (!existing || existing.status !== 'pending') return null

	const decided = await decideReview(reviewId, { status, reviewerId, comment })
	if (!decided) return null

	const project = await getProjectWithUserById(decided.projectId)
	if (!project) return decided

	await editReviewMessage(decided, project)

	const userMessage =
		status === 'approved'
			? {
					text: `your project "${project.name}" was approved!`,
					blocks: blocks(
						section(`🎉 your project *${project.name}* was approved!`),
						context('nice work — it will show up in the shop soon.'),
					),
				}
			: {
					text: `your project "${project.name}" needs some changes`,
					blocks: blocks(
						section(
							`your project *${project.name}* wasn't approved yet.\n\n>${(comment ?? '').replace(/\n/g, '\n>')}`,
						),
						context('edit your project to address the feedback, then ship it again.'),
					),
				}

	try {
		await userBot.user(project.userId).send(userMessage)
	} catch (err) {
		console.error('failed to DM participant about review decision', err)
	}

	if (status === 'approved') {
		try {
			await syncApprovedProjectToAirtable(project, decided)
		} catch (err) {
			console.error('airtable sync failed', err)
			logAudit('airtable.sync.failed', reviewerId, {
				reviewId,
				projectId: project.id,
				error: err instanceof Error ? err.message : String(err),
			})
		}
	}

	logAudit(`project.${status}`, reviewerId, {
		reviewId,
		projectId: project.id,
		userId: project.userId,
		comment,
	})
	return decided
}

export async function approveReview(reviewId: string, reviewerId: string) {
	return decideAndNotify(reviewId, reviewerId, 'approved', null)
}

export async function rejectReview(reviewId: string, reviewerId: string, comment: string) {
	return decideAndNotify(reviewId, reviewerId, 'rejected', comment)
}
