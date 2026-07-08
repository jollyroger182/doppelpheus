import { blocks, context, section } from 'slack.ts'
import { LINK_HACKATIME_MESSAGE, WELCOME_MESSAGE } from '../../consts'
import { logAudit } from '../../queries/audit-log'
import { CONFIG_KEYS, isFeatureEnabled, setConfig } from '../../queries/config'
import { app, bot, userBot } from '../client'
import {
	notifyUploadError,
	notifyUploadResult,
	reuploadSubmittedFileAsUser,
	saveUploadedFileForKey,
	saveFanartImage,
	UPLOAD_FILE_ACTION,
	UPLOAD_FILE_BLOCK,
	UPLOAD_KEY_ACTION,
	UPLOAD_KEY_BLOCK,
	ARTIST_NAME_ACTION,
	ARTIST_NAME_BLOCK,
	uploadModalView,
	uploadFanartModalView,
} from './admin-upload'
import { deleteProject } from '../../queries/project'
import { deleteShopItem, setShopItemEnabled } from '../../queries/shop-item'
import {
	extractProjectFormValues,
	extractScreenshotFile,
	getProjectForEdit,
	projectModalView,
	upsertProjectFromForm,
} from './modals/project'
import {
	extractShopItemFormValues,
	getShopItemForAdmin,
	shopItemModalView,
	upsertShopItemFromForm,
} from './modals/shop-item'
import { buildProjectsView } from '../user/views/projects'
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

// projects

bot.on('action:button.project.add', async (event) => {
	if (event.event.container.type !== 'message') return
	const { channel_id, message_ts } = event.event.container

	const userId = event.event.user.id

	const modal = await event.respond.modal(projectModalView())
	let submission
	try {
		submission = await modal.wait.submit()
	} catch (err) {
		return
	}

	const values = submission.values as any
	const form = extractProjectFormValues(values)
	const screenshot = extractScreenshotFile(values)
	await upsertProjectFromForm(userId, null, form, screenshot)
	await userBot
		.channel(channel_id)
		.message(message_ts)
		.edit(await buildProjectsView(userId))
})

bot.on('action:button.project.edit', async (event) => {
	if (event.event.container.type !== 'message') return
	const { channel_id, message_ts } = event.event.container

	const userId = event.event.user.id
	const projectId = Number(event.value)
	if (!Number.isFinite(projectId)) return
	const project = await getProjectForEdit(userId, projectId)
	if (!project) return

	const modal = await event.respond.modal(projectModalView(project))
	let submission
	try {
		submission = await modal.wait.submit()
	} catch (err) {
		return
	}

	const values = submission.values as any
	const form = extractProjectFormValues(values)
	const screenshot = extractScreenshotFile(values)
	await upsertProjectFromForm(userId, projectId, form, screenshot)
	await userBot
		.channel(channel_id)
		.message(message_ts)
		.edit(await buildProjectsView(userId))
})

bot.on('action:button.project.delete', async (event) => {
	const userId = event.event.user.id
	const projectId = Number(event.value)
	if (!Number.isFinite(projectId)) return
	const project = await getProjectForEdit(userId, projectId)
	if (!project) return

	await deleteProject(projectId)
	logAudit('project.deleted', userId, { id: projectId })
	await event.respond.edit(await buildProjectsView(userId))
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

bot.on('action:button.admin.shop_item.add', async (event) => {
	const userId = event.event.user.id
	if (!isAdmin(userId)) return
	const modal = await event.respond.modal(shopItemModalView())
	let submission
	try {
		submission = await modal.wait.submit()
	} catch {
		return
	}
	const form = extractShopItemFormValues(submission.values as any)
	if ('error' in form) return
	await upsertShopItemFromForm(userId, null, form)
	await republishHome(userId)
})

bot.on('action:button.admin.shop_item.edit', async (event) => {
	const userId = event.event.user.id
	if (!isAdmin(userId)) return
	const itemId = event.value
	if (!itemId) return
	const item = await getShopItemForAdmin(itemId)
	if (!item) return
	const modal = await event.respond.modal(shopItemModalView(item))
	let submission
	try {
		submission = await modal.wait.submit()
	} catch {
		return
	}
	const form = extractShopItemFormValues(submission.values as any)
	if ('error' in form) return
	await upsertShopItemFromForm(userId, itemId, form)
	await republishHome(userId)
})

bot.on('action:button.admin.shop_item.toggle', async (event) => {
	const userId = event.event.user.id
	if (!isAdmin(userId)) return
	const itemId = event.value
	if (!itemId) return
	const item = await getShopItemForAdmin(itemId)
	if (!item) return
	await setShopItemEnabled(itemId, !item.enabled)
	logAudit('admin.shop_item.toggled', userId, { id: itemId, enabled: !item.enabled })
	await republishHome(userId)
})

bot.on('action:button.admin.shop_item.delete', async (event) => {
	const userId = event.event.user.id
	if (!isAdmin(userId)) return
	const itemId = event.value
	if (!itemId) return
	await deleteShopItem(itemId)
	logAudit('admin.shop_item.deleted', userId, { id: itemId })
	await republishHome(userId)
})

bot.on('action:button.admin.upload_file', async (event) => {
	const userId = event.event.user.id
	if (!isAdmin(userId)) return
	const modal = await event.respond.modal(uploadModalView)

	let submission
	try {
		submission = await modal.wait.submit()
	} catch (err) {
		return
	}

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

bot.on('action:button.admin.upload_fanart', async (event) => {
	const userId = event.event.user.id
	if (!isAdmin(userId)) return 
	const modal = await event.respond.modal(uploadFanartModalView)

	let submission
	try {
		submission = await modal.wait.submit()
	} catch (err) {
		return
	}

	const values = submission.values
	const fileValue = values[UPLOAD_FILE_BLOCK][UPLOAD_FILE_ACTION]
	const file = fileValue.files[0]!
	const artistName = values[ARTIST_NAME_BLOCK][ARTIST_NAME_ACTION].value
	try {
		const result = await reuploadSubmittedFileAsUser(file)
		await saveFanartImage(result.id, artistName, userId)
		await notifyUploadResult(userId, result)
	} catch (err) {
		await notifyUploadError(userId, err)
	}
})
