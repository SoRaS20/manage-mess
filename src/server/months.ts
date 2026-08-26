import { createServerFn } from '@tanstack/react-start'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db'
import { months, members } from '../db/schema'

export const listMonths = createServerFn({ method: 'GET' as const })
  .validator(() => ({}))
  .handler(async () => {
    return db.query.months.findMany({
      orderBy: [desc(months.year), desc(months.monthNo)],
      with: { manager: { columns: { id: true, name: true } } },
    })
  })

export const getMonth = createServerFn({ method: 'GET' as const })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const [row] = await db
      .select()
      .from(months)
      .where(eq(months.id, data.id))
      .limit(1)
    return row ?? null
  })

export const createMonth = createServerFn({ method: 'POST' as const })
  .validator((data: { year: number; monthNo: number }) => data)
  .handler(async ({ data }) => {
    if (data.year < 2000 || data.year > 2100) throw new Error('Year must be 2000-2100')
    if (data.monthNo < 1 || data.monthNo > 12) throw new Error('Month must be 1-12')

    const existing = await db
      .select()
      .from(months)
      .where(and(eq(months.year, data.year), eq(months.monthNo, data.monthNo)))
      .limit(1)
    if (existing.length > 0) return existing[0]

    const [created] = await db.insert(months).values({ year: data.year, monthNo: data.monthNo }).returning()
    return created
  })

export const updateMonth = createServerFn({ method: 'POST' as const })
  .validator((data: { id: number; year?: number; monthNo?: number }) => data)
  .handler(async ({ data }) => {
    const { id, ...fields } = data
    if (Object.keys(fields).length === 0) {
      const [row] = await db.select().from(months).where(eq(months.id, id)).limit(1)
      return row ?? null
    }
    const [updated] = await db.update(months).set(fields).where(eq(months.id, id)).returning()
    return updated ?? null
  })

export const closeMonth = createServerFn({ method: 'POST' as const })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const [updated] = await db.update(months).set({ closed: true }).where(eq(months.id, data.id)).returning()
    return updated ?? null
  })

export const reopenMonth = createServerFn({ method: 'POST' as const })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const [updated] = await db.update(months).set({ closed: false }).where(eq(months.id, data.id)).returning()
    return updated ?? null
  })

export const setManager = createServerFn({ method: 'POST' as const })
  .validator((data: { monthId: number; memberId: number }) => data)
  .handler(async ({ data }) => {
    const [month] = await db.select().from(months).where(eq(months.id, data.monthId)).limit(1)
    if (!month) throw new Error('Month not found')
    const [member] = await db.select().from(members).where(eq(members.id, data.memberId)).limit(1)
    if (!member) throw new Error('Member not found')
    const [updated] = await db.update(months).set({ managerId: data.memberId }).where(eq(months.id, data.monthId)).returning()
    return updated
  })

export const deleteMonth = createServerFn({ method: 'POST' as const })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await db.delete(months).where(eq(months.id, data.id))
    return { success: true }
  })
