import { createServerFn } from '@tanstack/react-start'
import { eq, asc } from 'drizzle-orm'
import { db } from '../db'
import { expenses } from '../db/schema'
import { assertMonthOpen } from './utils'

export const listExpensesByMonth = createServerFn({ method: 'GET' as const })
  .validator((data: { monthId: number }) => data)
  .handler(async ({ data }) => {
    const rows = await db.query.expenses.findMany({
      where: eq(expenses.monthId, data.monthId),
      orderBy: [asc(expenses.expenseDate)],
      with: { paidBy: { columns: { id: true, name: true } } },
    })
    return rows.map((r) => ({
      id: r.id,
      monthId: r.monthId,
      amount: Number(r.amount),
      description: r.description,
      category: r.category,
      expenseDate: r.expenseDate,
      paidById: r.paidById,
      paidByName: r.paidBy?.name ?? null,
      createdAt: r.createdAt?.toISOString(),
    }))
  })

export const createExpense = createServerFn({ method: 'POST' as const })
  .validator(
    (data: {
      monthId: number
      amount: number
      description?: string
      category: string
      expenseDate: string
      paidById?: number
    }) => data,
  )
  .handler(async ({ data }) => {
    await assertMonthOpen(data.monthId)
    const [created] = await db
      .insert(expenses)
      .values({
        monthId: data.monthId,
        amount: String(data.amount),
        description: data.description || null,
        category: data.category,
        expenseDate: data.expenseDate,
        paidById: data.paidById || null,
      })
      .returning()
    return created
  })

export const updateExpense = createServerFn({ method: 'POST' as const })
  .validator(
    (data: {
      id: number
      amount?: number
      description?: string
      category?: string
      expenseDate?: string
      paidById?: number
    }) => data,
  )
  .handler(async ({ data }) => {
    const { id, ...fields } = data
    const [existing] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1)
    if (!existing) throw new Error('Expense not found')
    await assertMonthOpen(existing.monthId)

    const updateData: Record<string, unknown> = {}
    if (fields.amount !== undefined) updateData.amount = String(fields.amount)
    if (fields.description !== undefined) updateData.description = fields.description || null
    if (fields.category !== undefined) updateData.category = fields.category
    if (fields.expenseDate !== undefined) updateData.expenseDate = fields.expenseDate
    if (fields.paidById !== undefined) updateData.paidById = fields.paidById || null

    const [updated] = await db.update(expenses).set(updateData).where(eq(expenses.id, id)).returning()
    return updated
  })

export const deleteExpense = createServerFn({ method: 'POST' as const })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const [existing] = await db.select().from(expenses).where(eq(expenses.id, data.id)).limit(1)
    if (existing) await assertMonthOpen(existing.monthId)
    await db.delete(expenses).where(eq(expenses.id, data.id))
    return { success: true }
  })
