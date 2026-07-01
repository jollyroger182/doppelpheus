import { actions, blocks, button, section } from 'slack.ts'
import { createAuthAttempt } from '../../queries/auth-attempt'
import { userBot } from '../client'
import { createUser } from '../../queries/user'

const { HCA_CLIENT_ID, MAIN_CHANNEL, HACKATIME_CLIENT_ID, EXTERNAL_URL } = process.env

export async function sendHCAAuthMessage(user: string) {
	await createUser(user)
	const { id: state } = await createAuthAttempt(user)

	const url = new URL(
		`https://auth.hackclub.com/oauth/authorize?response_type=code&scope=openid+email+name+profile+phone+birthdate+address+verification_status+slack_id+basic_info`,
	)
	url.searchParams.set('client_id', HCA_CLIENT_ID!)
	url.searchParams.set('redirect_uri', `${EXTERNAL_URL}/auth/hackclub/callback`)
	url.searchParams.set('state', state)

	const text = `hi hi! welcome to <#${MAIN_CHANNEL}>! i see that you haven't linked your HCA account yet, click the button below to do that!`
	return userBot.user(user).send({
		text,
		blocks: blocks(section(text), actions(button('link hca').style('primary').url(url.toString()))),
	})
}

export async function sendHackatimeAuthMessage(user: string) {
	const { id: state } = await createAuthAttempt(user)

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
