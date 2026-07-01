import { app } from './slack/client'

export async function redirectToDM(user: string) {
	const {
		channel: { id: dmChannelId },
	} = await app.request('conversations.open', { users: user })
	return Response.redirect(`https://hackclub.enterprise.slack.com/archives/${dmChannelId}`)
}
