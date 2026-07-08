import type { Project } from './queries/project'
import type { ProjectReview } from './queries/project-review'
import { getUserLastShipAt, getUserSignupAt, type User } from './queries/user'
import { getHCAProfile } from './utils'

const AIRTABLE_TABLE_NAME = 'YSWS Project Submission'
const AIRTABLE_USERS_TABLE = 'Users'

export async function syncApprovedProjectToAirtable(
	project: Project & { user: User },
	review: ProjectReview,
): Promise<void> {
	const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, EXTERNAL_URL } = process.env
	if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
		console.error('airtable sync skipped because env is not configured')
		return
	}

	const profile = await getHCAProfile(project.user.hcaToken!)
	const address = profile.identity.addresses.find((a) => a.primary) || profile.identity.addresses[0]
	if (!address) {
		throw new Error('no address found for user')
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
					'Code URL': project.codeUrl,
					'Playable URL': project.playableUrl,
					'First Name': address.first_name,
					'Last Name': address.last_name,
					Email: profile.identity.primary_email,
					Screenshot:
						project.screenshotFileId && EXTERNAL_URL
							? [{ url: `${EXTERNAL_URL}/api/screenshot/${project.screenshotToken}` }]
							: undefined,
					Description: project.description,
					'Address (Line 1)': address.line_1,
					'Address (Line 2)': address.line_2,
					City: address.city,
					'State / Province': address.state,
					Country: address.country,
					'ZIP / Postal Code': address.postal_code,
					Birthday: profile.identity.birthday,
					'Optional - Override Hours Spent':
						review.hackatimeSeconds / 3600 + (review.hoursAdjustment ?? 0),
					'Optional - Override Hours Spent Justification': review.justification ?? 'TODO',
				},
			}),
		},
	)

	if (!res.ok) {
		throw new Error(`airtable ${res.status}: ${await res.text()}`)
	}
}

export async function syncUserLoopsToAirtable(user: User): Promise<void> {
	const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env
	if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
		console.error('airtable user sync skipped because env is not configured')
		return
	}
	if (!user.hcaToken) return

	const profile = await getHCAProfile(user.hcaToken)
	const email = profile.identity.primary_email
	if (!email) return

	const [signUpAt, lastShipAt] = await Promise.all([
		getUserSignupAt(user.id),
		getUserLastShipAt(user.id),
	])

	const res = await fetch(
		`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_USERS_TABLE)}`,
		{
			method: 'PATCH',
			headers: {
				Authorization: `Bearer ${AIRTABLE_API_KEY}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				performUpsert: { fieldsToMergeOn: ['Email'] },
				records: [
					{
						fields: {
							Email: email,
							'Loops - doppelSignUpAt': signUpAt?.toISOString() ?? null,
							'Loops - doppelLastShipAt': lastShipAt?.toISOString() ?? null,
						},
					},
				],
			}),
		},
	)

	if (!res.ok) {
		throw new Error(`airtable users ${res.status}: ${await res.text()}`)
	}
}
