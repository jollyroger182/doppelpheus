import { actions, blocks, button, section } from 'slack.ts'
import { createAuthAttempt } from '../../queries/auth-attempt'
import { getUserWithProjectsById } from '../../queries/user'
import { app, userBot } from '../client'
import { sendHackatimeAuthMessage, sendHCAAuthMessage } from './operations'

const { SLACK_USER_ID, MAIN_CHANNEL, EXTERNAL_URL, HCA_CLIENT_ID } = process.env

app.on('message:normal', async (message) => {
	if (message.user === SLACK_USER_ID) return
	const channel = await message.channel
	if (!channel.is_im) return

	const user = await getUserWithProjectsById(message.user)
	if (!user?.hcaToken) {
		return sendHCAAuthMessage(message.user)
	}

	if (!user.hackatimeToken) {
		return sendHackatimeAuthMessage(user.id)
	}
})
