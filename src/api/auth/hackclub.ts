import { logAudit } from '../../queries/audit-log'
import { getAuthAttemptWithUserById, markAuthAttemptUsed } from '../../queries/auth-attempt'
import { upsertUser } from '../../queries/user'
import {
	sendHackatimeAuthMessage,
	sendHCAAuthMessage,
	sendIneligibleMessage,
} from '../../slack/user/operations'
import { getHCAProfile, redirectToDM } from '../../utils'

const { HCA_CLIENT_ID, HCA_CLIENT_SECRET, EXTERNAL_URL } = process.env

export async function handleHCACallback(req: Request) {
	const url = new URL(req.url)
	const code = url.searchParams.get('code')
	const state = url.searchParams.get('state')
	if (!code || !state) {
		return Response.json({ error: 'invalid params' }, 400)
	}

	const attempt = await getAuthAttemptWithUserById(state)
	if (!attempt) {
		return Response.json({ error: 'invalid state' }, 400)
	}
	const user = attempt.user
	if (attempt.used) {
		logAudit('auth.hca.callback_replay', user.id, { state })
		await sendHCAAuthMessage(user.id)
		return redirectToDM(user.id)
	}

	const resp = await fetch('https://auth.hackclub.com/oauth/token', {
		method: 'POST',
		body: new URLSearchParams({
			client_id: HCA_CLIENT_ID!,
			client_secret: HCA_CLIENT_SECRET!,
			redirect_uri: `${EXTERNAL_URL}/auth/hackclub/callback`,
			code,
			grant_type: 'authorization_code',
		}),
	})
	if (!resp.ok) {
		const errText = await resp.text()
		console.error('failed to exchange hca token', errText)
		return Response.json({ error: 'upstream error' }, 500)
	}
	const data = (await resp.json()) as { access_token: string }
	await markAuthAttemptUsed(state)

	const profile = await getHCAProfile(data.access_token)
	if (!profile.identity.ysws_eligible) {
		logAudit('auth.hca.ineligible', user.id, {
			verification_status: profile.identity.verification_status,
		})
		await sendIneligibleMessage(user.id)
		return redirectToDM(user.id)
	}

	await upsertUser({ id: user.id, hcaToken: data.access_token })
	logAudit('auth.hca.linked', user.id, { hca_id: profile.identity.id })

	await sendHackatimeAuthMessage(user.id)

	return redirectToDM(user.id)
}
