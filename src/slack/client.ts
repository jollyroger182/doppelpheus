import { App } from 'slack.ts'

const { SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, PORT = '8000' } = process.env
if (!SLACK_BOT_TOKEN || !SLACK_SIGNING_SECRET) {
	throw new Error('Slack environment variables not configured correctly')
}

export const app = new App({
	token: SLACK_BOT_TOKEN,
	receiver: { type: 'http', signingSecret: SLACK_SIGNING_SECRET, port: Number(PORT) },
})
