import { createServerFn } from '@tanstack/react-start'
import { eq, asc, isNull } from 'drizzle-orm'
import { db } from '../db'
import { expenses } from '../db/schema'
import { assertMonthOpen } from './utils'

export const listExpensesByMonth = createServerFn({ method: 'GET' as const })
  .validator((data: { monthId: number }) => data)
  .handler(async ({ data }) => {
    const rows = await db.query.expenses.findMany({
      where: (t, { and }) => and(eq(t.monthId, data.monthId), isNull(t.deletedAt)),
      orderBy: [asc(expenses.expenseDate)],
      with: { paidBy: { columns: { id: true, name: true } } },
    })
    return rows.map((r) => ({
      id: r.id,
      monthId: r.monthId,
      amount: Number(r.amount),
      description: r.description,
      category: r.category,
      expenseType: ((r as any).expenseType ?? 'billable') as 'regular' | 'billable',
      expenseDate: r.expenseDate,
      paidById: r.paidById,
      paidByName: r.paidBy?.name ?? null,
      status: r.status as 'pending' | 'approved' | 'rejected',
      approvedBy: r.approvedBy,
      approvedAt: r.approvedAt?.toISOString() ?? null,
      createdAt: r.createdAt?.toISOString(),
      updatedAt: r.updatedAt?.toISOString() ?? null,
      createdBy: r.createdBy,
      updatedBy: r.updatedBy,
    }))
  })

export const createExpense = createServerFn({ method: 'POST' as const })
  .validator(
    (data: {
      monthId: number
      amount: number
      description?: string
      category: string
      expenseType?: string
      expenseDate: string
      paidById?: number
      status?: string
      userId?: number
    }) => data,
  )
  .handler(async ({ data }) => {
    await assertMonthOpen(data.monthId)
    const expenseType = data.expenseType === 'regular' ? 'regular' : 'billable'
    const [created] = await db
      .insert(expenses)
      .values({
        monthId: data.monthId,
        amount: String(data.amount),
        description: data.description || null,
        category: data.category,
        expenseType,
        expenseDate: data.expenseDate,
        paidById: data.paidById || null,
        status: data.status || 'approved',
        createdBy: data.userId ?? null,
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
      expenseType?: string
      expenseDate?: string
      paidById?: number
      userId?: number
    }) => data,
  )
  .handler(async ({ data }) => {
    const { id, userId, ...fields } = data
    const [existing] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1)
    if (!existing) throw new Error('Expense not found')
    await assertMonthOpen(existing.monthId)

    const updateData: Record<string, unknown> = {}
    if (fields.amount !== undefined) updateData.amount = String(fields.amount)
    if (fields.description !== undefined) updateData.description = fields.description || null
    if (fields.category !== undefined) updateData.category = fields.category
    if (fields.expenseType !== undefined) updateData.expenseType = fields.expenseType === 'regular' ? 'regular' : 'billable'
    if (fields.expenseDate !== undefined) updateData.expenseDate = fields.expenseDate
    if (fields.paidById !== undefined) updateData.paidById = fields.paidById || null
    updateData.updatedBy = userId ?? null

    const [updated] = await db.update(expenses).set(updateData).where(eq(expenses.id, id)).returning()
    return updated
  })

export const approveExpense = createServerFn({ method: 'POST' as const })
  .validator((data: { id: number; approvedBy: number; userId?: number }) => data)
  .handler(async ({ data }) => {
    const [existing] = await db.select().from(expenses).where(eq(expenses.id, data.id)).limit(1)
    if (!existing) throw new Error('Expense not found')
    await assertMonthOpen(existing.monthId)

    const [updated] = await db
      .update(expenses)
      .set({ status: 'approved', approvedBy: data.approvedBy, approvedAt: new Date(), updatedBy: data.userId ?? null })
      .where(eq(expenses.id, data.id))
      .returning()
    return updated
  })

export const rejectExpense = createServerFn({ method: 'POST' as const })
  .validator((data: { id: number; approvedBy: number; userId?: number }) => data)
  .handler(async ({ data }) => {
    const [existing] = await db.select().from(expenses).where(eq(expenses.id, data.id)).limit(1)
    if (!existing) throw new Error('Expense not found')
    await assertMonthOpen(existing.monthId)

    const [updated] = await db
      .update(expenses)
      .set({ status: 'rejected', approvedBy: data.approvedBy, approvedAt: new Date(), updatedBy: data.userId ?? null })
      .where(eq(expenses.id, data.id))
      .returning()
    return updated
  })

export const deleteExpense = createServerFn({ method: 'POST' as const })
  .validator((data: { id: number; userId?: number }) => data)
  .handler(async ({ data }) => {
    const [existing] = await db.select().from(expenses).where(eq(expenses.id, data.id)).limit(1)
    if (existing) await assertMonthOpen(existing.monthId)
    await db.update(expenses).set({ deletedAt: new Date(), deletedBy: data.userId ?? null }).where(eq(expenses.id, data.id))
    return { success: true }
  })
