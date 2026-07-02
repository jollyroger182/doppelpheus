import { blocks, fileInput, input, plain, plainTextInput, section } from 'slack.ts'
import { logAudit } from '../../../queries/audit-log'
import {
	createProject,
	getProjectById,
	updateProject,
	type Project,
} from '../../../queries/project'
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

export function projectModalView(project?: Project) {
	const isEdit = !!project
	return {
		type: 'modal' as const,
		private_metadata: isEdit ? String(project!.id) : '',
		title: plain(isEdit ? 'edit project' : 'add project').build(),
		submit: plain(isEdit ? 'save' : 'create').build(),
		close: plain('cancel').build(),
		blocks: blocks(
			section(
				isEdit
					? 'update your project details below.'
					: "let's set up a new project! name and description are required.",
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
			input(
				plainTextInput()
					.id(DEMO_ACTION)
					.placeholder('https://…')
					.default(project?.playableUrl ?? ''),
			)
				.label('demo url')
				.optional()
				.hint('a link where anyone can try out your project')
				.id(DEMO_BLOCK),
			input(
				plainTextInput()
					.id(CODE_ACTION)
					.placeholder('https://github.com/…')
					.default(project?.codeUrl ?? ''),
			)
				.label('code url')
				.optional()
				.hint("a link to your project's GitHub, Gitlab, etc.")
				.id(CODE_BLOCK),
			input(fileInput().id(SCREENSHOT_ACTION).max(1))
				.label('screenshot')
				.optional()
				.hint(
					project?.screenshotFileId
						? 'leave empty to keep the current screenshot'
						: 'screenshot of your project working',
				)
				.id(SCREENSHOT_BLOCK),
		),
	}
}

export interface ProjectFormValues {
	name: string
	description: string
	playableUrl: string | null
	codeUrl: string | null
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
	const playableUrl: string = values[DEMO_BLOCK]?.[DEMO_ACTION]?.value ?? ''
	const codeUrl: string = values[CODE_BLOCK]?.[CODE_ACTION]?.value ?? ''

	return {
		name: name.trim(),
		description: description.trim(),
		playableUrl: playableUrl.trim() || null,
		codeUrl: codeUrl.trim() || null,
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
	}
	if (screenshotFileId !== undefined) patch.screenshotFileId = screenshotFileId
	const updated = await updateProject(projectId, patch)
	logAudit('project.updated', userId, { id: projectId, ...patch })
	return updated
}

export async function getProjectForEdit(userId: string, projectId: number) {
	const project = await getProjectById(projectId)
	if (!project || project.userId !== userId) return undefined
	return project
}
