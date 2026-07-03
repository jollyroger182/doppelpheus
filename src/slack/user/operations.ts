import { actions, blocks, button, plain, section } from 'slack.ts'
import {
	ALL_SET_MESSAGE,
	LINK_HACKATIME_MESSAGE,
	WELCOME_BACK_MESSAGE,
	WELCOME_MESSAGE,
} from '../../consts'
import { logAudit } from '../../queries/audit-log'
import { createAuthAttempt } from '../../queries/auth-attempt'
import { getUploadedFileId } from '../../queries/uploaded-file'
import { createUser } from '../../queries/user'
import { userBot } from '../client'

const { HCA_CLIENT_ID, HACKATIME_CLIENT_ID, EXTERNAL_URL } = process.env

export async function sendHCAAuthMessage(user: string) {
	await createUser(user)
	const { id: state } = await createAuthAttempt(user)
	logAudit('auth.hca.message_sent', user, { state })

	const url = new URL(
		`https://auth.hackclub.com/oauth/authorize?response_type=code&scope=openid+email+name+profile+phone+birthdate+address+verification_status+slack_id+basic_info`,
	)
	url.searchParams.set('client_id', HCA_CLIENT_ID!)
	url.searchParams.set('redirect_uri', `${EXTERNAL_URL}/auth/hackclub/callback`)
	url.searchParams.set('state', state)

	const welcomeImageId = await getUploadedFileId('welcome')

	return userBot.user(user).send({
		text: WELCOME_MESSAGE,
		blocks: [
			...(welcomeImageId
				? [
						{
							type: 'image' as const,
							title: plain('welcome :3').build(),
							slack_file: { id: welcomeImageId },
							alt_text: 'welcome :3',
						},
					]
				: []),
			...blocks(
				section(WELCOME_MESSAGE),
				actions(
					button('link hca').style('primary').url(url.toString()).id('link_hca').value(state),
				),
			),
		],
	})
}

export async function sendHackatimeAuthMessage(user: string) {
	const { id: state } = await createAuthAttempt(user)
	logAudit('auth.hackatime.message_sent', user, { state })

	const url = new URL(
		`https://hackatime.hackclub.com/oauth/authorize?response_type=code&scope=profile+read`,
	)
	url.searchParams.set('client_id', HACKATIME_CLIENT_ID!)
	url.searchParams.set('redirect_uri', `${EXTERNAL_URL}/auth/hackatime/callback`)
	url.searchParams.set('state', state)

	await userBot.user(user).send({
		text: LINK_HACKATIME_MESSAGE,
		blocks: blocks(
			section(LINK_HACKATIME_MESSAGE),
			actions(
				button('link hackatime')
					.style('primary')
					.url(url.toString())
					.id('link_hackatime')
					.value(state),
			),
		),
	})
}

export async function sendIneligibleMessage(user: string) {
	await userBot
		.user(user)
		.send(
			`aww, it seems you haven't verified your identity yet or you're ineligible for ysws... check https://auth.hackclub.com for more info!`,
		)
}

export async function sendAllSetMessage(user: string) {
	await userBot.user(user).send(ALL_SET_MESSAGE)
}

export async function sendWelcomeBackMessage(user: string) {
	await userBot.user(user).send(WELCOME_BACK_MESSAGE)
}
