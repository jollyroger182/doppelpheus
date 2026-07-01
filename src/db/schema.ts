import { boolean, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
	id: text().primaryKey(),
	hcaToken: text(),
	hackatimeToken: text(),
})

export const authAttempts = pgTable('auth_attempts', {
	id: uuid().primaryKey().defaultRandom(),
	userId: text()
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	used: boolean().notNull().default(false),
	createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const projects = pgTable(
	'projects',
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		userId: text()
			.notNull()
			.references(() => users.id),
		name: text().notNull(),
		description: text().notNull(),
		playableUrl: text(),
		codeUrl: text(),
	},
	(table) => [index().on(table.userId)],
)

export const auditLog = pgTable(
	'audit_log',
	{
		id: uuid().primaryKey().defaultRandom(),
		action: text().notNull(),
		user: text(),
		details: text(),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index().on(table.createdAt)],
)
