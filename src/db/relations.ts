import { defineRelations } from 'drizzle-orm'
import * as schema from './schema'

export const relations = defineRelations(schema, (r) => ({
	users: {
		projects: r.many.projects(),
		authAttempts: r.many.authAttempts(),
	},
	authAttempts: {
		user: r.one.users({
			from: r.authAttempts.userId,
			to: r.users.id,
			optional: false,
		}),
	},
	projects: {
		user: r.one.users({
			from: r.projects.userId,
			to: r.users.id,
			optional: false,
		}),
		reviews: r.many.projectReviews(),
	},
	projectReviews: {
		project: r.one.projects({
			from: r.projectReviews.projectId,
			to: r.projects.id,
			optional: false,
		}),
	},
}))
