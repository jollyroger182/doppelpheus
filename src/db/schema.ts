import { sql } from 'drizzle-orm'
import {
	boolean,
	index,
	integer,
	pgEnum,
	pgTable,
	real,
	text,
	timestamp,
	uuid,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
	id: text().primaryKey(),
	hcaToken: text(),
	hackatimeToken: text(),
	balanceMinutes: integer().notNull().default(0),
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
		screenshotToken: uuid().notNull().defaultRandom().unique(),
		playableUrl: text(),
		codeUrl: text(),
		hackatimeProjects: text()
			.array()
			.notNull()
			.default(sql`ARRAY[]::text[]`),
	},
	(table) => [index().on(table.userId)],
)

export const reviewStatus = pgEnum('review_status', ['pending', 'approved', 'rejected'])

export const projectReviews = pgTable(
	'project_reviews',
	{
		id: uuid().primaryKey().defaultRandom(),
		projectId: integer()
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		status: reviewStatus().notNull(),
		reviewerId: text(),
		comment: text(),
		justification: text(),
		hoursAdjustment: real(),
		channelId: text(),
		messageTs: text(),
		hackatimeSeconds: integer().notNull().default(0),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
		decidedAt: timestamp({ withTimezone: true }),
	},
	(table) => [index().on(table.projectId), index().on(table.status)],
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

export const purchases = pgTable(
	'purchases',
	{
		id: uuid().primaryKey().defaultRandom(),
		userId: text()
			.notNull()
			.references(() => users.id),
		shopItemId: uuid()
			.notNull()
			.references(() => shopItems.id),
		priceMinutes: integer().notNull(),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index().on(table.userId), index().on(table.shopItemId)],
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
