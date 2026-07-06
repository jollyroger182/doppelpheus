import { db } from '../db'
import { config } from '../db/schema'

export async function getConfig(key: string): Promise<string | undefined> {
	const row = await db.query.config.findFirst({ where: { key } })
	return row?.value
}

export async function setConfig(key: string, value: string) {
	await db
		.insert(config)
		.values({ key, value })
		.onConflictDoUpdate({ target: config.key, set: { value } })
}

export async function isFeatureEnabled(key: string): Promise<boolean> {
	return (await getConfig(key)) === 'true'
}

export const CONFIG_KEYS = {
	shopEnabled: 'shop_enabled',
	eventStartDate: 'event_start_date',
} as const

export async function getEventStartDate(): Promise<Date | null> {
	const raw = await getConfig(CONFIG_KEYS.eventStartDate)
	if (!raw) return null
	const parsed = new Date(raw)
	return Number.isNaN(parsed.getTime()) ? null : parsed
}
