import { getUserWithProjectsById } from '../../queries/user'
import { app } from '../client'
import { sendHackatimeAuthMessage, sendHCAAuthMessage } from './operations'

const { SLACK_USER_ID } = process.env

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
