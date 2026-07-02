import { actions, blocks, button, divider, header, plain, R, richText, section } from 'slack.ts'
import { getRecentAuditLog } from '../../queries/audit-log'
import { CONFIG_KEYS, isFeatureEnabled } from '../../queries/config'
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

export async function buildHomeView(userId: string) {
	if (!isAdmin(userId)) {
		return {
			type: 'home' as const,
			blocks: blocks(section('nothing to see here, move on :3')),
		}
	}

	const [stats, shopEnabled, recentLog] = await Promise.all([
		getProgramStats(),
		isFeatureEnabled(CONFIG_KEYS.shopEnabled),
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
			header('recent activity'),
			recentLog.length
				? richText(
						R.list(
							...recentLog.map((entry) =>
								R.section(
									R.text(entry.action).bold(),
									entry.user ? R.text(` · ${entry.user}`) : R.text(''),
									entry.details ? R.text(` — ${entry.details}`) : R.text(''),
									R.text(` (${entry.createdAt.toISOString()})`),
								),
							),
						),
					)
				: section('_no activity yet_'),
			divider(),
			actions(button(plain(':arrows_counterclockwise: refresh').emoji()).id('admin.refresh_home')),
		),
	}
}
