import type { AnyBlock } from '@slack/types'
import { actions, blocks, button, context, divider, header, image, section } from 'slack.ts'
import { formatSeconds, getHackatimeProjectStats } from '../../../hackatime'
import { getEventStartDate } from '../../../queries/config'
import {
	getProjectsByUserId,
	isProjectShippable,
	missingShippableFields,
	type Project,
} from '../../../queries/project'
import {
	computeReviewState,
	getReviewsForProjects,
	type ProjectReview,
	type ProjectReviewState,
} from '../../../queries/project-review'

function shippedSeconds(reviews: ProjectReview[]): number {
	return reviews
		.filter((r) => r.status === 'approved')
		.reduce((acc, r) => acc + r.hackatimeSeconds, 0)
}

function renderProject(
	project: Project,
	state: ProjectReviewState,
	totalSeconds: number,
	shippedTotalSeconds: number,
): AnyBlock[] {
	const lines: string[] = [`*${project.name}*`, project.description]
	if (project.playableUrl) lines.push(`_demo:_ ${project.playableUrl}`)
	if (project.codeUrl) lines.push(`_code:_ ${project.codeUrl}`)
	if (project.hackatimeProjects.length)
		lines.push(`_hackatime:_ ${project.hackatimeProjects.join(', ')}`)
	lines.push(`_total time:_ ${formatSeconds(totalSeconds)}`)
	lines.push(`_shipped time:_ ${formatSeconds(shippedTotalSeconds)}`)

	const body = section(lines.join('\n'))
	const bodyBlock = (
		project.screenshotFileId
			? body.accessory(image(`${project.name} screenshot`).file(project.screenshotFileId))
			: body
	).build()

	const value = String(project.id)
	const result: AnyBlock[] = [bodyBlock]

	if (state.underReview) {
		result.push(context("under review! we'll dm you when we're done :D").build())
		return result
	}

	const shippable = isProjectShippable(project)
	const buttons = [
		button('edit').id('project.edit').value(value),
		...(state.shipped ? [] : [button('delete').style('danger').id('project.delete').value(value)]),
		...(shippable
			? [
					button(state.shipped ? 're-ship' : 'ship it!')
						.style('primary')
						.id('project.ship')
						.value(value),
				]
			: []),
	]
	result.push(actions(...buttons).build())

	if (state.lastRejectionComment) {
		result.push(context(`rejected: ${state.lastRejectionComment}`).build())
	} else if (!shippable) {
		const missing = missingShippableFields(project)
		result.push(context(`fill in ${missing.join(', ')} to ship this`).build())
	}

	return result
}

export async function buildProjectsView(userId: string): Promise<{
	text: string
	blocks: AnyBlock[]
}> {
	const list = await getProjectsByUserId(userId)
	const [reviewsByProject, eventStart] = await Promise.all([
		getReviewsForProjects(list.map((p) => p.id)),
		getEventStartDate(),
	])

	// Single hackatime request for the whole render — spans event start → now.
	const stats = list.length
		? await getHackatimeProjectStats(userId, eventStart ?? new Date(0), new Date())
		: []
	const secondsByHackatimeProject = new Map(stats.map((s) => [s.project, s.seconds]))

	const projectBlocks: AnyBlock[] = list.length
		? list.flatMap((p, i) => {
				const reviews = reviewsByProject.get(p.id) ?? []
				const state = computeReviewState(reviews)
				const totalSeconds = p.hackatimeProjects.reduce(
					(acc, name) => acc + (secondsByHackatimeProject.get(name) ?? 0),
					0,
				)
				const shipped = shippedSeconds(reviews)
				return i === 0
					? renderProject(p, state, totalSeconds, shipped)
					: [divider().build(), ...renderProject(p, state, totalSeconds, shipped)]
			})
		: [section("you haven't created any projects yet!").build()]

	return {
		text: 'your projects',
		blocks: [
			...blocks(header('your projects')),
			...projectBlocks,
			...blocks(divider(), actions(button('add project').style('primary').id('project.add'))),
		],
	}
}
