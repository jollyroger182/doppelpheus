import { logAudit } from './queries/audit-log'
import type { Project } from './queries/project'
import type { ProjectReview } from './queries/project-review'

// TODO: replace with the real Doppel YSWS table name
const AIRTABLE_TABLE_NAME = 'TODO_TABLE_NAME'

export async function syncApprovedProjectToAirtable(
	project: Project,
	review: ProjectReview,
): Promise<void> {
	const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env
	if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
		logAudit('airtable.sync.skipped', null, {
			reason: 'env not configured',
			projectId: project.id,
		})
		return
	}

	const res = await fetch(
		`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`,
		{
			method: 'POST',
			headers: {
				Authorization: `Bearer ${AIRTABLE_API_KEY}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				fields: {
					// TODO: map these to real Airtable field names
					TODO_slack_user_id: project.userId,
					TODO_project_name: project.name,
					TODO_description: project.description,
					TODO_demo_url: project.playableUrl,
					TODO_code_url: project.codeUrl,
					TODO_screenshot_file_id: project.screenshotFileId,
					TODO_hackatime_projects: project.hackatimeProjects.join(', '),
					TODO_approved_at: review.decidedAt?.toISOString(),
					TODO_reviewer: review.reviewerId,
				},
			}),
		},
	)

	if (!res.ok) {
		throw new Error(`airtable ${res.status}: ${await res.text()}`)
	}
}
