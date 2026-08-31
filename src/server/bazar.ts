import { createServerFn } from '@tanstack/react-start'
import { eq, asc, isNull } from 'drizzle-orm'
import { db } from '../db'
import { bazar } from '../db/schema'
import { assertMonthOpen } from './utils'

export const listBazarByMonth = createServerFn({ method: 'GET' as const })
  .validator((data: { monthId: number }) => data)
  .handler(async ({ data }) => {
    const rows = await db.query.bazar.findMany({
      where: (t, { and }) => and(eq(t.monthId, data.monthId), isNull(t.deletedAt)),
      orderBy: [asc(bazar.bazarDate)],
      with: { member: { columns: { id: true, name: true } } },
    })
    return rows.map((r) => ({
      id: r.id,
      memberId: r.memberId,
      memberName: r.member.name,
      monthId: r.monthId,
      amount: Number(r.amount),
      description: r.description,
      bazarDate: r.bazarDate,
      status: r.status as 'pending' | 'approved' | 'rejected',
      approvedBy: r.approvedBy,
      approvedAt: r.approvedAt?.toISOString() ?? null,
      createdAt: r.createdAt?.toISOString(),
      updatedAt: r.updatedAt?.toISOString() ?? null,
      createdBy: r.createdBy,
      updatedBy: r.updatedBy,
    }))
  })

export const createBazar = createServerFn({ method: 'POST' as const })
  .validator(
    (data: {
      memberId: number
      monthId: number
      amount: number
      description?: string
      bazarDate: string
      status?: string
      userId?: number
    }) => data,
  )
  .handler(async ({ data }) => {
    await assertMonthOpen(data.monthId)
    const [created] = await db
      .insert(bazar)
      .values({
        memberId: data.memberId,
        monthId: data.monthId,
        amount: String(data.amount),
        description: data.description || null,
        bazarDate: data.bazarDate,
        status: data.status || 'approved',
        createdBy: data.userId ?? null,
      })
      .returning()
    return created
  })

export const updateBazar = createServerFn({ method: 'POST' as const })
  .validator(
    (data: {
      id: number
      memberId?: number
      amount?: number
      description?: string
      bazarDate?: string
      userId?: number
    }) => data,
  )
  .handler(async ({ data }) => {
    const { id, userId, ...fields } = data
    const [existing] = await db.select().from(bazar).where(eq(bazar.id, id)).limit(1)
    if (!existing) throw new Error('Bazar entry not found')
    await assertMonthOpen(existing.monthId)

    const updateData: Record<string, unknown> = {}
    if (fields.memberId !== undefined) updateData.memberId = fields.memberId
    if (fields.amount !== undefined) updateData.amount = String(fields.amount)
    if (fields.description !== undefined) updateData.description = fields.description || null
    if (fields.bazarDate !== undefined) updateData.bazarDate = fields.bazarDate
    updateData.updatedBy = userId ?? null

    const [updated] = await db.update(bazar).set(updateData).where(eq(bazar.id, id)).returning()
    return updated
  })

export const approveBazar = createServerFn({ method: 'POST' as const })
  .validator((data: { id: number; approvedBy: number; userId?: number }) => data)
  .handler(async ({ data }) => {
    const [existing] = await db.select().from(bazar).where(eq(bazar.id, data.id)).limit(1)
    if (!existing) throw new Error('Bazar entry not found')
    await assertMonthOpen(existing.monthId)

    const [updated] = await db
      .update(bazar)
      .set({ status: 'approved', approvedBy: data.approvedBy, approvedAt: new Date(), updatedBy: data.userId ?? null })
      .where(eq(bazar.id, data.id))
      .returning()
    return updated
  })

export const rejectBazar = createServerFn({ method: 'POST' as const })
  .validator((data: { id: number; approvedBy: number; userId?: number }) => data)
  .handler(async ({ data }) => {
    const [existing] = await db.select().from(bazar).where(eq(bazar.id, data.id)).limit(1)
    if (!existing) throw new Error('Bazar entry not found')
    await assertMonthOpen(existing.monthId)

    const [updated] = await db
      .update(bazar)
      .set({ status: 'rejected', approvedBy: data.approvedBy, approvedAt: new Date(), updatedBy: data.userId ?? null })
      .where(eq(bazar.id, data.id))
      .returning()
    return updated
  })

export const deleteBazar = createServerFn({ method: 'POST' as const })
  .validator((data: { id: number; userId?: number }) => data)
  .handler(async ({ data }) => {
    const [existing] = await db.select().from(bazar).where(eq(bazar.id, data.id)).limit(1)
    if (existing) await assertMonthOpen(existing.monthId)
    await db.update(bazar).set({ deletedAt: new Date(), deletedBy: data.userId ?? null }).where(eq(bazar.id, data.id))
    return { success: true }
  })
