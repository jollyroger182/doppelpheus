import type { AnyBlock } from '@slack/types'
import { actions, blocks, button, context, divider, header, image, section } from 'slack.ts'
import { getProjectsByUserId, type Project } from '../../../queries/project'

function renderProject(project: Project): AnyBlock[] {
	const lines: string[] = [`*${project.name}*`, project.description]
	if (project.playableUrl) lines.push(`_demo:_ ${project.playableUrl}`)
	if (project.codeUrl) lines.push(`_code:_ ${project.codeUrl}`)

	const body = section(lines.join('\n'))
	const bodyBlock = (
		project.screenshotFileId
			? body.accessory(image(`${project.name} screenshot`).file(project.screenshotFileId))
			: body
	).build()

	const buttonsBlock = actions(
		button('edit').id('project.edit').value(String(project.id)),
		button('delete').style('danger').id('project.delete').value(String(project.id)),
	).build()

	return [bodyBlock, buttonsBlock]
}

export async function buildProjectsView(userId: string): Promise<{
	text: string
	blocks: AnyBlock[]
}> {
	const list = await getProjectsByUserId(userId)

	const projectBlocks: AnyBlock[] = list.length
		? list.flatMap((p, i) =>
				i === 0 ? renderProject(p) : [divider().build(), ...renderProject(p)],
			)
		: [section("you haven't created any projects yet!").build()]

	return {
		text: 'your projects',
		blocks: [
			...blocks(header('your projects')),
			...projectBlocks,
			...blocks(
				divider(),
				actions(button('add project').style('primary').id('project.add')),
				context('project shipping coming soon!'),
			),
		],
	}
}
