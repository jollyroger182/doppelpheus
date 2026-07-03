import { blocks, datePicker, input, plain, section } from 'slack.ts'

export const EVENT_START_BLOCK = 'admin.event_start.date'
export const EVENT_START_ACTION = 'date'

export function eventStartModalView(current: Date | null) {
	return {
		type: 'modal' as const,
		title: plain('event start date').build(),
		submit: plain('save').build(),
		close: plain('cancel').build(),
		blocks: blocks(
			section(
				'hackatime hours for each project review are counted starting here (until the previous review, if any).',
			),
			input(
				current
					? datePicker().id(EVENT_START_ACTION).default(current)
					: datePicker().id(EVENT_START_ACTION),
			)
				.label('start date')
				.id(EVENT_START_BLOCK),
		),
	}
}

export function extractEventStartDate(
	values: Record<string, Record<string, any>>,
): string | null {
	const raw: string = values[EVENT_START_BLOCK]?.[EVENT_START_ACTION]?.selected_date ?? ''
	return raw.trim() || null
}
