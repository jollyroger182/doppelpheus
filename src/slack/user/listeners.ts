import { actions, blocks, button, section } from 'slack.ts'
import { getUserWithProjectsById, upsertUser } from '../../queries/user'
import { app, userBot } from '../client'
import { sendHackatimeAuthMessage } from './operations'

const { SLACK_USER_ID, MAIN_CHANNEL, EXTERNAL_URL, HCA_CLIENT_ID } = process.env

app.on('message:normal', async (message) => {
	if (message.user === SLACK_USER_ID) return
	const channel = await message.channel
	if (!channel.is_im) return

	const user = await getUserWithProjectsById(message.user)
	if (!user?.hcaToken) {
		const state = crypto.randomUUID()
		await upsertUser({ id: message.user, authState: state })

		const url = new URL(
			`https://auth.hackclub.com/oauth/authorize?response_type=code&scope=openid+email+name+profile+phone+birthdate+address+verification_status+slack_id+basic_info`,
		)
		url.searchParams.set('client_id', HCA_CLIENT_ID!)
		url.searchParams.set('redirect_uri', `${EXTERNAL_URL}/auth/hackclub/callback`)
		url.searchParams.set('state', state)

		const text = `hi hi! welcome to <#${MAIN_CHANNEL}>! i see that you haven't linked your HCA account yet, click the button below to do that!`
		return userBot.channel(channel.id).send({
			text,
			blocks: blocks(
				section(text),
				actions(button('link hca').style('primary').url(url.toString())),
			),
		})
	}

	if (!user.hackatimeToken) {
		return sendHackatimeAuthMessage(user.id)
	}
})
