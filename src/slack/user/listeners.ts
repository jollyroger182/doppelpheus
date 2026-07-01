import { app } from '../client'

const { SLACK_USER_ID } = process.env

app.on('message:normal', async (message) => {
	if (message.user === SLACK_USER_ID) return
	const channel = await message.channel
	if (!channel.is_im) return

	await message.reply('hi')
})
