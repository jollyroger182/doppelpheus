import type { ConfirmationDialog } from '@slack/types'
import type { button } from 'slack.ts'

type ButtonBuilder = ReturnType<typeof button>

// slack.ts's button builder doesn't expose Slack's `confirm` field, so patch
// the built object after the fact.
export function withConfirm(btn: ButtonBuilder, dialog: ConfirmationDialog): ButtonBuilder {
	const originalBuild = btn.build.bind(btn)
	btn.build = () => ({ ...originalBuild(), confirm: dialog })
	return btn
}
