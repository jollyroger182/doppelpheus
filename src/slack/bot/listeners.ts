import { blocks, context, option, plain, section } from 'slack.ts'
import { LINK_HACKATIME_MESSAGE, WELCOME_MESSAGE } from '../../consts'
import { logAudit } from '../../queries/audit-log'
import { app, bot, userBot } from '../client'
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
import { deleteProject } from '../../queries/project'
import { getLatestReviewForProject, getReviewsForProjects } from '../../queries/project-review'
import { deleteShopItem, setShopItemEnabled } from '../../queries/shop-item'
import { formatSeconds, getHackatimeProjectStats } from '../../hackatime'
import { CONFIG_KEYS, getEventStartDate, isFeatureEnabled, setConfig } from '../../queries/config'
import { eventStartModalView, extractEventStartDate } from './modals/event-start'
import {
	extractProjectFormValues,
	extractScreenshotFile,
	getProjectForEdit,
	HACKATIME_ACTION,
	projectModalView,
	upsertProjectFromForm,
} from './modals/project'
import { approveReasonModalView, extractApproveDecision } from './modals/review-approve'
import { extractRejectDecision, rejectReasonModalView } from './modals/review-reject'
import { approveReview, rejectReview, submitProjectForReview } from '../review'
import {
	extractShopItemFormValues,
	getShopItemForAdmin,
	shopItemModalView,
	upsertShopItemFromForm,
} from './modals/shop-item'
import {
	applyUserBalanceAdjustment,
	extractUserBalanceFormValues,
	userBalanceModalView,
} from './modals/user-balance'
import { buildProjectsView } from '../user/views/projects'
import { buildHomeView, isAdmin } from './home'
import { getUploadedFileId } from '../../queries/uploaded-file'

bot.on('action:button.link_hca', async (event) => {
	logAudit('auth.hca.clicked', event.event.user.id, { state: event.value })

	const welcomeImageId = await getUploadedFileId('welcome')
	await event.respond.edit({
		text: WELCOME_MESSAGE,
		blocks: [
			...(welcomeImageId
				? [
						{
							type: 'image' as const,
							title: plain('welcome :3').build(),
							slack_file: { id: welcomeImageId },
							alt_text: 'welcome :3',
						},
					]
				: []),
			...blocks(
				section(WELCOME_MESSAGE),
				context('need the button again? just send me any message!'),
			),
		],
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
		submission = await modal.wait.timeout(5 * 60_000).submit()
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

	const latest = await getLatestReviewForProject(projectId)
	if (latest?.status === 'pending') {
		logAudit('project.edit.blocked', userId, { id: projectId, reason: 'under_review' })
		return
	}

	const modal = await event.respond.modal(projectModalView(project))
	let submission
	try {
		submission = await modal.wait.timeout(5 * 60_000).submit()
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

	const latest = await getLatestReviewForProject(projectId)
	if (latest?.status === 'pending') {
		logAudit('project.delete.blocked', userId, { id: projectId, reason: 'under_review' })
		return
	}
	// shipped projects (any approved review) cannot be deleted
	const reviews = await getReviewsForProjects([projectId])
	const list = reviews.get(projectId) ?? []
	if (list.some((r) => r.status === 'approved')) {
		logAudit('project.delete.blocked', userId, { id: projectId, reason: 'shipped' })
		return
	}

	await deleteProject(projectId)
	logAudit('project.deleted', userId, { id: projectId })
	await event.respond.edit(await buildProjectsView(userId))
})

bot.on('action:button.project.ship', async (event) => {
	if (event.event.container.type !== 'message') return
	const { channel_id, message_ts } = event.event.container

	const userId = event.event.user.id
	const projectId = Number(event.value)
	if (!Number.isFinite(projectId)) return

	const result = await submitProjectForReview(userId, projectId)
	if (!result.ok) {
		logAudit('project.ship.blocked', userId, { id: projectId, reason: result.reason })
	}

	await userBot
		.channel(channel_id)
		.message(message_ts)
		.edit(await buildProjectsView(userId))
})

bot.on('action:button.review.approve', async (event) => {
	const reviewerId = event.event.user.id
	if (!isAdmin(reviewerId)) return
	const reviewId = event.value
	if (!reviewId) return

	const modal = await event.respond.modal(approveReasonModalView(reviewId))
	let submission
	try {
		submission = await modal.wait.timeout(5 * 60_000).submit()
	} catch {
		return
	}
	const extras = extractApproveDecision(submission.values as any)
	await approveReview(reviewId, reviewerId, extras)
})

bot.on('action:button.review.reject', async (event) => {
	const reviewerId = event.event.user.id
	if (!isAdmin(reviewerId)) return
	const reviewId = event.value
	if (!reviewId) return

	const modal = await event.respond.modal(rejectReasonModalView(reviewId))
	let submission
	try {
		submission = await modal.wait.timeout(5 * 60_000).submit()
	} catch {
		return
	}
	const decision = extractRejectDecision(submission.values as any)
	if (!decision.reason) return
	await rejectReview(reviewId, reviewerId, decision.reason, {
		justification: decision.justification,
		hoursAdjustment: decision.hoursAdjustment,
	})
})

bot.on(`autocomplete.${HACKATIME_ACTION}`, async (event) => {
	const payload = event as any
	const userId: string = payload.user?.id ?? ''
	const query: string = (payload.value ?? '').toString().toLowerCase()
	const start = (await getEventStartDate()) ?? new Date(0)
	const stats = await getHackatimeProjectStats(userId, start, new Date())
	const matches = stats
		.filter((s) => s.project.toLowerCase().includes(query))
		.sort((a, b) => b.seconds - a.seconds)
		.slice(0, 100)
		.map((s) => option(`${s.project} (${formatSeconds(s.seconds)})`, s.project))
	await event.respond(...matches)
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

bot.on('action:button.admin.event_start.edit', async (event) => {
	const userId = event.event.user.id
	if (!isAdmin(userId)) return
	const current = await getEventStartDate()
	const modal = await event.respond.modal(eventStartModalView(current))
	let submission
	try {
		submission = await modal.wait.timeout(5 * 60_000).submit()
	} catch {
		return
	}
	const dateStr = extractEventStartDate(submission.values as any)
	if (!dateStr) return
	await setConfig(CONFIG_KEYS.eventStartDate, dateStr)
	logAudit('admin.event_start.set', userId, { date: dateStr })
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
		submission = await modal.wait.timeout(5 * 60_000).submit()
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
		submission = await modal.wait.timeout(5 * 60_000).submit()
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

bot.on('action:button.admin.user_balance.adjust', async (event) => {
	const userId = event.event.user.id
	if (!isAdmin(userId)) return
	const modal = await event.respond.modal(userBalanceModalView())
	let submission
	try {
		submission = await modal.wait.timeout(5 * 60_000).submit()
	} catch {
		return
	}
	const form = extractUserBalanceFormValues(submission.values as any)
	if ('error' in form) return
	await applyUserBalanceAdjustment(userId, form)
	await republishHome(userId)
})

bot.on('action:button.admin.upload_file', async (event) => {
	const userId = event.event.user.id
	if (!isAdmin(userId)) return
	const modal = await event.respond.modal(uploadModalView)

	let submission
	try {
		submission = await modal.wait.timeout(5 * 60_000).submit()
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
