import { actions, blocks, button, section } from 'slack.ts'
import { userBot } from '../client'
import { upsertUser } from '../../queries/user'

const { HACKATIME_CLIENT_ID, EXTERNAL_URL } = process.env

export async function sendHackatimeAuthMessage(user: string) {
	const state = crypto.randomUUID()
	await upsertUser({ id: user, authState: state })

	const url = new URL(
		`https://hackatime.hackclub.com/oauth/authorize?response_type=code&scope=profile+read`,
	)
	url.searchParams.set('client_id', HACKATIME_CLIENT_ID!)
	url.searchParams.set('redirect_uri', `${EXTERNAL_URL}/auth/hackatime/callback`)
	url.searchParams.set('state', state)

	const text = `now that your HCA is linked, let's link your hackatime account! this lets us see how many hours you've been working on your project :D`
	await userBot.user(user).send({
		text,
		blocks: blocks(
			section(text),
			actions(button('link hackatime').style('primary').url(url.toString())),
		),
	})
}
