import { createServerFn } from '@tanstack/react-start'
import { eq, and, asc, isNull } from 'drizzle-orm'
import { db } from '../db'
import { previousBalances } from '../db/schema'
import { assertMonthOpen } from './utils'

export const listPreviousBalancesByMonth = createServerFn({ method: 'GET' as const })
  .validator((data: { monthId: number }) => data)
  .handler(async ({ data }) => {
    const rows = await db.query.previousBalances.findMany({
      where: (t, { and }) => and(eq(t.monthId, data.monthId), isNull(t.deletedAt)),
      orderBy: [asc(previousBalances.createdAt)],
      with: { member: { columns: { id: true, name: true } } },
    })
    return rows.map((r) => ({
      id: r.id,
      memberId: r.memberId,
      memberName: r.member.name,
      monthId: r.monthId,
      amount: Number(r.amount),
      description: r.description,
      createdAt: r.createdAt?.toISOString(),
      updatedAt: r.updatedAt?.toISOString() ?? null,
      createdBy: r.createdBy,
      updatedBy: r.updatedBy,
    }))
  })

export const createPreviousBalance = createServerFn({ method: 'POST' as const })
  .validator(
    (data: { memberId: number; monthId: number; amount: number; description?: string; userId?: number }) => data,
  )
  .handler(async ({ data }) => {
    await assertMonthOpen(data.monthId)

    // Check for existing (including soft-deleted) to handle unique index and allow restore
    const [existing] = await db
      .select()
      .from(previousBalances)
      .where(and(eq(previousBalances.memberId, data.memberId), eq(previousBalances.monthId, data.monthId)))
      .limit(1)

    if (existing) {
      if (existing.deletedAt) {
        // Restore soft-deleted row
        const [restored] = await db
          .update(previousBalances)
          .set({
            amount: String(data.amount),
            description: data.description || null,
            updatedBy: data.userId ?? null,
            deletedAt: null,
            deletedBy: null,
          })
          .where(eq(previousBalances.id, existing.id))
          .returning()
        return restored
      }
      // Update existing active row
      const [updated] = await db
        .update(previousBalances)
        .set({ amount: String(data.amount), description: data.description || null, updatedBy: data.userId ?? null })
        .where(eq(previousBalances.id, existing.id))
        .returning()
      return updated
    }

    // No existing — try insert, handle race condition where concurrent soft-deleted row exists
    try {
      const [created] = await db
        .insert(previousBalances)
        .values({
          memberId: data.memberId,
          monthId: data.monthId,
          amount: String(data.amount),
          description: data.description || null,
          createdBy: data.userId ?? null,
        })
        .returning()
      return created
    } catch (err: any) {
      if (err?.code === '23505' || err?.cause?.code === '23505') {
        // Unique violation — fetch again and update (covers soft-deleted case where insert hit unique index)
        const [conflict] = await db
          .select()
          .from(previousBalances)
          .where(and(eq(previousBalances.memberId, data.memberId), eq(previousBalances.monthId, data.monthId)))
          .limit(1)
        if (conflict) {
          const [updated] = await db
            .update(previousBalances)
            .set({
              amount: String(data.amount),
              description: data.description || null,
              updatedBy: data.userId ?? null,
              deletedAt: null,
              deletedBy: null,
            })
            .where(eq(previousBalances.id, conflict.id))
            .returning()
          return updated
        }
      }
      throw err
    }
  })

export const updatePreviousBalance = createServerFn({ method: 'POST' as const })
  .validator(
    (data: { id: number; memberId?: number; monthId?: number; amount?: number; description?: string; userId?: number }) => data,
  )
  .handler(async ({ data }) => {
    const { id, userId, ...fields } = data
    const [existing] = await db.select().from(previousBalances).where(eq(previousBalances.id, id)).limit(1)
    if (!existing) throw new Error('Previous balance not found')
    await assertMonthOpen(existing.monthId)

    const updateData: Record<string, unknown> = {}
    if (fields.memberId !== undefined) updateData.memberId = fields.memberId
    if (fields.monthId !== undefined) updateData.monthId = fields.monthId
    if (fields.amount !== undefined) updateData.amount = String(fields.amount)
    if (fields.description !== undefined) updateData.description = fields.description || null
    updateData.updatedBy = userId ?? null

    const [updated] = await db.update(previousBalances).set(updateData).where(eq(previousBalances.id, id)).returning()
    return updated
  })

export const deletePreviousBalance = createServerFn({ method: 'POST' as const })
  .validator((data: { id: number; userId?: number }) => data)
  .handler(async ({ data }) => {
    const [existing] = await db.select().from(previousBalances).where(eq(previousBalances.id, data.id)).limit(1)
    if (existing) await assertMonthOpen(existing.monthId)
    await db.update(previousBalances).set({ deletedAt: new Date(), deletedBy: data.userId ?? null }).where(eq(previousBalances.id, data.id))
    return { success: true }
  })
