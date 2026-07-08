import { getUserWithProjectsById } from './queries/user'

export interface HackatimeProjectStats {
	project: string
	seconds: number
}

export async function getHackatimeProjectStats(
	userId: string,
	start: Date,
	end: Date,
): Promise<HackatimeProjectStats[]> {
	const user = await getUserWithProjectsById(userId)
	const hackatimeToken = user?.hackatimeToken
	if (!hackatimeToken) return []

	const url = new URL('https://hackatime.hackclub.com/api/v1/authenticated/projects')
	url.searchParams.set('start', start.toISOString())
	url.searchParams.set('end', end.toISOString())
	const resp = await fetch(url, {
		headers: {
			Authorization: `Bearer ${hackatimeToken}`,
		},
	})
	if (!resp.ok) {
		console.error('failed to pull data from hackatime', await resp.text())
		return []
	}
	const data = (await resp.json()) as { projects: { name: string; total_seconds: number }[] }

	return data.projects.map((p) => ({ project: p.name, seconds: p.total_seconds }))
}

export function formatSeconds(seconds: number): string {
	const total = Math.max(0, Math.floor(seconds))
	const hours = Math.floor(total / 3600)
	const minutes = Math.floor((total % 3600) / 60)
	if (hours === 0) return `${minutes}m`
	if (minutes === 0) return `${hours}h`
	return `${hours}h ${minutes}m`
}
