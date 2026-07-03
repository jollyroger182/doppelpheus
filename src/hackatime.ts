import { HACKATIME_SAMPLE_PROJECTS } from './slack/bot/modals/project'

export interface HackatimeProjectStats {
	project: string
	seconds: number
}

// TODO: replace with a real hackatime API call using the user's hackatimeToken.
// Docs: https://waka.hackclub.com — endpoints like /api/v1/users/current/stats/<range>
// or /api/v1/users/current/heartbeats over the window.
export async function getHackatimeProjectStats(
	_userId: string,
	start: Date,
	end: Date,
): Promise<HackatimeProjectStats[]> {
	const windowSeconds = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
	// Sample distribution: give each sample project a deterministic slice of the window.
	// Real implementation will hit hackatime and honor start/end for the query range.
	return HACKATIME_SAMPLE_PROJECTS.map((project, i) => ({
		project,
		seconds: Math.min(windowSeconds, (i + 1) * 60 * 60 * 3),
	}))
}

export function formatSeconds(seconds: number): string {
	const total = Math.max(0, Math.floor(seconds))
	const hours = Math.floor(total / 3600)
	const minutes = Math.floor((total % 3600) / 60)
	if (hours === 0) return `${minutes}m`
	if (minutes === 0) return `${hours}h`
	return `${hours}h ${minutes}m`
}
