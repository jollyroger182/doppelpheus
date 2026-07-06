import { blocks, input, numberInput, plain, plainTextInput, section } from 'slack.ts'

export const REJECT_REASON_BLOCK = 'review.reject.reason'
export const REJECT_REASON_ACTION = 'reason'
export const REJECT_JUSTIFICATION_BLOCK = 'review.reject.justification'
export const REJECT_JUSTIFICATION_ACTION = 'justification'
export const REJECT_HOURS_BLOCK = 'review.reject.hours'
export const REJECT_HOURS_ACTION = 'hours'

export function rejectReasonModalView(reviewId: string) {
	return {
		type: 'modal' as const,
		private_metadata: reviewId,
		title: plain('reject submission').build(),
		submit: plain('send').build(),
		close: plain('cancel').build(),
		blocks: blocks(
			section('the reason will be sent to the participant so they know what to fix.'),
			input(
				plainTextInput()
					.multiline()
					.id(REJECT_REASON_ACTION)
					.placeholder('what needs to change before we can ship this?'),
			)
				.label('reason (sent to participant)')
				.id(REJECT_REASON_BLOCK),
			input(
				plainTextInput()
					.multiline()
					.id(REJECT_JUSTIFICATION_ACTION)
					.placeholder('notes only reviewers will see'),
			)
				.label('justification (private)')
				.optional()
				.id(REJECT_JUSTIFICATION_BLOCK),
			input(numberInput().decimal().id(REJECT_HOURS_ACTION))
				.label('hour adjustment (private)')
				.hint('positive or negative hours to add on top of the auto-counted total')
				.optional()
				.id(REJECT_HOURS_BLOCK),
		),
	}
}

export interface RejectDecisionValues {
	reason: string
	justification: string | null
	hoursAdjustment: number | null
}

export function extractRejectDecision(
	values: Record<string, Record<string, any>>,
): RejectDecisionValues {
	const reason: string = (values[REJECT_REASON_BLOCK]?.[REJECT_REASON_ACTION]?.value ?? '').trim()
	const justificationRaw: string = (
		values[REJECT_JUSTIFICATION_BLOCK]?.[REJECT_JUSTIFICATION_ACTION]?.value ?? ''
	).trim()
	const hoursRaw: string =
		values[REJECT_HOURS_BLOCK]?.[REJECT_HOURS_ACTION]?.value ?? ''
	const hoursAdjustment = hoursRaw.trim() ? Number(hoursRaw) : null
	return {
		reason,
		justification: justificationRaw || null,
		hoursAdjustment: hoursAdjustment !== null && Number.isFinite(hoursAdjustment) ? hoursAdjustment : null,
	}
}
