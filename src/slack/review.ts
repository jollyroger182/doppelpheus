import type { AnyBlock } from '@slack/types'
import { actions, blocks, button, context, divider, header, image, section } from 'slack.ts'
import { syncApprovedProjectToAirtable, syncUserLoopsToAirtable } from '../airtable'
import { formatSeconds, getHackatimeProjectStats } from '../hackatime'
import { logAudit } from '../queries/audit-log'
import { getEventStartDate } from '../queries/config'
import { getProjectWithUserById, isProjectShippable, type Project } from '../queries/project'
import {
	attachReviewMessage,
	createReview,
	decideReview,
	getApprovedHackatimeSecondsForProject,
	getLatestApprovedReviewForProject,
	getLatestReviewForProject,
	getReviewById,
	type ProjectReview,
} from '../queries/project-review'
import { bot, userBot } from './client'

function projectFieldBlocks(project: Project, hackatimeSeconds: number): AnyBlock[] {
	const lines: string[] = [`*${project.name}*`, project.description]
	if (project.playableUrl) lines.push(`_demo:_ ${project.playableUrl}`)
	if (project.codeUrl) lines.push(`_code:_ ${project.codeUrl}`)
	if (project.hackatimeProjects.length)
		lines.push(`_hackatime:_ ${project.hackatimeProjects.join(', ')}`)
	lines.push(`_hackatime time:_ ${formatSeconds(hackatimeSeconds)}`)

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

	const extras: string[] = []
	if (review.justification) extras.push(`_justification (private):_ ${review.justification}`)
	if (review.hoursAdjustment !== null && review.hoursAdjustment !== undefined) {
		const sign = review.hoursAdjustment > 0 ? '+' : ''
		extras.push(`_hour adjustment (private):_ ${sign}${review.hoursAdjustment}h`)
	}

	return {
		text: `project ${review.status}: ${project.name}`,
		blocks: [
			...blocks(
				header(review.status === 'approved' ? 'project approved' : 'project rejected'),
				section(`<@${project.userId}> — ${project.name}`),
			),
			...projectFieldBlocks(project, review.hackatimeSeconds),
			...blocks(divider(), context(decisionLine)),
			...(extras.length ? blocks(context(extras.join('\n'))) : []),
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

// Always counts from event start up to `until`, minus the hours already
// captured in previously-approved reviews for this project. Rejected windows
// continue to count since only approvals reduce the outstanding total.
async function computeUncountedHackatimeSeconds(project: Project, until: Date): Promise<number> {
	const eventStart = (await getEventStartDate()) ?? new Date(0)
	const stats = await getHackatimeProjectStats(project.userId, eventStart, until)
	const selected = new Set(project.hackatimeProjects)
	const total = stats.filter((s) => selected.has(s.project)).reduce((acc, s) => acc + s.seconds, 0)
	const alreadyApproved = await getApprovedHackatimeSecondsForProject(project.id)
	return Math.max(0, total - alreadyApproved)
}

export type SubmitResult =
	| { ok: true; reviewId: string }
	| {
			ok: false
			reason: 'not_found' | 'not_shippable' | 'already_pending' | 'no_new_hours' | 'no_channel'
	  }

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

	const hackatimeSeconds = await computeUncountedHackatimeSeconds(project, new Date())
	if (hackatimeSeconds === 0) {
		const alreadyApproved = await getLatestApprovedReviewForProject(projectId)
		if (alreadyApproved) return { ok: false, reason: 'no_new_hours' }
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
	justification: string | null,
	hoursAdjustment: number | null,
) {
	const existing = await getReviewById(reviewId)
	if (!existing || existing.status !== 'pending') return null

	const project = await getProjectWithUserById(existing.projectId)

	const hackatimeSeconds =
		status === 'approved' && project
			? await computeUncountedHackatimeSeconds(project, existing.createdAt)
			: undefined

	const decided = await decideReview(reviewId, {
		status,
		reviewerId,
		comment,
		justification,
		hoursAdjustment,
		hackatimeSeconds,
	})
	if (!decided) return null

	if (!project) return decided

	await editReviewMessage(decided, project)

	const userMessage =
		status === 'approved'
			? {
					text: `your project "${project.name}" was approved!`,
					blocks: blocks(
						section(`haii! your project *${project.name}* was approved! :doppel-bounce:`),
						context('say `projects` to see the details :3'),
					),
				}
			: {
					text: `your project "${project.name}" was rejected :(`,
					blocks: blocks(
						section(
							`your project *${project.name}* was rejected :(\n\n>${(comment ?? '').replace(/\n/g, '\n>')}`,
						),
						context('fix & resubmit your project!'),
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
		try {
			await syncUserLoopsToAirtable(project.user)
		} catch (err) {
			console.error('airtable user sync failed', err)
		}
	}

	logAudit(`project.${status}`, reviewerId, {
		reviewId,
		projectId: project.id,
		userId: project.userId,
		comment,
		justification,
		hoursAdjustment,
	})
	return decided
}

export async function approveReview(
	reviewId: string,
	reviewerId: string,
	extras: { justification: string; hoursAdjustment: number | null },
) {
	return decideAndNotify(
		reviewId,
		reviewerId,
		'approved',
		null,
		extras.justification,
		extras.hoursAdjustment,
	)
}

export async function rejectReview(
	reviewId: string,
	reviewerId: string,
	comment: string,
	extras: { justification: string | null; hoursAdjustment: number | null },
) {
	return decideAndNotify(
		reviewId,
		reviewerId,
		'rejected',
		comment,
		extras.justification,
		extras.hoursAdjustment,
	)
}
