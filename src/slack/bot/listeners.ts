import { blocks, context, section } from 'slack.ts'
import { LINK_HACKATIME_MESSAGE, WELCOME_MESSAGE } from '../../consts'
import { bot } from '../client'

const { SLACK_BOT_USER_ID } = process.env

bot.on('message:normal', async (message) => {
	if (message.user === SLACK_BOT_USER_ID) return
	const channel = await message.channel
	if (!channel.is_im) return

	await message.reply('hi')
})

bot.on('action:button.link_hca', async (event) => {
	await event.respond.edit({
		text: WELCOME_MESSAGE,
		blocks: blocks(
			section(WELCOME_MESSAGE),
			context('need the button again? just send me any message!'),
		),
	})
})

bot.on('action:button.link_hackatime', async (event) => {
	await event.respond.edit({
		text: LINK_HACKATIME_MESSAGE,
		blocks: blocks(
			section(LINK_HACKATIME_MESSAGE),
			context('need the button again? just send me any message!'),
		),
	})
})
