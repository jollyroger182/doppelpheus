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
import {
	getApprovedHackatimeSecondsForProject,
	getLatestReviewForProject,
	getReviewById,
	getReviewsForProjects,
} from '../../queries/project-review'
import { getProjectWithUserById } from '../../queries/project'
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
import {
	buildAddressSettingsMessage,
	SETTINGS_ADDRESS_ACTION,
	SHOP_BUY_ACTION,
} from '../user/keywords'
import { getShopItemById } from '../../queries/shop-item'
import {
	adjustUserBalance,
	debitUserBalanceIfSufficient,
	getUserBalanceMinutes,
	getUserById,
	setSelectedHcaAddressId,
} from '../../queries/user'
import {
	attachPurchaseMessage,
	createPurchase,
	getPurchaseById,
	setPurchaseStatus,
	type PurchaseStatus,
} from '../../queries/purchase'
import {
	buildPurchaseChannelMessage,
	insufficientFundsMessage,
	NO_ADDRESS_MESSAGE,
	purchaseConfirmModalView,
	PURCHASE_STATUS_ACTION,
	PURCHASE_VIEW_ADDRESS_ACTION,
} from './modals/shop-purchase'
import { formatHCAAddress, getHCAProfile, pickHCAAddress } from '../../utils'

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

	const review = await getReviewById(reviewId)
	const project = review ? await getProjectWithUserById(review.projectId) : null
	const rangeStart = (await getEventStartDate()) ?? null
	const rangeEnd = review?.createdAt ?? new Date()
	const hackatimeHours = (review?.hackatimeSeconds ?? 0) / 3600
	const priorApprovedSeconds = project
		? await getApprovedHackatimeSecondsForProject(project.id)
		: 0
	const priorApprovedHours = priorApprovedSeconds > 0 ? priorApprovedSeconds / 3600 : null

	const modal = await event.respond.modal(
		approveReasonModalView(reviewId, {
			hackatimeProjects: project?.hackatimeProjects ?? [],
			rangeStart,
			rangeEnd,
			hackatimeHours,
			playableUrl: project?.playableUrl ?? null,
			codeUrl: project?.codeUrl ?? null,
			priorApprovedHours,
		}),
	)
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

bot.on(`action:static_select.${SHOP_BUY_ACTION}`, async (event) => {
	const userId = event.event.user.id
	const itemId = (event as any).event?.actions?.[0]?.selected_option?.value as string | undefined
	if (!itemId) return

	const item = await getShopItemById(itemId)
	if (!item || !item.enabled) return

	const balance = (await getUserBalanceMinutes(userId)) ?? 0
	if (balance < item.priceMinutes) {
		await userBot.user(userId).send(insufficientFundsMessage(item, balance))
		return
	}

	const buyer = await getUserById(userId)
	if (!buyer?.hcaToken) {
		await userBot.user(userId).send(NO_ADDRESS_MESSAGE)
		return
	}
	let address = null
	try {
		const profile = await getHCAProfile(buyer.hcaToken)
		address = pickHCAAddress(profile, buyer.selectedHcaAddressId)
	} catch (err) {
		console.error('failed to fetch buyer address for confirm modal', err)
	}
	if (!address) {
		logAudit('shop.purchase.no_address', userId, { itemId })
		await userBot.user(userId).send(NO_ADDRESS_MESSAGE)
		return
	}

	const modal = await event.respond.modal(purchaseConfirmModalView(item, balance, address))
	try {
		await modal.wait.timeout(5 * 60_000).submit()
	} catch {
		return
	}

	const newBalance = await debitUserBalanceIfSufficient(userId, item.priceMinutes)
	if (newBalance === null) {
		logAudit('shop.purchase.race_insufficient', userId, {
			itemId,
			priceMinutes: item.priceMinutes,
		})
		return
	}

	const purchase = await createPurchase({
		userId,
		shopItemId: item.id,
		priceMinutes: item.priceMinutes,
	})

	logAudit('shop.purchase.created', userId, {
		purchaseId: purchase.id,
		itemId: item.id,
		priceMinutes: item.priceMinutes,
		newBalanceMinutes: newBalance,
	})

	const { PURCHASES_CHANNEL } = process.env
	if (PURCHASES_CHANNEL) {
		try {
			const posted = await bot
				.channel(PURCHASES_CHANNEL)
				.send(buildPurchaseChannelMessage(purchase, item))
			if (posted) {
				await attachPurchaseMessage(purchase.id, PURCHASES_CHANNEL, posted.ts)
			}
		} catch (err) {
			console.error('failed to notify purchases channel', err)
		}
	} else {
		console.warn('PURCHASES_CHANNEL not configured; skipping purchase notification')
	}

	try {
		const hours = (item.priceMinutes / 60).toFixed(1).replace(/\.0$/, '')
		const remaining = (newBalance / 60).toFixed(1).replace(/\.0$/, '')
		await userBot.user(userId).send({
			text: `you bought ${item.name}!`,
			blocks: blocks(
				section(
					`you bought *${item.name}* for *${hours}h*!\nan org will follow up to fulfill your prize soon :3`,
				),
				context(`remaining balance: *${remaining}h*`),
			),
		})
	} catch (err) {
		console.error('failed to DM participant about purchase', err)
	}
})

