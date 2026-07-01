import { getUserByAuthState, upsertUser } from '../../queries/user'
import { app } from '../../slack/client'
import { sendHackatimeAuthMessage } from '../../slack/user/operations'

const { HCA_CLIENT_ID, HCA_CLIENT_SECRET, EXTERNAL_URL } = process.env

export async function handleHCACallback(req: Request) {
	const url = new URL(req.url)
	const code = url.searchParams.get('code')
	const state = url.searchParams.get('state')
	if (!code || !state) return Response.json({ error: 'invalid params' }, 400)

	const user = await getUserByAuthState(state)
	if (!user) return Response.json({ error: 'invalid state' }, 400)

	const resp = await fetch('https://auth.hackclub.com/oauth/token', {
		method: 'POST',
		body: new URLSearchParams({
			client_id: HCA_CLIENT_ID!,
			client_secret: HCA_CLIENT_SECRET!,
			redirect_uri: `${EXTERNAL_URL}/auth/hackclub/callback`,
			code,
			grant_type: 'authorization_code',
		}),
	})
	if (!resp.ok) {
		console.error('failed to exchange hca token', await resp.text())
		return Response.json({ error: 'upstream error' }, 500)
	}
	const { access_token } = (await resp.json()) as { access_token: string }

	await upsertUser({ id: user.id, hcaToken: access_token, authState: null })

	await sendHackatimeAuthMessage(user.id)

	const {
		channel: { id: dmChannelId },
	} = await app.request('conversations.open', { users: user.id })
	return Response.redirect(`https://hackclub.enterprise.slack.com/archives/${dmChannelId}`)
}
