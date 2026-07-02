import { boolean, index, integer, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core'

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
		screenshotFileId: text(),
		playableUrl: text(),
		codeUrl: text(),
	},
	(table) => [index().on(table.userId)],
)

export const config = pgTable('config', {
	key: text().primaryKey(),
	value: text().notNull(),
})

export const uploadedFiles = pgTable('uploaded_files', {
	key: text().primaryKey(),
	fileId: text().notNull(),
	updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const shopItems = pgTable('shop_items', {
	id: uuid().primaryKey().defaultRandom(),
	name: text().notNull(),
	description: text().notNull(),
	priceMinutes: integer().notNull(),
	enabled: boolean().notNull().default(false),
	createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

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
