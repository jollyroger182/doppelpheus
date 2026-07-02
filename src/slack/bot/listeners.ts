import { blocks, context, section } from 'slack.ts'
import { LINK_HACKATIME_MESSAGE, WELCOME_MESSAGE } from '../../consts'
import { logAudit } from '../../queries/audit-log'
import { CONFIG_KEYS, isFeatureEnabled, setConfig } from '../../queries/config'
import { bot } from '../client'
import { IMAGE_KEYS } from '../../queries/uploaded-file'
import {
	notifyUploadError,
	notifyUploadResult,
	reuploadSubmittedFileAsUser,
	saveUploadedFileForKey,
	UPLOAD_FILE_ACTION,
	UPLOAD_FILE_BLOCK,
	UPLOAD_KEY_ACTION,
	UPLOAD_KEY_BLOCK,
	uploadModalView,
} from './admin-upload'
import { buildHomeView, isAdmin } from './home'

bot.on('action:button.link_hca', async (event) => {
	logAudit('auth.hca.clicked', event.event.user.id, { state: event.value })
	await event.respond.edit({
		text: WELCOME_MESSAGE,
		blocks: blocks(
			section(WELCOME_MESSAGE),
			context('need the button again? just send me any message!'),
		),
	})
})

bot.on('action:button.link_hackatime', async (event) => {
	logAudit('auth.hackatime.clicked', event.event.user.id, { state: event.value })
	await event.respond.edit({
		text: LINK_HACKATIME_MESSAGE,
		blocks: blocks(
			section(LINK_HACKATIME_MESSAGE),
			context('need the button again? just send me any message!'),
		),
	})
})

// admin

bot.on('home', async (event) => {
	if (event.tab && event.tab !== 'home') return
	await event.respond(await buildHomeView(event.user))
})

async function republishHome(userId: string) {
	await bot.request('views.publish', { user_id: userId, view: await buildHomeView(userId) })
}

bot.on('action:button.admin.toggle_shop', async (event) => {
	const userId = event.event.user.id
	if (!isAdmin(userId)) return
	const nowEnabled = !(await isFeatureEnabled(CONFIG_KEYS.shopEnabled))
	await setConfig(CONFIG_KEYS.shopEnabled, nowEnabled ? 'true' : 'false')
	logAudit('admin.toggle_shop', userId, { enabled: nowEnabled })
	await republishHome(userId)
})

bot.on('action:button.admin.refresh_home', async (event) => {
	const userId = event.event.user.id
	if (!isAdmin(userId)) return
	await republishHome(userId)
})

bot.on('action:button.admin.upload_file', async (event) => {
	const userId = event.event.user.id
	if (!isAdmin(userId)) return
	const modal = await event.respond.modal(uploadModalView)

	const submission = await modal.wait.submit()

	const values = submission.values
	const fileValue = values[UPLOAD_FILE_BLOCK][UPLOAD_FILE_ACTION]
	const file = fileValue.files[0]!
	const key = values[UPLOAD_KEY_BLOCK][UPLOAD_KEY_ACTION].selected_option.value
	try {
		const result = await reuploadSubmittedFileAsUser(file)
		await saveUploadedFileForKey(key, result.id, userId)
		await notifyUploadResult(userId, result)
	} catch (err) {
		await notifyUploadError(userId, err)
	}
})
