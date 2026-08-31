import { createServerFn } from '@tanstack/react-start'
import { eq, and, asc, isNull } from 'drizzle-orm'
import { db } from '../db'
import { rents } from '../db/schema'
import { assertMonthOpen } from './utils'

export const listRentsByMonth = createServerFn({ method: 'GET' as const })
  .validator((data: { monthId: number }) => data)
  .handler(async ({ data }) => {
    const rows = await db.query.rents.findMany({
      where: (t, { and }) => and(eq(t.monthId, data.monthId), isNull(t.deletedAt)),
      orderBy: [asc(rents.createdAt)],
      with: { member: { columns: { id: true, name: true } } },
    })
    return rows.map((r) => ({
      id: r.id,
      memberId: r.memberId,
      memberName: r.member.name,
      monthId: r.monthId,
      amount: Number(r.amount),
      createdAt: r.createdAt?.toISOString(),
      updatedAt: r.updatedAt?.toISOString() ?? null,
      createdBy: r.createdBy,
      updatedBy: r.updatedBy,
    }))
  })

export const createRent = createServerFn({ method: 'POST' as const })
  .validator(
    (data: { memberId: number; monthId: number; amount: number; userId?: number }) => data,
  )
  .handler(async ({ data }) => {
    await assertMonthOpen(data.monthId)

    const [existing] = await db
      .select()
      .from(rents)
      .where(and(eq(rents.memberId, data.memberId), eq(rents.monthId, data.monthId)))
      .limit(1)

    if (existing) {
      const [updated] = await db
        .update(rents)
        .set({ amount: String(data.amount), updatedBy: data.userId ?? null })
        .where(eq(rents.id, existing.id))
        .returning()
      return updated
    }

    const [created] = await db
      .insert(rents)
      .values({
        memberId: data.memberId,
        monthId: data.monthId,
        amount: String(data.amount),
        createdBy: data.userId ?? null,
      })
      .returning()
    return created
  })

export const updateRent = createServerFn({ method: 'POST' as const })
  .validator(
    (data: { id: number; memberId?: number; monthId?: number; amount?: number; userId?: number }) => data,
  )
  .handler(async ({ data }) => {
    const { id, userId, ...fields } = data
    const [existing] = await db.select().from(rents).where(eq(rents.id, id)).limit(1)
    if (!existing) throw new Error('Rent not found')
    await assertMonthOpen(existing.monthId)

    const updateData: Record<string, unknown> = {}
    if (fields.memberId !== undefined) updateData.memberId = fields.memberId
    if (fields.monthId !== undefined) updateData.monthId = fields.monthId
    if (fields.amount !== undefined) updateData.amount = String(fields.amount)
    updateData.updatedBy = userId ?? null

    const [updated] = await db.update(rents).set(updateData).where(eq(rents.id, id)).returning()
    return updated
  })

export const deleteRent = createServerFn({ method: 'POST' as const })
  .validator((data: { id: number; userId?: number }) => data)
  .handler(async ({ data }) => {
    const [existing] = await db.select().from(rents).where(eq(rents.id, data.id)).limit(1)
    if (existing) await assertMonthOpen(existing.monthId)
    await db.update(rents).set({ deletedAt: new Date(), deletedBy: data.userId ?? null }).where(eq(rents.id, data.id))
    return { success: true }
  })
