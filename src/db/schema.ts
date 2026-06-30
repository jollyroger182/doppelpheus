import { integer, pgTable, text } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
	id: text().primaryKey(),
})

export const projects = pgTable('projects', {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	userId: text()
		.notNull()
		.references(() => users.id),
})
