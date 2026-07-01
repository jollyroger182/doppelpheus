import { app } from '../slack/client'

const { ADMIN_API_KEY } = process.env

export async function handleWelcome(req: Request) {
	if (!ADMIN_API_KEY) {
		return Response.json({ error: 'no admin api key' }, 500)
	}
	if (req.headers.get('x-api-key') !== ADMIN_API_KEY) {
		return Response.json({ error: 'forbidden' }, 403)
	}

	const { user } = (await req.json()) as { user: string }

	await app.user(user).send('welcome!')

	return Response.json({ success: true })
}
