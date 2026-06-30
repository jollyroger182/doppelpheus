import { defineRelations } from 'drizzle-orm'
import * as schema from './schema'

export const relations = defineRelations(schema, (r) => ({
	users: {
		projects: r.many.projects(),
	},
	projects: {
		user: r.one.users({
			from: r.projects.userId,
			to: r.users.id,
		}),
	},
}))
