import { logAudit } from '../../queries/audit-log'
import { getUserWithProjectsById } from '../../queries/user'
import { app, userBot } from '../client'
import { findKeywordHandler } from './keywords'
import { sendHackatimeAuthMessage, sendHCAAuthMessage, sendWelcomeBackMessage } from './operations'

const { SLACK_USER_ID, SLACK_BOT_USER_ID, MAIN_CHANNEL } = process.env

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

app.on('event:member_joined_channel', async (event) => {
	if (event.payload.channel !== MAIN_CHANNEL) return

	await userBot.channel(event.payload.channel).send({
		text: `haiii <@${event.payload.user}>! i'm so excited you're here!! check your dms, i sent you a welcome message :3`,
		ephemeral: true,
		user: event.payload.user,
	})

	const user = await getUserWithProjectsById(event.payload.user)
	if (user?.hackatimeToken) {
		await sendWelcomeBackMessage(event.payload.user)
	} else if (user?.hcaToken) {
		await sendHackatimeAuthMessage(event.payload.user)
	} else {
		await sendHCAAuthMessage(event.payload.user)
	}
})
