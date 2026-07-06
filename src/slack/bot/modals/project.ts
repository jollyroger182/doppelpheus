import { blocks, fileInput, input, option, plain, plainTextInput, section, select } from 'slack.ts'
import { logAudit } from '../../../queries/audit-log'
import {
	createProject,
	getProjectWithUserById,
	updateProject,
	type Project,
} from '../../../queries/project'
import { extractUrlValue, urlInputBlock } from '../../blocks/url-input'
import { bot } from '../../client'

const { SLACK_USER_ID } = process.env

export const NAME_BLOCK = 'project.name'
export const NAME_ACTION = 'name'
export const DESC_BLOCK = 'project.description'
export const DESC_ACTION = 'description'
export const DEMO_BLOCK = 'project.demo_url'
export const DEMO_ACTION = 'demo_url'
export const CODE_BLOCK = 'project.code_url'
export const CODE_ACTION = 'code_url'
export const SCREENSHOT_BLOCK = 'project.screenshot'
export const SCREENSHOT_ACTION = 'screenshot'
export const HACKATIME_BLOCK = 'project.hackatime'
export const HACKATIME_ACTION = 'hackatime'

export function projectModalView(project?: Project) {
	const isEdit = !!project
	return {
		type: 'modal' as const,
		private_metadata: isEdit ? String(project!.id) : '',
		title: plain(isEdit ? 'edit project' : 'add project').build(),
		submit: plain(isEdit ? 'save' : 'create').build(),
		close: plain('cancel').build(),
		blocks: [
			...blocks(
				section(
					isEdit
						? 'update your project details below'
						: 'name and description are required for new projects, but all fields are required to ship :3',
				),
				input(
					plainTextInput()
						.id(NAME_ACTION)
						.placeholder('doppel')
						.default(project?.name ?? ''),
				)
					.label('name')
					.id(NAME_BLOCK),
				input(
					plainTextInput()
						.multiline()
						.id(DESC_ACTION)
						.placeholder('what does it do?')
						.default(project?.description ?? ''),
				)
					.label('description')
					.id(DESC_BLOCK),
			),
			urlInputBlock({
				blockId: DEMO_BLOCK,
				actionId: DEMO_ACTION,
				label: 'demo url',
				placeholder: 'https://…',
				hint: 'a link to a public channel on slack where you introduce and demo your bot, or some other link where anyone can try out your bot',
				initial: project?.playableUrl,
				optional: true,
			}).build(),
			urlInputBlock({
				blockId: CODE_BLOCK,
				actionId: CODE_ACTION,
				label: 'code url',
				placeholder: 'https://github.com/…',
				hint: "a link to your project's github, gitlab, etc",
				initial: project?.codeUrl,
				optional: true,
			}).build(),
			...blocks(
				input(fileInput('jpg', 'png', 'webp', 'jpeg').id(SCREENSHOT_ACTION).max(1))
					.label('screenshot')
					.optional()
					.hint(
						project?.screenshotFileId
							? 'leave empty to keep the current screenshot'
							: 'screenshot of your project working',
					)
					.id(SCREENSHOT_BLOCK),
				input(
					select()
						.multiple()
						.dynamic()
						.id(HACKATIME_ACTION)
						.minQueryLength(0)
						.placeholder('pick your hackatime projects')
						.default(...(project?.hackatimeProjects ?? []).map((v) => option(v, v))),
				)
					.label('hackatime projects')
					.optional()
					.id(HACKATIME_BLOCK),
			),
		],
	}
}

export interface ProjectFormValues {
	name: string
	description: string
	playableUrl: string | null
	codeUrl: string | null
	hackatimeProjects: string[]
}

interface SubmittedFile {
	id: string
	name: string
	permalink: string
	url_private_download: string
}

export function extractProjectFormValues(
	values: Record<string, Record<string, any>>,
): ProjectFormValues {
	const name: string = values[NAME_BLOCK]?.[NAME_ACTION]?.value ?? ''
	const description: string = values[DESC_BLOCK]?.[DESC_ACTION]?.value ?? ''
	const playableUrl = extractUrlValue(values, DEMO_BLOCK, DEMO_ACTION)
	const codeUrl = extractUrlValue(values, CODE_BLOCK, CODE_ACTION)
	const hackatimeSelections: { value: string }[] =
		values[HACKATIME_BLOCK]?.[HACKATIME_ACTION]?.selected_options ?? []

	return {
		name: name.trim(),
		description: description.trim(),
		playableUrl: playableUrl || null,
		codeUrl: codeUrl || null,
		hackatimeProjects: hackatimeSelections.map((o) => o.value),
	}
}

export function extractScreenshotFile(
	values: Record<string, Record<string, any>>,
): SubmittedFile | undefined {
	return values[SCREENSHOT_BLOCK]?.[SCREENSHOT_ACTION]?.files?.[0] as SubmittedFile | undefined
}

export async function upsertProjectFromForm(
	userId: string,
	projectId: number | null,
	form: ProjectFormValues,
	submittedScreenshot: SubmittedFile | undefined,
) {
	let screenshotFileId: string | null | undefined
	if (submittedScreenshot) {
		await bot.user(SLACK_USER_ID!).send(submittedScreenshot.permalink)
		await new Promise((resolve) => setTimeout(resolve, 1000))
		screenshotFileId = submittedScreenshot.id
	}

	if (projectId === null) {
		const data = {
			userId,
			name: form.name,
			description: form.description,
			playableUrl: form.playableUrl,
			codeUrl: form.codeUrl,
			screenshotFileId: screenshotFileId ?? null,
			hackatimeProjects: form.hackatimeProjects,
		}
		const created = await createProject(data)
		logAudit('project.created', userId, { id: created.id, ...data })
		return created
	}

	const patch: Partial<Project> = {
		name: form.name,
		description: form.description,
		playableUrl: form.playableUrl,
		codeUrl: form.codeUrl,
		hackatimeProjects: form.hackatimeProjects,
	}
	if (screenshotFileId !== undefined) patch.screenshotFileId = screenshotFileId
	const updated = await updateProject(projectId, patch)
	logAudit('project.updated', userId, { id: projectId, ...patch })
	return updated
}

export async function getProjectForEdit(userId: string, projectId: number) {
	const project = await getProjectWithUserById(projectId)
	if (!project || project.userId !== userId) return undefined
	return project
}
