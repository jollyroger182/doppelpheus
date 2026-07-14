import { eq, sql } from 'drizzle-orm'
import { db } from '../db'
import { projectReviews } from '../db/schema'
import { formatSeconds, getHackatimeProjectStats } from '../hackatime'
import { getEventStartDate } from '../queries/config'
import { getProjectsByUserId } from '../queries/project'
import { getAllUsers } from '../queries/user'

/**
 * Aggregates program-wide hours across three buckets:
 *
 * 1. total live hackatime hours logged across every project (submitted or not),
 *    counted from the event start up to now over each project's selected
 *    hackatime projects — mirrors the "total time" line in the projects view.
 * 2. hours sitting in reviews that are still pending approval.
 * 3. approved hours (recorded hackatime seconds + any hour adjustment).
 *
 * Buckets 2 & 3 come from the snapshotted `project_reviews.hackatimeSeconds`
 * (what was counted at decision time), not from live hackatime data.
 */
async function main() {
	const [users, eventStart] = await Promise.all([getAllUsers(), getEventStartDate()])
	const since = eventStart ?? new Date(0)

	// --- live hackatime totals across all projects ---
	let totalSeconds = 0
	let projectCount = 0
	for (const user of users) {
		const projects = await getProjectsByUserId(user.id)
		if (!projects.length) continue

		const stats = await getHackatimeProjectStats(user.id, since, new Date())
		const secondsByHackatimeProject = new Map(stats.map((s) => [s.project, s.seconds]))

		for (const project of projects) {
			projectCount++
			totalSeconds += project.hackatimeProjects.reduce(
				(acc, name) => acc + (secondsByHackatimeProject.get(name) ?? 0),
				0,
			)
		}
	}

	// --- pending vs approved (from snapshotted review data) ---
	const [pendingRow] = await db
		.select({ seconds: sql<number>`coalesce(sum(${projectReviews.hackatimeSeconds}), 0)` })
		.from(projectReviews)
		.where(eq(projectReviews.status, 'pending'))

	const [approvedRow] = await db
		.select({
			seconds: sql<number>`coalesce(sum(${projectReviews.hackatimeSeconds}), 0)`,
			adjustmentHours: sql<number>`coalesce(sum(${projectReviews.hoursAdjustment}), 0)`,
		})
		.from(projectReviews)
		.where(eq(projectReviews.status, 'approved'))

	const pendingSeconds = Number(pendingRow?.seconds ?? 0)
	const approvedSeconds =
		Number(approvedRow?.seconds ?? 0) + Number(approvedRow?.adjustmentHours ?? 0) * 3600

	const hours = (seconds: number) => (seconds / 3600).toFixed(2)

	console.log('=== doppel hours report ===')
	console.log(`event start: ${eventStart ? eventStart.toISOString() : '(unset — counting all time)'}`)
	console.log('')
	console.log(
		`total logged (all ${projectCount} projects, submitted + unsubmitted): ${hours(totalSeconds)}h (${formatSeconds(totalSeconds)})`,
	)
	console.log(
		`submitted, pending approval:                                        ${hours(pendingSeconds)}h (${formatSeconds(pendingSeconds)})`,
	)
	console.log(
		`approved (incl. hour adjustments):                                  ${hours(approvedSeconds)}h (${formatSeconds(approvedSeconds)})`,
	)
}

await main()
process.exit(0)
