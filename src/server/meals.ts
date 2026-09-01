import { createServerFn } from '@tanstack/react-start'
import { eq, and, asc, isNull } from 'drizzle-orm'
import { db } from '../db'
import { meals, months } from '../db/schema'
import { assertMonthOpen, eachDayOfMonth, dailyCount, isPastDateStr } from './utils'

export const getMealsByMonth = createServerFn({ method: 'GET' as const })
  .validator((data: { monthId: number }) => data)
  .handler(async ({ data }) => {
    const rows = await db.query.meals.findMany({
      where: (t, { and }) => and(eq(t.monthId, data.monthId), isNull(t.deletedAt)),
      orderBy: [asc(meals.recordDate)],
      with: { member: { columns: { id: true, name: true } } },
    })
    return rows.map((r) => ({
      id: r.id,
      memberId: r.memberId,
      memberName: r.member.name,
      monthId: r.monthId,
      recordDate: r.recordDate,
      breakfastCount: r.breakfastCount,
      lunchCount: r.lunchCount,
      dinnerCount: r.dinnerCount,
      dailyCount: dailyCount(r),
      status: r.status as 'pending' | 'approved' | 'rejected',
      approvedBy: r.approvedBy,
      approvedAt: r.approvedAt?.toISOString() ?? null,
      createdAt: r.createdAt?.toISOString(),
      updatedAt: r.updatedAt?.toISOString() ?? null,
      createdBy: r.createdBy,
      updatedBy: r.updatedBy,
    }))
  })

export const getMealsByDate = createServerFn({ method: 'GET' as const })
  .validator((data: { monthId: number; date: string }) => data)
  .handler(async ({ data }) => {
    const rows = await db.query.meals.findMany({
      where: (t, { and }) => and(eq(t.monthId, data.monthId), eq(t.recordDate, data.date), isNull(t.deletedAt)),
      with: { member: { columns: { id: true, name: true } } },
    })
    return rows.map((r) => ({
      id: r.id,
      memberId: r.memberId,
      memberName: r.member.name,
      monthId: r.monthId,
      recordDate: r.recordDate,
      breakfastCount: r.breakfastCount,
      lunchCount: r.lunchCount,
      dinnerCount: r.dinnerCount,
      dailyCount: dailyCount(r),
      status: r.status as 'pending' | 'approved' | 'rejected',
      approvedBy: r.approvedBy,
      approvedAt: r.approvedAt?.toISOString() ?? null,
      createdAt: r.createdAt?.toISOString(),
      updatedAt: r.updatedAt?.toISOString() ?? null,
      createdBy: r.createdBy,
      updatedBy: r.updatedBy,
    }))
  })

export const createMeal = createServerFn({ method: 'POST' as const })
  .validator(
    (data: {
      memberId: number
      monthId: number
      recordDate: string
      breakfastCount: number
      lunchCount: number
      dinnerCount: number
      status?: string
      userId?: number
      userRole?: string
    }) => data,
  )
  .handler(async ({ data }) => {
    await assertMonthOpen(data.monthId)

    if (data.userRole !== 'ADMIN' && data.userRole !== 'MANAGER' && isPastDateStr(data.recordDate)) {
      throw new Error('Cannot create meals for past dates.')
    }

    const [created] = await db
      .insert(meals)
      .values({
        memberId: data.memberId,
        monthId: data.monthId,
        recordDate: data.recordDate,
        breakfastCount: data.breakfastCount,
        lunchCount: data.lunchCount,
        dinnerCount: data.dinnerCount,
        status: data.status || 'approved',
        createdBy: data.userId ?? null,
      })
      .returning()
    return created
  })

export const updateMealSlot = createServerFn({ method: 'POST' as const })
  .validator((data: { mealId: number; slot: string; count: number; status?: string; userId?: number; userRole?: string }) => data)
  .handler(async ({ data }) => {
    const slot = data.slot.toLowerCase()
    if (slot !== 'breakfast' && slot !== 'lunch' && slot !== 'dinner') {
      throw new Error('Missing "slot" (breakfast|lunch|dinner)')
    }

    const [meal] = await db.select().from(meals).where(eq(meals.id, data.mealId)).limit(1)
    if (!meal) throw new Error('Meal not found')

    await assertMonthOpen(meal.monthId)

    if (data.userRole !== 'ADMIN' && data.userRole !== 'MANAGER' && isPastDateStr(meal.recordDate)) {
      throw new Error('Cannot edit meals for past dates.')
    }

    const field = slot === 'breakfast' ? 'breakfastCount' : slot === 'lunch' ? 'lunchCount' : 'dinnerCount'
    const updateData: Record<string, unknown> = { [field]: data.count, updatedBy: data.userId ?? null }
    if (data.status) {
      updateData.status = data.status
    }
    const [updated] = await db.update(meals).set(updateData).where(eq(meals.id, data.mealId)).returning()
    return updated
  })

