import { bot } from '../client'

const { SLACK_BOT_USER_ID } = process.env

bot.on('message:normal', async (message) => {
	if (message.user === SLACK_BOT_USER_ID) return
	const channel = await message.channel
	if (!channel.is_im) return

	await message.reply('hi')
})
