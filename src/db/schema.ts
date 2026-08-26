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
import { relations } from 'drizzle-orm'

// ── Users ──────────────────────────────────────────────
export const users = pgTable('app_user', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  password: varchar('user_password', { length: 255 }).notNull(),
  role: varchar('role', { length: 10 }).notNull().default('MEMBER'),
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
  },
  (t) => [uniqueIndex('mess_month_year_month_no_idx').on(t.year, t.monthNo)],
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
    breakfastOn: boolean('breakfast_on').notNull().default(true),
    lunchOn: boolean('lunch_on').notNull().default(true),
    dinnerOn: boolean('dinner_on').notNull().default(true),
  },
  (t) => [uniqueIndex('meal_member_date_idx').on(t.memberId, t.recordDate)],
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
  createdAt: timestamp('date_created').notNull().defaultNow(),
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
  expenseDate: date('expense_date').notNull().defaultNow(),
  paidById: integer('paid_by_id').references(() => members.id, { onDelete: 'set null' }),
  createdAt: timestamp('date_created').notNull().defaultNow(),
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
  createdAt: timestamp('date_created').notNull().defaultNow(),
})

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
    createdAt: timestamp('date_created').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('rent_member_month_idx').on(t.memberId, t.monthId)],
)

// ── Relations ──────────────────────────────────────────
export const usersRelations = relations(users, ({ one }) => ({
  member: one(members, {
    fields: [users.id],
    references: [members.userId],
  }),
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
