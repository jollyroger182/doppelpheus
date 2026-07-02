import { blocks, checkboxes, input, numberInput, option, plain, plainTextInput } from 'slack.ts'
import { logAudit } from '../../../queries/audit-log'
import {
	createShopItem,
	getShopItemById,
	updateShopItem,
	type ShopItem,
} from '../../../queries/shop-item'

export const NAME_BLOCK = 'shop_item.name'
export const NAME_ACTION = 'name'
export const DESC_BLOCK = 'shop_item.description'
export const DESC_ACTION = 'description'
export const PRICE_BLOCK = 'shop_item.price_hours'
export const PRICE_ACTION = 'price_hours'
export const ENABLED_BLOCK = 'shop_item.enabled'
export const ENABLED_ACTION = 'enabled'

const ENABLED_OPTION_VALUE = 'enabled' as const

export function shopItemModalView(item?: ShopItem) {
	const isEdit = !!item
	return {
		type: 'modal' as const,
		private_metadata: isEdit ? item!.id : '',
		title: plain(isEdit ? 'edit shop item' : 'add shop item').build(),
		submit: plain(isEdit ? 'save' : 'create').build(),
		close: plain('cancel').build(),
		blocks: blocks(
			input(
				plainTextInput()
					.id(NAME_ACTION)
					.placeholder('custom pfp')
					.default(item?.name ?? ''),
			)
				.label('name')
				.id(NAME_BLOCK),
			input(
				plainTextInput()
					.multiline()
					.id(DESC_ACTION)
					.placeholder('what does the prize include?')
					.default(item?.description ?? ''),
			)
				.label('description')
				.id(DESC_BLOCK),
			input(
				numberInput()
					.decimal()
					.min(0)
					.id(PRICE_ACTION)
					.placeholder('3')
					.default(item ? item.priceMinutes / 60 : 0),
			)
				.label('price (hours)')
				.hint('cost to unlock, in hours')
				.id(PRICE_BLOCK),
			input(checkboxes(option('enabled').value(ENABLED_OPTION_VALUE)).id(ENABLED_ACTION).default(
				...(item?.enabled ? [ENABLED_OPTION_VALUE] : []),
			))
				.label('visibility')
				.optional()
				.id(ENABLED_BLOCK),
		),
	}
}

export interface ShopItemFormValues {
	name: string
	description: string
	priceMinutes: number
	enabled: boolean
}

export function extractShopItemFormValues(
	values: Record<string, Record<string, any>>,
): ShopItemFormValues | { error: string } {
	const name: string = (values[NAME_BLOCK]?.[NAME_ACTION]?.value ?? '').trim()
	const description: string = (values[DESC_BLOCK]?.[DESC_ACTION]?.value ?? '').trim()
	const priceRaw: string = values[PRICE_BLOCK]?.[PRICE_ACTION]?.value ?? ''
	const enabledOpts: Array<{ value: string }> =
		values[ENABLED_BLOCK]?.[ENABLED_ACTION]?.selected_options ?? []

	const priceHours = Number(priceRaw)
	if (!Number.isFinite(priceHours) || priceHours < 0) {
		return { error: 'invalid price' }
	}

	return {
		name,
		description,
		priceMinutes: Math.round(priceHours * 60),
		enabled: enabledOpts.some((o) => o.value === ENABLED_OPTION_VALUE),
	}
}

export async function upsertShopItemFromForm(
	userId: string,
	itemId: string | null,
	form: ShopItemFormValues,
) {
	if (itemId === null) {
		const created = await createShopItem({
			name: form.name,
			description: form.description,
			priceMinutes: form.priceMinutes,
			enabled: form.enabled,
		})
		logAudit('admin.shop_item.created', userId, { id: created.id, name: created.name })
		return created
	}
	const updated = await updateShopItem(itemId, {
		name: form.name,
		description: form.description,
		priceMinutes: form.priceMinutes,
		enabled: form.enabled,
	})
	logAudit('admin.shop_item.updated', userId, { id: itemId })
	return updated
}

export async function getShopItemForAdmin(itemId: string) {
	return getShopItemById(itemId)
}
