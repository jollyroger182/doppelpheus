import { blocks, context, R, richText, section } from 'slack.ts'
import { userBot } from '../client'
import { FAQ_CANVAS } from '../../consts'
import { CONFIG_KEYS, isFeatureEnabled } from '../../queries/config'
import { getEnabledShopItems } from '../../queries/shop-item'
import { buildProjectsView } from './views/projects'

const SHOP_NOT_READY_MESSAGE = 'the prizes are not ready yet! please check back later :3'

const { MAIN_CHANNEL } = process.env

export interface KeywordHandler {
	keywords: string[]
	send: (userId: string) => Promise<unknown>
}

export const keywordHandlers: KeywordHandler[] = [
	{
		keywords: ['help'],
		send: async (userId) => {
			return userBot.user(userId).send({
				text: `hello there human i hear you are in need of help? i'm doppel from <#${MAIN_CHANNEL}> and here's what i can do:`,
				blocks: blocks(
					richText(
						R.section("hello there human i hear you are in need of help? i'm doppel from ", R.channel(MAIN_CHANNEL!), " and here's what i can do:"),
						R.list(
							R.section(R.text('projects').bold(), ' to see your projects'),
							R.section(R.text('prizes').bold(), ' to browse prizes'),
							R.section(R.text('settings').bold(), ' to change your preferences'),
							R.section(R.text('help').bold(), ' to view this message!'),
						),
					),
					context(`forgot what doppel is? check out <${FAQ_CANVAS}|this canvas>!`),
				),
			})
		},
	},
	{
		keywords: ['projects', 'project'],
		send: async (userId) => userBot.user(userId).send(await buildProjectsView(userId)),
	},
	{
		keywords: ['shop', 'prizes', 'prize'],
		send: async (userId) => {
			if (!(await isFeatureEnabled(CONFIG_KEYS.shopEnabled))) {
				return userBot.user(userId).send(SHOP_NOT_READY_MESSAGE)
			}

			const items = await getEnabledShopItems()

			if (!items.length) {
				return userBot.user(userId).send(SHOP_NOT_READY_MESSAGE)
			}

			const text = 'the current prizes are here! this list might be updated throughout the event :3'
			return userBot.user(userId).send({
				text,
				blocks: blocks(
					section(text),
					richText(
						R.list(
							...items.map((i) =>
								R.section(
									R.text(i.name).bold(),
									` (${(i.priceMinutes / 60).toFixed(1)}h): ${i.description}`,
								),
							),
						),
					),
				),
			})
		},
	},
	{
		keywords: ['blahaj'],
		send: async (userId) => {
			return userBot.user(userId).send({
				text: `<3`,
			})
		},
	},
]

export const sendUnknownKeyword = (userId: string) =>
	userBot.user(userId).send("aaa i don't know what that is :( try `help` to see what i can do!")

export function findKeywordHandler(text: string): KeywordHandler {
	const lower = text.toLowerCase()
	return (
		keywordHandlers.find((h) => h.keywords.some((k) => lower.includes(k))) || {
			keywords: [],
			send: sendUnknownKeyword,
		}
	)
}
