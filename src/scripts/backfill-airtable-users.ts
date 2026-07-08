import { syncUserLoopsToAirtable } from '../airtable'
import { getAllUsers } from '../queries/user'

async function main() {
	const users = await getAllUsers()
	console.log(`syncing ${users.length} users to airtable...`)

	let synced = 0
	let skipped = 0
	let failed = 0

	for (const user of users) {
		if (!user.hcaToken) {
			skipped++
			continue
		}
		try {
			await syncUserLoopsToAirtable(user)
			synced++
			console.log(`✓ ${user.id}`)
		} catch (err) {
			failed++
			console.error(`✗ ${user.id}:`, err instanceof Error ? err.message : err)
		}
	}

	console.log(`\ndone. synced=${synced} skipped=${skipped} failed=${failed}`)
}

await main()
process.exit(0)
