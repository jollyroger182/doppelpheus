import { blocks, fileInput, input, option, plain, section, select } from 'slack.ts'
import { logAudit } from '../../queries/audit-log'
import { IMAGE_KEYS, setUploadedFileId, type ImageKey } from '../../queries/uploaded-file'
import { bot, userBot } from '../client'

const { SLACK_BOT_TOKEN, BTS_CHANNEL } = process.env

export const UPLOAD_MODAL_CALLBACK = 'admin.uploaded_file'
export const UPLOAD_FILE_BLOCK = 'upload_file'
export const UPLOAD_FILE_ACTION = 'file'
export const UPLOAD_KEY_BLOCK = 'upload_key'
export const UPLOAD_KEY_ACTION = 'key'

export const uploadModalView = {
	type: 'modal' as const,
	callback_id: UPLOAD_MODAL_CALLBACK,
	title: plain('upload as doppel').build(),
	submit: plain('upload').build(),
	close: plain('cancel').build(),
	blocks: blocks(
		section('pick a file — it will be re-uploaded as the doppel user account.'),
		input(
			select(...IMAGE_KEYS.map((k) => option(k).value(k))).id(UPLOAD_KEY_ACTION),
		)
			.label('image key')
			.hint('the uploaded file will replace the image at this key')
			.id(UPLOAD_KEY_BLOCK),
		input(fileInput().id(UPLOAD_FILE_ACTION).max(1)).label('file').id(UPLOAD_FILE_BLOCK),
	),
}

export async function saveUploadedFileForKey(key: ImageKey, fileId: string) {
	await setUploadedFileId(key, fileId)
}

interface SubmittedFile {
	id: string
	name: string
	url_private_download: string
	mimetype?: string
}

export async function reuploadSubmittedFileAsUser(file: SubmittedFile) {
	const download = await fetch(file.url_private_download, {
		headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
	})
	if (!download.ok) throw new Error(`download failed with status ${download.status}`)
	const body = await download.arrayBuffer()

	const { upload_url, file_id } = await userBot.request('files.getUploadURLExternal', {
		length: body.byteLength,
		filename: file.name,
	})
	const uploadResp = await fetch(upload_url, { method: 'POST', body })
	if (!uploadResp.ok) throw new Error(`upload failed with status ${uploadResp.status}`)

	const complete = await userBot.request('files.completeUploadExternal', {
		files: [{ id: file_id }],
		channel_id: BTS_CHANNEL || undefined,
	})
	const uploaded = complete.files[0]
	if (!uploaded) throw new Error('completeUploadExternal returned no file')

	const publicShare = (await userBot.request('files.sharedPublicURL', {
		file: uploaded.id,
	})) as { file?: { permalink_public?: string } }

	await bot.request('files.delete', { file: file.id }).catch((err) => {
		console.error('failed to delete original bot-uploaded file', err)
	})

	return {
		...uploaded,
		permalink_public: publicShare.file?.permalink_public ?? uploaded.permalink_public,
	}
}

export async function notifyUploadResult(
	userId: string,
	uploaded: { name: string; permalink: string; url_private: string; permalink_public?: string },
) {
	logAudit('admin.upload.uploaded', userId, {
		filename: uploaded.name,
		channel: BTS_CHANNEL,
	})
	const publicLine = uploaded.permalink_public ? `\n_public:_ ${uploaded.permalink_public}` : ''
	await bot
		.user(userId)
		.send(
			`uploaded *${uploaded.name}* as doppel: ${uploaded.permalink}\n_raw:_ ${uploaded.url_private}${publicLine}`,
		)
}

export async function notifyUploadError(userId: string, err: unknown) {
	const message = err instanceof Error ? err.message : String(err)
	logAudit('admin.upload.failed', userId, { message })
	await bot.user(userId).send(`file upload failed: ${message}`)
}
