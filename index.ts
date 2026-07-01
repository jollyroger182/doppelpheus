import { handleWelcome } from './src/api/welcome'
import './src/slack/bot/listeners'
import { app, bot } from './src/slack/client'
import './src/slack/user/listeners'

await app.start()
await bot.start()

Bun.serve({
	routes: {
		'/slack/events': (req) => bot.receiver.fetch(req),
		'/api/welcome': { POST: handleWelcome },
	},
	port: process.env.PORT || '8000',
})

console.log('server started on port', process.env.PORT || '8000')
