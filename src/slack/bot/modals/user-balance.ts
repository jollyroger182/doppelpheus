import { blocks, input, numberInput, plain, plainTextInput, section, select } from 'slack.ts'
import { logAudit } from '../../../queries/audit-log'
import { adjustUserBalance, getUserBalanceMinutes } from '../../../queries/user'

export const USER_BLOCK = 'user_balance.user_id'
export const USER_ACTION = 'user_id'
export const DELTA_BLOCK = 'user_balance.delta_hours'
export const DELTA_ACTION = 'delta_hours'
export const REASON_BLOCK = 'user_balance.reason'
export const REASON_ACTION = 'reason'

export function userBalanceModalView() {
	return {
		type: 'modal' as const,
		callback_id: 'admin.user_balance.adjust',
		title: plain('adjust user balance').build(),
		submit: plain('apply').build(),
		close: plain('cancel').build(),
		blocks: blocks(
			section("adjust a user's hour balance. use a negative value to deduct."),
			input(select().users().id(USER_ACTION)).label('slack user').id(USER_BLOCK),
			input(numberInput().decimal().id(DELTA_ACTION).placeholder('1.5'))
				.label('delta (hours)')
				.hint('positive to credit, negative to deduct')
				.id(DELTA_BLOCK),
			input(plainTextInput().multiline().id(REASON_ACTION).placeholder('why?'))
				.label('reason')
				.id(REASON_BLOCK),
		),
	}
}

export interface UserBalanceFormValues {
	userId: string
	deltaMinutes: number
	reason: string
}

export function extractUserBalanceFormValues(
	values: Record<string, Record<string, any>>,
): UserBalanceFormValues | { error: string } {
	const userId: string = (values[USER_BLOCK]?.[USER_ACTION]?.selected_user ?? '').trim()
	const deltaRaw: string = values[DELTA_BLOCK]?.[DELTA_ACTION]?.value ?? ''
	const reason: string = (values[REASON_BLOCK]?.[REASON_ACTION]?.value ?? '').trim()

	if (!userId) return { error: 'missing user id' }
	const deltaHours = Number(deltaRaw)
	if (!Number.isFinite(deltaHours) || deltaHours === 0) return { error: 'invalid delta' }
	if (!reason) return { error: 'missing reason' }

	return {
		userId,
		deltaMinutes: Math.round(deltaHours * 60),
		reason,
	}
}

export async function applyUserBalanceAdjustment(adminId: string, form: UserBalanceFormValues) {
	const newBalance = await adjustUserBalance(form.userId, form.deltaMinutes)
	logAudit('user.balance.adjust', adminId, {
		userId: form.userId,
		deltaMinutes: form.deltaMinutes,
		reason: form.reason,
		newBalanceMinutes: newBalance,
	})
	return newBalance
}

export { getUserBalanceMinutes }
