import type { AnyBlock } from '@slack/types'
import { actions, blocks, button, divider, header, plain, R, richText, section } from 'slack.ts'
import { getRecentAuditLog } from '../../queries/audit-log'
import { CONFIG_KEYS, isFeatureEnabled } from '../../queries/config'
import { getAllShopItems, type ShopItem } from '../../queries/shop-item'
import { getProgramStats } from '../../queries/stats'

const { ADMIN_USER_IDS } = process.env

const ADMINS = new Set(
	(ADMIN_USER_IDS ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean),
)

export function isAdmin(userId: string) {
	return ADMINS.has(userId)
}

function renderShopItems(items: ShopItem[]) {
	if (!items.length) return [section('_no shop items yet_')]
	return items.flatMap((item) => {
		const priceHours = (item.priceMinutes / 60).toFixed(1).replace(/\.0$/, '')
		const status = item.enabled ? ':white_check_mark: enabled' : ':x: disabled'
		return [
			section(`*${item.name}* _(${priceHours}h)_\n${item.description}\n${status}`),
			actions(
				button('edit').id('admin.shop_item.edit').value(item.id),
				button(item.enabled ? 'disable' : 'enable')
					.style(item.enabled ? 'danger' : 'primary')
					.id('admin.shop_item.toggle')
					.value(item.id),
				button('delete').style('danger').id('admin.shop_item.delete').value(item.id),
			),
		]
	})
}

export async function buildHomeView(userId: string) {
	if (!isAdmin(userId)) {
		return {
			type: 'home' as const,
			blocks: blocks(section('nothing to see here, move on :3')),
		}
	}

	const [stats, shopEnabled, shopItemList, recentLog] = await Promise.all([
		getProgramStats(),
		isFeatureEnabled(CONFIG_KEYS.shopEnabled),
		getAllShopItems(),
		getRecentAuditLog(10),
	])

	return {
		type: 'home' as const,
		blocks: blocks(
			header(plain(':crystal_ball: doppel admin panel').emoji()),
			section(
				`*${stats.totalUsers}*\ntotal users`,
				`*${stats.hcaLinked}*\nHCA linked`,
				`*${stats.hackatimeLinked}*\nhackatime linked`,
				`*${stats.projectCount}*\nprojects`,
				`*${stats.enabledShopItems}*\nenabled shop items`,
			),
			divider(),
			header('feature toggles'),
			section(`shop: ${shopEnabled ? ':white_check_mark: enabled' : ':x: disabled'}`).accessory(
				button(shopEnabled ? 'disable' : 'enable')
					.style(shopEnabled ? 'danger' : 'primary')
					.id('admin.toggle_shop')
					.value(shopEnabled ? 'off' : 'on'),
			),
			divider(),
			header('shop items'),
			...renderShopItems(shopItemList),
			actions(
				button(plain(':heavy_plus_sign: add shop item').emoji())
					.style('primary')
					.id('admin.shop_item.add'),
			),
			divider(),
			header('recent activity'),
			recentLog.length
				? richText(
						R.list(
							...recentLog.map((entry) =>
								R.section(
									R.text(entry.action).bold(),
									...(entry.user ? [R.text(` · `), R.user(entry.user)] : []),
									...(entry.details ? [R.text(` — ${entry.details}`)] : []),
									R.text(` `),
									R.date(entry.createdAt, '({date_pretty} at {time})').fallback(
										entry.createdAt.toISOString(),
									),
								),
							),
						),
					)
				: section('_no activity yet_'),
			divider(),
			actions(
				button(plain(':outbox_tray: upload file as doppel').emoji()).id('admin.upload_file'),
				button(plain(':arrows_counterclockwise: refresh').emoji()).id('admin.refresh_home'),
			),
		),
	}
}
