import { actions, blocks, button, context, option, plain, section, select } from 'slack.ts'
import type { Purchase, PurchaseStatus } from '../../../queries/purchase'
import type { ShopItem } from '../../../queries/shop-item'
import { formatHCAAddress, type HCAAddress } from '../../../utils'

export const PURCHASE_CALLBACK_ID = 'shop.purchase.confirm'
export const PURCHASE_STATUS_ACTION = 'purchase.status'
export const PURCHASE_VIEW_ADDRESS_ACTION = 'purchase.view_address'

const STATUS_OPTIONS: { value: PurchaseStatus; label: string }[] = [
	{ value: 'pending', label: 'pending' },
	{ value: 'fulfilled', label: 'fulfilled' },
	{ value: 'refunded', label: 'refunded' },
]

export function buildPurchaseChannelMessage(
	purchase: Purchase,
	item: Pick<ShopItem, 'name' | 'description'>,
) {
	const hours = formatHours(purchase.priceMinutes)
	const statusPicker = select(
		...STATUS_OPTIONS.map((o) => option(o.label, `${purchase.id}|${o.value}`)),
	)
		.id(PURCHASE_STATUS_ACTION)
		.default(`${purchase.id}|${purchase.status}`)
	return {
		text: `<@${purchase.userId}> bought *${item.name}* (${hours}h)`,
		blocks: blocks(
			section(
				`:shopping_bags: <@${purchase.userId}> bought *${item.name}* — *${hours}h*\n_${item.description}_`,
			),
			context(`purchase id: \`${purchase.id}\``, `status: \`${purchase.status}\``),
			actions(
				statusPicker,
				button('view address').id(PURCHASE_VIEW_ADDRESS_ACTION).value(purchase.id),
			),
		),
	}
}

const formatHours = (minutes: number) => (minutes / 60).toFixed(1).replace(/\.0$/, '')

export function purchaseConfirmModalView(
	item: ShopItem,
	balanceMinutes: number,
	address: HCAAddress,
) {
	const afterMinutes = balanceMinutes - item.priceMinutes
	return {
		type: 'modal' as const,
		callback_id: PURCHASE_CALLBACK_ID,
		private_metadata: item.id,
		title: plain('confirm purchase').build(),
		submit: plain('buy').build(),
		close: plain('cancel').build(),
		blocks: blocks(
			section(`are you sure you want to buy *${item.name}* (${formatHours(item.priceMinutes)}h)?`),
			section(
				`current balance: *${formatHours(balanceMinutes)}h*\nafter purchase: *${formatHours(afterMinutes)}h*`,
			),
			section(`shipping to:\n\`\`\`\n${formatHCAAddress(address)}\n\`\`\``),
		),
	}
}

export const NO_ADDRESS_MESSAGE =
	'you need a shipping address before you can buy prizes! add one at <https://auth.hackclub.com/addresses|hack club auth>, then try again :3'

export function insufficientFundsMessage(item: ShopItem, balanceMinutes: number) {
	return `*${item.name}* costs *${formatHours(item.priceMinutes)}h*, but you only have *${formatHours(balanceMinutes)}h*. ship more projects to buy this item! :doppel-bounce:`
}
