import { getUserIdsWithApprovedProject } from '../queries/project-review'
import { app } from '../slack/client'

const DELAY_MS = 1000

const MESSAGE = 'insert message here'

async function main() {
	const args = process.argv.slice(2)
	const dryRun = args.includes('--dry-run')

	const userIds = await getUserIdsWithApprovedProject()
	console.log(`found ${userIds.length} user(s) with at least one approved project`)

	if (dryRun) {
		console.log('--dry-run: not sending. recipients:')
		for (const id of userIds) console.log(`  ${id}`)
		return
	}

	let sent = 0
	let failed = 0
	for (const userId of userIds) {
		try {
			const channel = await app.user(userId).im()
			await channel.send(MESSAGE)
			sent++
			console.log(`✓ sent to ${userId}`)
		} catch (err) {
			failed++
			console.error(`✗ failed to send to ${userId}`, err)
		}
		await Bun.sleep(DELAY_MS)
	}

	console.log(`done. sent=${sent} failed=${failed}`)
}

await main()
process.exit(0)
