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

export function pickHCAAddress(
	profile: HCAProfile,
	selectedId: string | null,
): HCAAddress | null {
	const addresses = profile.identity.addresses ?? []
	if (!addresses.length) return null
	if (selectedId) {
		const match = addresses.find((a) => a.id === selectedId)
		if (match) return match
	}
	return addresses.find((a) => a.primary) ?? addresses[0]!
}

export function formatHCAAddress(a: HCAAddress): string {
	const nameLine = `${a.first_name} ${a.last_name}`.trim()
	const parts = [
		nameLine,
		a.line_1,
		a.line_2,
		[a.city, a.state, a.postal_code].filter(Boolean).join(', '),
		a.country,
		a.phone_number,
	].filter(Boolean)
	return parts.join('\n')
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
