import { blocks, input, plain, plainTextInput, section } from 'slack.ts'

export const REJECT_REASON_BLOCK = 'review.reject.reason'
export const REJECT_REASON_ACTION = 'reason'

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
				.label('reason')
				.id(REJECT_REASON_BLOCK),
		),
	}
}

export function extractRejectReason(values: Record<string, Record<string, any>>): string {
	const raw: string = values[REJECT_REASON_BLOCK]?.[REJECT_REASON_ACTION]?.value ?? ''
	return raw.trim()
}
