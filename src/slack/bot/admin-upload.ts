import { blocks, fileInput, input, option, plain, plainTextInput, section, select } from 'slack.ts'
import { logAudit } from '../../queries/audit-log'
import { IMAGE_KEYS, setUploadedFileId, type ImageKey } from '../../queries/uploaded-file'
import { addFanartImage} from '../../queries/gallery'
import { bot, userBot } from '../client'

const { SLACK_BOT_TOKEN } = process.env

export const UPLOAD_FILE_BLOCK = 'upload_file'
export const UPLOAD_FILE_ACTION = 'file'
export const UPLOAD_KEY_BLOCK = 'upload_key'
export const UPLOAD_KEY_ACTION = 'key'

export const ARTIST_NAME_BLOCK = 'enter_artist_name'
export const ARTIST_NAME_ACTION = 'artist_name'

export const uploadModalView = {
	type: 'modal',
	callback_id: 'upload_modal',
	title: plain('upload as doppel').build(),
	submit: plain('upload').build(),
	close: plain('cancel').build(),
	blocks: blocks(
		section('pick a file — it will be re-uploaded as the doppel user account.'),
		input(select(...IMAGE_KEYS.map((k) => option(k).value(k))).id(UPLOAD_KEY_ACTION))
			.label('image key')
			.hint('the uploaded file will replace the image at this key')
			.id(UPLOAD_KEY_BLOCK),
		input(fileInput().id(UPLOAD_FILE_ACTION).max(1)).label('file').id(UPLOAD_FILE_BLOCK),
	),
} as const

export const uploadFanartModalView = {
	type: 'modal',
	callback_id: 'upload_fanart_modal',
	title: plain('upload fanart').build(),
	submit: plain('upload').build(),
	close: plain('cancel').build(),
	blocks: blocks(
		section('upload a new fanart image to the gallery!'),
		input(fileInput().id(UPLOAD_FILE_ACTION).max(1)).label('file').id(UPLOAD_FILE_BLOCK),
		input(plainTextInput().id(ARTIST_NAME_ACTION)).label('artistName').hint('who to credit for this fanart :3').id(ARTIST_NAME_BLOCK),
	),
} as const

export async function saveUploadedFileForKey(key: ImageKey, fileId: string, userId: string) {
	logAudit('admin.upload.saved', userId, { fileId, key })
	await setUploadedFileId(key, fileId)
}

export async function saveFanartImage(fileId: string, artistName: string, userId: string) {
	logAudit('admin.upload.fanart', userId, { fileId, artistName })
	await addFanartImage(fileId, artistName)
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
	const uploadData = new FormData()
	uploadData.append('filename', new Blob([body]), file.name)
	const uploadResp = await fetch(upload_url, { method: 'POST', body: uploadData })
	if (!uploadResp.ok) throw new Error(`upload failed with status ${uploadResp.status}`)

	const complete = await userBot.request('files.completeUploadExternal', {
		files: [{ id: file_id }],
	})
	const uploaded = complete.files[0]
	if (!uploaded) throw new Error('completeUploadExternal returned no file')

	const publicShare = await userBot.request('files.sharedPublicURL', {
		file: uploaded.id,
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
	const publicLine = uploaded.permalink_public ? `\n_public:_ ${uploaded.permalink_public}` : ''
	await bot
		.user(userId)
		.send(
			`uploaded *${uploaded.name}* as doppel: ${uploaded.permalink}\n_raw:_ ${uploaded.url_private}${publicLine}`,
		)
}

export async function notifyUploadError(userId: string, err: unknown) {
	const message = err instanceof Error ? err.message : String(err)
	await bot.user(userId).send(`file upload failed: ${message}`)
}
