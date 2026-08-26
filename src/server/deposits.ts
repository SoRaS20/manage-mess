import { createServerFn } from '@tanstack/react-start'
import { eq, asc } from 'drizzle-orm'
import { db } from '../db'
import { deposits } from '../db/schema'
import { assertMonthOpen } from './utils'

export const listDepositsByMonth = createServerFn({ method: 'GET' as const })
  .validator((data: { monthId: number }) => data)
  .handler(async ({ data }) => {
    const rows = await db.query.deposits.findMany({
      where: eq(deposits.monthId, data.monthId),
      orderBy: [asc(deposits.depositDate)],
      with: { member: { columns: { id: true, name: true } } },
    })
    return rows.map((r) => ({
      id: r.id,
      memberId: r.memberId,
      memberName: r.member.name,
      monthId: r.monthId,
      amount: Number(r.amount),
      depositDate: r.depositDate,
      description: r.description,
      createdAt: r.createdAt?.toISOString(),
    }))
  })

export const createDeposit = createServerFn({ method: 'POST' as const })
  .validator(
    (data: {
      memberId: number
      monthId: number
      amount: number
      depositDate: string
      description?: string
    }) => data,
  )
  .handler(async ({ data }) => {
    await assertMonthOpen(data.monthId)
    const [created] = await db
      .insert(deposits)
      .values({
        memberId: data.memberId,
        monthId: data.monthId,
        amount: String(data.amount),
        depositDate: data.depositDate,
        description: data.description || null,
      })
      .returning()
    return created
  })

export const updateDeposit = createServerFn({ method: 'POST' as const })
  .validator(
    (data: {
      id: number
      memberId?: number
      amount?: number
      depositDate?: string
      description?: string
    }) => data,
  )
  .handler(async ({ data }) => {
    const { id, ...fields } = data
    const [existing] = await db.select().from(deposits).where(eq(deposits.id, id)).limit(1)
    if (!existing) throw new Error('Deposit not found')
    await assertMonthOpen(existing.monthId)

    const updateData: Record<string, unknown> = {}
    if (fields.memberId !== undefined) updateData.memberId = fields.memberId
    if (fields.amount !== undefined) updateData.amount = String(fields.amount)
    if (fields.depositDate !== undefined) updateData.depositDate = fields.depositDate
    if (fields.description !== undefined) updateData.description = fields.description || null

    const [updated] = await db.update(deposits).set(updateData).where(eq(deposits.id, id)).returning()
    return updated
  })

export const deleteDeposit = createServerFn({ method: 'POST' as const })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const [existing] = await db.select().from(deposits).where(eq(deposits.id, data.id)).limit(1)
    if (existing) await assertMonthOpen(existing.monthId)
    await db.delete(deposits).where(eq(deposits.id, data.id))
    return { success: true }
  })