bot.on(`action:static_select.${SETTINGS_ADDRESS_ACTION}`, async (event) => {
	const userId = event.event.user.id
	const addressId = (event as any).event?.actions?.[0]?.selected_option?.value as string | undefined
	if (!addressId) return

	await setSelectedHcaAddressId(userId, addressId)
	logAudit('settings.address.updated', userId, { addressId })

	const refreshed = await buildAddressSettingsMessage(userId)
	if (refreshed.ok) {
		try {
			await event.respond.edit(refreshed.message)
		} catch (err) {
			console.error('failed to edit address settings message', err)
		}
	} else
		await event.respond.message({
			ephemeral: true,
			text: refreshed.text,
		})
})

bot.on(`action:static_select.${PURCHASE_STATUS_ACTION}`, async (event) => {
	const adminId = event.event.user.id
	if (!isAdmin(adminId)) return

	const raw = (event as any).event?.actions?.[0]?.selected_option?.value as string | undefined
	if (!raw) return
	const [purchaseId, nextStatusRaw] = raw.split('|')
	if (!purchaseId || !nextStatusRaw) return
	const nextStatus = nextStatusRaw as PurchaseStatus

	const purchase = await getPurchaseById(purchaseId)
	if (!purchase) return
	if (purchase.status === nextStatus) return

	const item = await getShopItemById(purchase.shopItemId)

	// refund the balance if transitioning into refunded; reverse the credit if leaving refunded
	if (nextStatus === 'refunded' && purchase.status !== 'refunded') {
		await adjustUserBalance(purchase.userId, purchase.priceMinutes)
	} else if (purchase.status === 'refunded' && nextStatus !== 'refunded') {
		await adjustUserBalance(purchase.userId, -purchase.priceMinutes)
	}

	const updated = await setPurchaseStatus(purchaseId, nextStatus)
	if (!updated) return

	logAudit('shop.purchase.status_changed', adminId, {
		purchaseId,
		userId: purchase.userId,
		from: purchase.status,
		to: nextStatus,
	})

	if (purchase.channelId && purchase.messageTs) {
		try {
			await bot
				.channel(purchase.channelId)
				.message(purchase.messageTs)
				.edit(
					buildPurchaseChannelMessage(updated, {
						name: item?.name ?? '(deleted item)',
						description: item?.description ?? '',
					}),
				)
		} catch (err) {
			console.error('failed to edit purchases channel message', err)
		}
	}

	const hours = (purchase.priceMinutes / 60).toFixed(1).replace(/\.0$/, '')
	const itemName = item?.name ?? 'your prize'
	let dm: { text: string; blocks?: any } | null = null
	if (nextStatus === 'fulfilled') {
		dm = {
			text: `${itemName} has been fulfilled!`,
			blocks: blocks(
				section(
					`:yayayayayay: *${itemName}* has been fulfilled! it's on its way to you :doppel-banana:`,
				),
			),
		}
	} else if (nextStatus === 'refunded') {
		dm = {
			text: `${itemName} was refunded`,
			blocks: blocks(
				section(
					`your purchase of *${itemName}* was refunded, and *${hours}h* have been returned to your balance.`,
				),
			),
		}
	} else if (nextStatus === 'pending') {
		dm = {
			text: `${itemName} has been reverted to pending`,
			blocks: blocks(section(`your purchase of *${itemName}* has been reverted to pending.`)),
		}
	}
	if (dm) {
		try {
			await userBot.user(purchase.userId).send(dm)
		} catch (err) {
			console.error('failed to DM purchase status change', err)
		}
	}
})

bot.on(`action:button.${PURCHASE_VIEW_ADDRESS_ACTION}`, async (event) => {
	const adminId = event.event.user.id
	if (!isAdmin(adminId)) return
	const purchaseId = event.value
	if (!purchaseId) return

	const purchase = await getPurchaseById(purchaseId)
	if (!purchase) return

	const target = await getUserById(purchase.userId)
	logAudit('shop.purchase.address_viewed', adminId, {
		purchaseId,
		userId: purchase.userId,
	})

	let body: string
	if (!target?.hcaToken) {
		body = 'user has no HCA token linked.'
	} else {
		try {
			const profile = await getHCAProfile(target.hcaToken)
			const address = pickHCAAddress(profile, target.selectedHcaAddressId)
			body = address
				? `\`\`\`\n${formatHCAAddress(address)}\n\`\`\``
				: 'user has no addresses on file at hack club auth.'
		} catch (err) {
			body = 'failed to fetch address from hack club auth.'
		}
	}

	await event.respond.message({
		text: `<@${purchase.userId}>'s shipping address`,
		blocks: blocks(section(`<@${purchase.userId}>'s shipping address:`), section(body)),
		ephemeral: true,
	})
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
