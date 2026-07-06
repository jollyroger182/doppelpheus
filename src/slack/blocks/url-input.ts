import type { InputBlock, URLInput } from '@slack/types'

interface UrlInputOptions {
	blockId: string
	actionId: string
	label: string
	hint?: string
	placeholder?: string
	initial?: string | null
	optional?: boolean
}

// slack.ts (as of 0.0.22) doesn't ship a `urlInput()` builder; hand-roll one so
// we get Slack's built-in URL validation in the participant modal, and expose it
// with the same `.build()` shape slack.ts's `blocks(...)` helper expects.
class UrlInputBlockBuilder {
	constructor(private opts: UrlInputOptions) {}

	build(): InputBlock {
		const element: URLInput = {
			type: 'url_text_input',
			action_id: this.opts.actionId,
			...(this.opts.initial ? { initial_value: this.opts.initial } : {}),
			...(this.opts.placeholder
				? { placeholder: { type: 'plain_text', text: this.opts.placeholder } }
				: {}),
		}
		return {
			type: 'input',
			block_id: this.opts.blockId,
			element,
			label: { type: 'plain_text', text: this.opts.label },
			...(this.opts.hint
				? { hint: { type: 'plain_text', text: this.opts.hint } }
				: {}),
			...(this.opts.optional !== undefined ? { optional: this.opts.optional } : {}),
		}
	}
}

export function urlInputBlock(opts: UrlInputOptions) {
	return new UrlInputBlockBuilder(opts)
}

export function extractUrlValue(
	values: Record<string, Record<string, any>>,
	blockId: string,
	actionId: string,
): string {
	return (values[blockId]?.[actionId]?.value ?? '').toString().trim()
}