export const toggleMeal = createServerFn({ method: 'POST' as const })
  .validator((data: { mealId: number; slot: string; on: boolean; status?: string; userId?: number }) => data)
  .handler(async ({ data }) => {
    const slot = data.slot.toLowerCase()
    if (slot !== 'breakfast' && slot !== 'lunch' && slot !== 'dinner') {
      throw new Error('Missing "slot" (breakfast|lunch|dinner)')
    }

    const [meal] = await db.select().from(meals).where(eq(meals.id, data.mealId)).limit(1)
    if (!meal) throw new Error('Meal not found')

    await assertMonthOpen(meal.monthId)

    const field = slot === 'breakfast' ? 'breakfastCount' : slot === 'lunch' ? 'lunchCount' : 'dinnerCount'
    const currentCount = slot === 'breakfast' ? meal.breakfastCount : slot === 'lunch' ? meal.lunchCount : meal.dinnerCount
    const newCount = data.on ? Math.max(currentCount, 1) : 0
    const updateData: Record<string, unknown> = { [field]: newCount, updatedBy: data.userId ?? null }
    if (data.status) {
      updateData.status = data.status
    }
    const [updated] = await db.update(meals).set(updateData).where(eq(meals.id, data.mealId)).returning()
    return updated
  })

export const updateMeal = createServerFn({ method: 'POST' as const })
  .validator(
    (data: {
      mealId: number
      breakfastCount?: number
      lunchCount?: number
      dinnerCount?: number
      status?: string
      userId?: number
    }) => data,
  )
  .handler(async ({ data }) => {
    const { mealId, userId, ...flags } = data
    const [meal] = await db.select().from(meals).where(eq(meals.id, mealId)).limit(1)
    if (!meal) throw new Error('Meal not found')
    await assertMonthOpen(meal.monthId)

    const [updated] = await db.update(meals).set({ ...flags, updatedBy: userId ?? null }).where(eq(meals.id, mealId)).returning()
    return updated
  })

export const approveMeal = createServerFn({ method: 'POST' as const })
  .validator((data: { mealId: number; approvedBy: number; userId?: number }) => data)
  .handler(async ({ data }) => {
    const [meal] = await db.select().from(meals).where(eq(meals.id, data.mealId)).limit(1)
    if (!meal) throw new Error('Meal not found')
    await assertMonthOpen(meal.monthId)

    const [updated] = await db
      .update(meals)
      .set({ status: 'approved', approvedBy: data.approvedBy, approvedAt: new Date(), updatedBy: data.userId ?? null })
      .where(eq(meals.id, data.mealId))
      .returning()
    return updated
  })

export const rejectMeal = createServerFn({ method: 'POST' as const })
  .validator((data: { mealId: number; approvedBy: number; userId?: number }) => data)
  .handler(async ({ data }) => {
    const [meal] = await db.select().from(meals).where(eq(meals.id, data.mealId)).limit(1)
    if (!meal) throw new Error('Meal not found')
    await assertMonthOpen(meal.monthId)

    const [updated] = await db
      .update(meals)
      .set({ status: 'rejected', approvedBy: data.approvedBy, approvedAt: new Date(), updatedBy: data.userId ?? null })
      .where(eq(meals.id, data.mealId))
      .returning()
    return updated
  })

export const deleteMeal = createServerFn({ method: 'POST' as const })
  .validator((data: { mealId: number; userId?: number }) => data)
  .handler(async ({ data }) => {
    const [meal] = await db.select().from(meals).where(eq(meals.id, data.mealId)).limit(1)
    if (meal) await assertMonthOpen(meal.monthId)
    await db.update(meals).set({ deletedAt: new Date(), deletedBy: data.userId ?? null }).where(eq(meals.id, data.mealId))
    return { success: true }
  })

export const generateMeals = createServerFn({ method: 'POST' as const })
  .validator((data: { monthId: number; userId?: number }) => data)
  .handler(async ({ data }) => {
    await assertMonthOpen(data.monthId)

    const [month] = await db.select().from(months).where(eq(months.id, data.monthId)).limit(1)
    if (!month) throw new Error('Month not found')

    const activeMembers = await db.query.members.findMany({
      where: (t, { and }) => and(eq(t.active, true), isNull(t.deletedAt)),
    })

    const days = eachDayOfMonth(month.year, month.monthNo)
    let created = 0

    for (const member of activeMembers) {
      for (const dateStr of days) {
        const existing = await db
          .select()
          .from(meals)
          .where(and(eq(meals.memberId, member.id), eq(meals.recordDate, dateStr), isNull(meals.deletedAt)))
          .limit(1)
        if (existing.length === 0) {
          await db.insert(meals).values({
            memberId: member.id,
            monthId: data.monthId,
            recordDate: dateStr,
            breakfastCount: 0,
            lunchCount: 1,
            dinnerCount: 1,
            status: 'approved',
            createdBy: data.userId ?? null,
          })
          created++
        }
      }
    }

    return { created }
  })
