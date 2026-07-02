import { logAudit } from '../../queries/audit-log'
import { getUserWithProjectsById } from '../../queries/user'
import { app } from '../client'
import { findKeywordHandler } from './keywords'
import { sendHackatimeAuthMessage, sendHCAAuthMessage } from './operations'

const { SLACK_USER_ID, SLACK_BOT_USER_ID } = process.env

app.on('message:normal', async (message) => {
	if (message.user === SLACK_USER_ID || message.user === SLACK_BOT_USER_ID) return
	const channel = await message.channel
	if (!channel.is_im) return

	logAudit('slack.user.dm_received', message.user, { text: message.text })

	const user = await getUserWithProjectsById(message.user)
	if (!user?.hcaToken) {
		return sendHCAAuthMessage(message.user)
	}

	if (!user.hackatimeToken) {
		return sendHackatimeAuthMessage(user.id)
	}

	const handler = findKeywordHandler(message.text ?? '')
	await handler.send(user.id)
})
