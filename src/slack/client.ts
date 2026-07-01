import { App } from 'slack.ts'

const { SLACK_BOT_TOKEN, SLACK_XOXC_TOKEN, SLACK_XOXD_TOKEN, SLACK_SIGNING_SECRET } = process.env
if (!SLACK_BOT_TOKEN || !SLACK_XOXC_TOKEN || !SLACK_XOXD_TOKEN || !SLACK_SIGNING_SECRET) {
	throw new Error('Slack environment variables not configured correctly')
}

export const app = new App({
	token: { cookie: SLACK_XOXD_TOKEN, token: SLACK_XOXC_TOKEN },
	receiver: { type: 'rtm' },
})

export const bot = new App({
	token: SLACK_BOT_TOKEN,
	receiver: { type: 'fetch', signingSecret: SLACK_SIGNING_SECRET },
})
