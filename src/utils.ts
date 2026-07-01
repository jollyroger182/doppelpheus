import { app } from './slack/client'

export async function redirectToDM(user: string) {
	const {
		channel: { id: dmChannelId },
	} = await app.request('conversations.open', { users: user })
	return Response.redirect(`https://hackclub.enterprise.slack.com/archives/${dmChannelId}`)
}

export async function getHCAProfile(token: string) {
	const resp = await fetch('https://auth.hackclub.com/api/v1/me', {
		headers: { Authorization: `Bearer ${token}` },
	})
	if (!resp.ok) {
		console.error('hca returned error fetching profile', await resp.text())
		throw new Error('hca returned error fetching profile')
	}
	return (await resp.json()) as HCAProfile
}

export interface HCAProfile {
	identity: {
		id: string
		ysws_eligible: boolean
		verification_status: string
		first_name: string
		last_name: string
		primary_email: string
		slack_id: string
		phone_number: string
		birthday: string
		addresses: HCAAddress[]
	}
	scopes: string[]
}

export interface HCAAddress {
	id: string
	first_name: string
	last_name: string
	line_1: string
	line_2: string
	city: string
	state: string
	postal_code: string
	country: string
	phone_number: string
	primary?: boolean
}
