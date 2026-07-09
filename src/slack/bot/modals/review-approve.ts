import { blocks, input, numberInput, plain, plainTextInput, section } from 'slack.ts'

export const APPROVE_JUSTIFICATION_BLOCK = 'review.approve.justification'
export const APPROVE_JUSTIFICATION_ACTION = 'justification'
export const APPROVE_HOURS_BLOCK = 'review.approve.hours'
export const APPROVE_HOURS_ACTION = 'hours'

export interface JustificationContext {
	hackatimeProjects: string[]
	rangeStart: Date | null
	rangeEnd: Date
	hackatimeHours: number
	playableUrl: string | null
	codeUrl: string | null
	priorApprovedHours: number | null
}

function formatDate(d: Date): string {
	return d.toISOString().slice(0, 10)
}

function buildJustificationTemplate(ctx: JustificationContext): string {
	const projectList = ctx.hackatimeProjects.length ? ctx.hackatimeProjects.join(', ') : 'TODO'
	const rangeStart = ctx.rangeStart ? formatDate(ctx.rangeStart) : 'TODO'
	const rangeEnd = formatDate(ctx.rangeEnd)
	const hours = ctx.hackatimeHours.toFixed(1)

	const lines = [
		`Hackatime project list: ${projectList}. Heartbeats analyzed from ${rangeStart} to ${rangeEnd} for ${hours} hours. Heartbeat pattern is consistent with active development. ${hours} hours approved.`,
	]
	if (ctx.priorApprovedHours !== null) {
		const prior = ctx.priorApprovedHours.toFixed(1)
		const total = (ctx.priorApprovedHours + ctx.hackatimeHours).toFixed(1)
		lines.push(
			`This project is an update. ${prior} hours were approved in earlier ship(s); this update adds ${hours} new hours for a running total of ${total} hours.`,
		)
	}
	return lines.join('\n')
}

export function approveReasonModalView(reviewId: string, ctx: JustificationContext) {
	const template = buildJustificationTemplate(ctx)
	return {
		type: 'modal' as const,
		private_metadata: reviewId,
		title: plain('approve submission').build(),
		submit: plain('approve').build(),
		close: plain('cancel').build(),
		blocks: blocks(
			section('these fields are optional and only visible to reviewers.'),
			input(
				plainTextInput()
					.multiline()
					.id(APPROVE_JUSTIFICATION_ACTION)
					.default(template)
					.placeholder('why is this getting approved? (this is sent to airtable so be specific)'),
			)
				.label('justification (private)')
				.id(APPROVE_JUSTIFICATION_BLOCK),
			input(numberInput().decimal().id(APPROVE_HOURS_ACTION))
				.label('hour adjustment (private)')
				.hint('positive or negative hours to add on top of the auto-counted total')
				.optional()
				.id(APPROVE_HOURS_BLOCK),
		),
	}
}

export interface ApproveDecisionValues {
	justification: string
	hoursAdjustment: number | null
}

export function extractApproveDecision(
	values: Record<string, Record<string, any>>,
): ApproveDecisionValues {
	const justificationRaw: string = (
		values[APPROVE_JUSTIFICATION_BLOCK]?.[APPROVE_JUSTIFICATION_ACTION]?.value ?? ''
	).trim()
	const hoursRaw: string = values[APPROVE_HOURS_BLOCK]?.[APPROVE_HOURS_ACTION]?.value ?? ''
	const hoursAdjustment = hoursRaw.trim() ? Number(hoursRaw) : null
	return {
		justification: justificationRaw,
		hoursAdjustment:
			hoursAdjustment !== null && Number.isFinite(hoursAdjustment) ? hoursAdjustment : null,
	}
}
