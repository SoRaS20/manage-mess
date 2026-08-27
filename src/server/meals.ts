import { createServerFn } from '@tanstack/react-start'
import { eq, and, asc } from 'drizzle-orm'
import { db } from '../db'
import { meals, members, months } from '../db/schema'
import { assertMonthOpen, eachDayOfMonth, dailyCount } from './utils'

export const getMealsByMonth = createServerFn({ method: 'GET' as const })
  .validator((data: { monthId: number }) => data)
  .handler(async ({ data }) => {
    const rows = await db.query.meals.findMany({
      where: eq(meals.monthId, data.monthId),
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
    }))
  })

export const getMealsByDate = createServerFn({ method: 'GET' as const })
  .validator((data: { monthId: number; date: string }) => data)
  .handler(async ({ data }) => {
    const rows = await db.query.meals.findMany({
      where: and(eq(meals.monthId, data.monthId), eq(meals.recordDate, data.date)),
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
    }) => data,
  )
  .handler(async ({ data }) => {
    await assertMonthOpen(data.monthId)
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
      })
      .returning()
    return created
  })

export const updateMealSlot = createServerFn({ method: 'POST' as const })
  .validator((data: { mealId: number; slot: string; count: number; status?: string }) => data)
  .handler(async ({ data }) => {
    const slot = data.slot.toLowerCase()
    if (slot !== 'breakfast' && slot !== 'lunch' && slot !== 'dinner') {
      throw new Error('Missing "slot" (breakfast|lunch|dinner)')
    }

    const [meal] = await db.select().from(meals).where(eq(meals.id, data.mealId)).limit(1)
    if (!meal) throw new Error('Meal not found')

    await assertMonthOpen(meal.monthId)

    const field = slot === 'breakfast' ? 'breakfastCount' : slot === 'lunch' ? 'lunchCount' : 'dinnerCount'
    const updateData: Record<string, unknown> = { [field]: data.count }
    if (data.status) {
      updateData.status = data.status
    }
    const [updated] = await db.update(meals).set(updateData).where(eq(meals.id, data.mealId)).returning()
    return updated
  })

export const toggleMeal = createServerFn({ method: 'POST' as const })
  .validator((data: { mealId: number; slot: string; on: boolean; status?: string }) => data)
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
    const updateData: Record<string, unknown> = { [field]: newCount }
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
    }) => data,
  )
  .handler(async ({ data }) => {
    const { mealId, ...flags } = data
    const [meal] = await db.select().from(meals).where(eq(meals.id, mealId)).limit(1)
    if (!meal) throw new Error('Meal not found')
    await assertMonthOpen(meal.monthId)

    const [updated] = await db.update(meals).set(flags).where(eq(meals.id, mealId)).returning()
    return updated
  })

export const approveMeal = createServerFn({ method: 'POST' as const })
  .validator((data: { mealId: number; approvedBy: number }) => data)
  .handler(async ({ data }) => {
    const [meal] = await db.select().from(meals).where(eq(meals.id, data.mealId)).limit(1)
    if (!meal) throw new Error('Meal not found')
    await assertMonthOpen(meal.monthId)

    const [updated] = await db
      .update(meals)
      .set({ status: 'approved', approvedBy: data.approvedBy, approvedAt: new Date() })
      .where(eq(meals.id, data.mealId))
      .returning()
    return updated
  })

export const rejectMeal = createServerFn({ method: 'POST' as const })
  .validator((data: { mealId: number; approvedBy: number }) => data)
  .handler(async ({ data }) => {
    const [meal] = await db.select().from(meals).where(eq(meals.id, data.mealId)).limit(1)
    if (!meal) throw new Error('Meal not found')
    await assertMonthOpen(meal.monthId)

    const [updated] = await db
      .update(meals)
      .set({ status: 'rejected', approvedBy: data.approvedBy, approvedAt: new Date() })
      .where(eq(meals.id, data.mealId))
      .returning()
    return updated
  })

export const deleteMeal = createServerFn({ method: 'POST' as const })
  .validator((data: { mealId: number }) => data)
  .handler(async ({ data }) => {
    const [meal] = await db.select().from(meals).where(eq(meals.id, data.mealId)).limit(1)
    if (meal) await assertMonthOpen(meal.monthId)
    await db.delete(meals).where(eq(meals.id, data.mealId))
    return { success: true }
  })

export const generateMeals = createServerFn({ method: 'POST' as const })
  .validator((data: { monthId: number }) => data)
  .handler(async ({ data }) => {
    await assertMonthOpen(data.monthId)

    const [month] = await db.select().from(months).where(eq(months.id, data.monthId)).limit(1)
    if (!month) throw new Error('Month not found')

    const activeMembers = await db.query.members.findMany({
      where: eq(members.active, true),
    })

    const days = eachDayOfMonth(month.year, month.monthNo)
    let created = 0

    for (const member of activeMembers) {
      for (const dateStr of days) {
        const existing = await db
          .select()
          .from(meals)
          .where(and(eq(meals.memberId, member.id), eq(meals.recordDate, dateStr)))
          .limit(1)
        if (existing.length === 0) {
          await db.insert(meals).values({
            memberId: member.id,
            monthId: data.monthId,
            recordDate: dateStr,
            breakfastCount: 1,
            lunchCount: 1,
            dinnerCount: 1,
            status: 'approved',
          })
          created++
        }
      }
    }

    return { created }
  })
