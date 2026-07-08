import { actions, blocks, context, option, R, richText, section, select } from 'slack.ts'
import { userBot } from '../client'
import { FAQ_CANVAS } from '../../consts'
import { CONFIG_KEYS, isFeatureEnabled } from '../../queries/config'
import { getEnabledShopItems } from '../../queries/shop-item'
import { getUserBalanceMinutes, getUserById } from '../../queries/user'
import { getHCAProfile, pickHCAAddress, formatHCAAddress } from '../../utils'
import { buildProjectsView } from './views/projects'

export const SHOP_BUY_ACTION = 'shop.buy'
export const SETTINGS_ADDRESS_ACTION = 'settings.address'
const formatHours = (minutes: number) => (minutes / 60).toFixed(1).replace(/\.0$/, '')

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
						R.section(
							"hello there human i hear you are in need of help? i'm doppel from ",
							R.channel(MAIN_CHANNEL!),
							" and here's what i can do:",
						),
						R.list(
							R.section(R.text('projects').bold(), ' to see your projects'),
							R.section(R.text('prizes').bold(), ' to browse prizes'),
							R.section(R.text('settings').bold(), ' to change your shipping address'),
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

			const balance = (await getUserBalanceMinutes(userId)) ?? 0
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
									` (${formatHours(i.priceMinutes)}h): ${i.description}`,
								),
							),
						),
					),
					context(`your balance: ${formatHours(balance)}h`),
					actions(
						select(...items.map((i) => option(`${i.name} (${formatHours(i.priceMinutes)}h)`, i.id)))
							.id(SHOP_BUY_ACTION)
							.placeholder('buy something...'),
					),
				),
			})
		},
	},
	{
		keywords: ['settings', 'setting', 'address'],
		send: async (userId) => {
			const user = await getUserById(userId)
			if (!user?.hcaToken) {
				return userBot
					.user(userId)
					.send('link your HCA account first! send me any message to get the link.')
			}
			let profile
			try {
				profile = await getHCAProfile(user.hcaToken)
			} catch {
				return userBot
					.user(userId)
					.send("couldn't fetch your HCA profile right now, try again in a bit :(")
			}
			const addresses = profile.identity.addresses ?? []
			if (!addresses.length) {
				return userBot
					.user(userId)
					.send(
						"you don't have any addresses on file at <https://auth.hackclub.com/addresses|hack club auth>! add one there and try again :3",
					)
			}
			const current = pickHCAAddress(profile, user.selectedHcaAddressId)
			const label = (a: (typeof addresses)[number]) =>
				`${a.line_1}${a.line_2 ? ', ' + a.line_2 : ''}, ${a.city}`.slice(0, 75)
			const addressOptions = addresses.map((a) => option(label(a), a.id))
			const picker = select(...addressOptions)
				.id(SETTINGS_ADDRESS_ACTION)
				.placeholder('pick an address')
			if (current) picker.default(current.id)
			const text = 'pick the address prizes should be shipped to!'
			return userBot.user(userId).send({
				text,
				blocks: blocks(
					section(text),
					current
						? section(`current:\n\`\`\`\n${formatHCAAddress(current)}\n\`\`\``)
						: section('_no address selected yet_'),
					actions(picker),
					context(
						'addresses come from <https://auth.hackclub.com/addresses|hack club auth>. update them there if needed.',
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

export const sendUnknownKeyword = (userId: string) => {
	const text = "aaa i don't know what that is :( try `help` to see what i can do!"
	return userBot.user(userId).send({
		text,
		blocks: blocks(
			section(text),
			context(`(have general questions? ask the orgs in <#${MAIN_CHANNEL}>!)`),
		),
	})
}

export function findKeywordHandler(text: string): KeywordHandler {
	const lower = text.toLowerCase()
	return (
		keywordHandlers.find((h) => h.keywords.some((k) => lower.includes(k))) || {
			keywords: [],
			send: sendUnknownKeyword,
		}
	)
}
