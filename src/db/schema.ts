import {
  boolean,
  date,
  integer,
  numeric,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'

type EntryStatus = 'pending' | 'approved' | 'rejected'

const auditFields = {
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').$onUpdateFn(() => new Date()),
  createdBy: integer('created_by'),
  updatedBy: integer('updated_by'),
  deletedAt: timestamp('deleted_at'),
  deletedBy: integer('deleted_by'),
}

// ── Users ──────────────────────────────────────────────
export const users = pgTable('app_user', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  password: varchar('user_password', { length: 255 }).notNull(),
  role: varchar('role', { length: 10 }).notNull().default('MEMBER'),
  ...auditFields,
})

// ── Sessions ───────────────────────────────────────────
export const sessions = pgTable('session', {
  id: serial('id').primaryKey(),
  token: varchar('token', { length: 500 }).notNull().unique(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: varchar('user_agent', { length: 500 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastActiveAt: timestamp('last_active_at').notNull().defaultNow(),
})

// ── Members ────────────────────────────────────────────
export const members = pgTable('member', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  joinDate: date('join_date').notNull().defaultNow(),
  active: boolean('active').notNull().default(true),
  banned: boolean('banned').notNull().default(false),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  ...auditFields,
})

// ── Months ─────────────────────────────────────────────
export const months = pgTable(
  'mess_month',
  {
    id: serial('id').primaryKey(),
    year: integer('year').notNull(),
    monthNo: integer('month_no').notNull(),
    closed: boolean('closed').notNull().default(false),
    managerId: integer('manager_id').references(() => members.id, { onDelete: 'set null' }),
    ...auditFields,
  },
  (t) => [uniqueIndex('mess_month_year_month_no_idx').on(t.year, t.monthNo).where(sql`${t.deletedAt} IS NULL`)],
)

// ── Meals ──────────────────────────────────────────────
export const meals = pgTable(
  'meal',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    monthId: integer('month_id')
      .notNull()
      .references(() => months.id, { onDelete: 'cascade' }),
    recordDate: date('record_date').notNull(),
    breakfastCount: integer('breakfast_count').notNull().default(0),
    lunchCount: integer('lunch_count').notNull().default(1),
    dinnerCount: integer('dinner_count').notNull().default(1),
    status: varchar('status', { length: 10 }).notNull().default('approved'),
    approvedBy: integer('approved_by').references(() => members.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at'),
    ...auditFields,
  },
  (t) => [uniqueIndex('meal_member_date_idx').on(t.memberId, t.recordDate).where(sql`${t.deletedAt} IS NULL`)],
)

// ── Bazar ──────────────────────────────────────────────
export const bazar = pgTable('bazar', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .notNull()
    .references(() => members.id, { onDelete: 'cascade' }),
  monthId: integer('month_id')
    .notNull()
    .references(() => months.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  description: varchar('description', { length: 255 }),
  bazarDate: date('bazar_date').notNull().defaultNow(),
  status: varchar('status', { length: 10 }).notNull().default('approved'),
  approvedBy: integer('approved_by').references(() => members.id, { onDelete: 'set null' }),
  approvedAt: timestamp('approved_at'),
  ...auditFields,
})

// ── Expenses ───────────────────────────────────────────
export const expenses = pgTable('expense', {
  id: serial('id').primaryKey(),
  monthId: integer('month_id')
    .notNull()
    .references(() => months.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  description: varchar('description', { length: 255 }),
  category: varchar('category', { length: 20 }).notNull(),
  expenseType: varchar('expense_type', { length: 20 }).notNull().default('billable'),
  expenseDate: date('expense_date').notNull().defaultNow(),
  paidById: integer('paid_by_id').references(() => members.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 10 }).notNull().default('approved'),
  approvedBy: integer('approved_by').references(() => members.id, { onDelete: 'set null' }),
  approvedAt: timestamp('approved_at'),
  ...auditFields,
})

// ── Deposits ───────────────────────────────────────────
export const deposits = pgTable('deposit', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id')
    .notNull()
    .references(() => members.id, { onDelete: 'cascade' }),
  monthId: integer('month_id')
    .notNull()
    .references(() => months.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  depositDate: date('deposit_date').notNull().defaultNow(),
  description: varchar('description', { length: 255 }),
  ...auditFields,
})

// ── Previous Balances ──────────────────────────────────
export const previousBalances = pgTable(
  'previous_balance',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    monthId: integer('month_id')
      .notNull()
      .references(() => months.id, { onDelete: 'cascade' }),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    description: varchar('description', { length: 255 }),
    ...auditFields,
  },
  (t) => [uniqueIndex('previous_balance_member_month_idx').on(t.memberId, t.monthId).where(sql`${t.deletedAt} IS NULL`)],
)

// ── Rents ──────────────────────────────────────────────
export const rents = pgTable(
  'rent',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    monthId: integer('month_id')
      .notNull()
      .references(() => months.id, { onDelete: 'cascade' }),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    ...auditFields,
  },
  (t) => [uniqueIndex('rent_member_month_idx').on(t.memberId, t.monthId).where(sql`${t.deletedAt} IS NULL`)],
)

// ── Relations ──────────────────────────────────────────
export const usersRelations = relations(users, ({ one, many }) => ({
  member: one(members, {
    fields: [users.id],
    references: [members.userId],
  }),
  sessions: many(sessions),
}))

export const membersRelations = relations(members, ({ one, many }) => ({
  user: one(users, {
    fields: [members.userId],
    references: [users.id],
  }),
  meals: many(meals),
  bazar: many(bazar),
  deposits: many(deposits),
  rents: many(rents),
  previousBalances: many(previousBalances),
}))

export const monthsRelations = relations(months, ({ one, many }) => ({
  manager: one(members, {
    fields: [months.managerId],
    references: [members.id],
  }),
  meals: many(meals),
  bazar: many(bazar),
  expenses: many(expenses),
  deposits: many(deposits),
  rents: many(rents),
  previousBalances: many(previousBalances),
}))

export const mealsRelations = relations(meals, ({ one }) => ({
  member: one(members, {
    fields: [meals.memberId],
    references: [members.id],
  }),
  month: one(months, {
    fields: [meals.monthId],
    references: [months.id],
  }),
}))

export const bazarRelations = relations(bazar, ({ one }) => ({
  member: one(members, {
    fields: [bazar.memberId],
    references: [members.id],
  }),
  month: one(months, {
    fields: [bazar.monthId],
    references: [months.id],
  }),
}))

export const expensesRelations = relations(expenses, ({ one }) => ({
  month: one(months, {
    fields: [expenses.monthId],
    references: [months.id],
  }),
  paidBy: one(members, {
    fields: [expenses.paidById],
    references: [members.id],
  }),
}))

export const depositsRelations = relations(deposits, ({ one }) => ({
  member: one(members, {
    fields: [deposits.memberId],
    references: [members.id],
  }),
  month: one(months, {
    fields: [deposits.monthId],
    references: [months.id],
  }),
}))

export const rentsRelations = relations(rents, ({ one }) => ({
  member: one(members, {
    fields: [rents.memberId],
    references: [members.id],
  }),
  month: one(months, {
    fields: [rents.monthId],
    references: [months.id],
  }),
}))

export const previousBalancesRelations = relations(previousBalances, ({ one }) => ({
  member: one(members, {
    fields: [previousBalances.memberId],
    references: [members.id],
  }),
  month: one(months, {
    fields: [previousBalances.monthId],
    references: [months.id],
  }),
}))
