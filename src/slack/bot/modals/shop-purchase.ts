import { blocks, plain, section } from 'slack.ts'
import type { ShopItem } from '../../../queries/shop-item'

export const PURCHASE_CALLBACK_ID = 'shop.purchase.confirm'

const formatHours = (minutes: number) => (minutes / 60).toFixed(1).replace(/\.0$/, '')

export function purchaseConfirmModalView(item: ShopItem, balanceMinutes: number) {
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
		),
	}
}

export function purchaseInsufficientModalView(item: ShopItem, balanceMinutes: number) {
	return {
		type: 'modal' as const,
		title: plain('not enough hours').build(),
		close: plain('close').build(),
		blocks: blocks(
			section(
				`*${item.name}* costs *${formatHours(item.priceMinutes)}h*, but you only have *${formatHours(balanceMinutes)}h*. ship more projects to buy this item! :doppel-bounce:`,
			),
		),
	}
}
