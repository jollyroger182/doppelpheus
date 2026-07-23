import { blocks, button, context, divider, plain, section } from 'slack.ts'
import type { PurchaseWithUser } from '../../../queries/purchase'
import type { ShopItem } from '../../../queries/shop-item'

export const PURCHASE_LIST_VIEW_ADDRESS_ACTION = 'purchase_list.view_address'

export interface PurchaseListRow {
	purchase: PurchaseWithUser
	email: string | null
}

export function purchaseListModalView(item: ShopItem, rows: PurchaseListRow[]) {
	return {
		type: 'modal' as const,
		title: plain(item.name).build(),
		close: plain('close').build(),
		blocks: blocks(
			section(`*${item.name}* — *${rows.length}* pending purchase${rows.length === 1 ? '' : 's'}`),
			divider(),
			...(rows.length
				? rows.flatMap(({ purchase, email }) => [
						section(`<@${purchase.userId}>\n${email ?? '_no email on file_'}`).accessory(
							button('address').id(PURCHASE_LIST_VIEW_ADDRESS_ACTION).value(purchase.id),
						),
						context(`purchase id: \`${purchase.id}\``),
					])
				: [section('_no pending purchases_')]),
		),
	}
}

export function purchaseAddressModalView(userId: string, body: string) {
	return {
		type: 'modal' as const,
		title: plain('shipping address').build(),
		close: plain('close').build(),
		blocks: blocks(section(`<@${userId}>'s shipping address:`), section(body)),
	}
}
