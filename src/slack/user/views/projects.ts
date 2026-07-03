import type { AnyBlock } from '@slack/types'
import { actions, blocks, button, context, divider, header, image, section } from 'slack.ts'
import {
	getProjectsByUserId,
	isProjectShippable,
	missingShippableFields,
	type Project,
} from '../../../queries/project'
import {
	computeReviewState,
	getReviewsForProjects,
	type ProjectReviewState,
} from '../../../queries/project-review'

function renderProject(project: Project, state: ProjectReviewState): AnyBlock[] {
	const lines: string[] = [`*${project.name}*`, project.description]
	if (project.playableUrl) lines.push(`_demo:_ ${project.playableUrl}`)
	if (project.codeUrl) lines.push(`_code:_ ${project.codeUrl}`)
	if (project.hackatimeProjects.length)
		lines.push(`_hackatime:_ ${project.hackatimeProjects.join(', ')}`)

	const body = section(lines.join('\n'))
	const bodyBlock = (
		project.screenshotFileId
			? body.accessory(image(`${project.name} screenshot`).file(project.screenshotFileId))
			: body
	).build()

	const value = String(project.id)
	const result: AnyBlock[] = [bodyBlock]

	if (state.underReview) {
		result.push(
			context("under review — you'll get a DM once we've made a decision").build(),
		)
		return result
	}

	const shippable = isProjectShippable(project)
	const buttons = [
		button('edit').id('project.edit').value(value),
		...(state.shipped
			? []
			: [button('delete').style('danger').id('project.delete').value(value)]),
		...(shippable
			? [
					button(state.shipped ? 're-ship' : 'ship it')
						.style('primary')
						.id('project.ship')
						.value(value),
				]
			: []),
	]
	result.push(actions(...buttons).build())

	if (state.shipped) {
		result.push(context('✓ shipped').build())
	} else if (state.lastRejectionComment) {
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
	const reviewsByProject = await getReviewsForProjects(list.map((p) => p.id))

	const projectBlocks: AnyBlock[] = list.length
		? list.flatMap((p, i) => {
				const state = computeReviewState(reviewsByProject.get(p.id) ?? [])
				return i === 0
					? renderProject(p, state)
					: [divider().build(), ...renderProject(p, state)]
			})
		: [section("you haven't created any projects yet!").build()]

	return {
		text: 'your projects',
		blocks: [
			...blocks(header('your projects')),
			...projectBlocks,
			...blocks(
				divider(),
				actions(button('add project').style('primary').id('project.add')),
			),
		],
	}
}
