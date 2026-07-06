import { getProjectByScreenshotToken } from '../queries/project'
import { bot } from '../slack/client'

const { SLACK_BOT_TOKEN } = process.env

export async function handleScreenshot(req: Request) {
	const url = new URL(req.url)
	const token = url.pathname.split('/').pop() ?? ''
	if (!token) return new Response('not found', { status: 404 })

	const project = await getProjectByScreenshotToken(token)
	if (!project || !project.screenshotFileId) {
		return new Response('not found', { status: 404 })
	}

	const info = await bot.request('files.info', { file: project.screenshotFileId })
	const file = info.file as
		{ url_private_download?: string; mimetype?: string; name?: string } | undefined
	if (!file?.url_private_download) {
		return new Response('not found', { status: 404 })
	}

	const download = await fetch(file.url_private_download, {
		headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
	})
	if (!download.ok) {
		return new Response('upstream error', { status: 502 })
	}

	const headers = new Headers()
	if (file.mimetype) headers.set('Content-Type', file.mimetype)
	const len = download.headers.get('Content-Length')
	if (len) headers.set('Content-Length', len)
	if (file.name) headers.set('Content-Disposition', `inline; filename="${file.name}"`)
	return new Response(download.body, { status: 200, headers })
}
