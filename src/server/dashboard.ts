import { createServerFn } from '@tanstack/react-start'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db'
import { months, members, meals, bazar, expenses, deposits } from '../db/schema'
import { round2 } from './utils'

export const getDashboardSummary = createServerFn({ method: 'GET' as const })
  .validator((data: { monthId: number }) => data)
  .handler(async ({ data }) => {
    const [month] = await db.select().from(months).where(eq(months.id, data.monthId)).limit(1)
    if (!month) return null

    const [mealAgg] = await db
      .select({
        total: sql<string>`COALESCE(SUM(
          (CASE WHEN ${meals.breakfastOn} THEN 0.5 ELSE 0 END) +
          (CASE WHEN ${meals.lunchOn} THEN 1.0 ELSE 0 END) +
          (CASE WHEN ${meals.dinnerOn} THEN 1.0 ELSE 0 END)
        ), 0)`,
      })
      .from(meals)
      .where(eq(meals.monthId, data.monthId))

    const [bazarAgg] = await db
      .select({ total: sql<string>`COALESCE(SUM(${bazar.amount}), 0)` })
      .from(bazar)
      .where(eq(bazar.monthId, data.monthId))

    const [expenseAgg] = await db
      .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
      .from(expenses)
      .where(eq(expenses.monthId, data.monthId))

    const [depositAgg] = await db
      .select({ total: sql<string>`COALESCE(SUM(${deposits.amount}), 0)` })
      .from(deposits)
      .where(eq(deposits.monthId, data.monthId))

    const [memberCount] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(members)
      .where(eq(members.active, true))

    const totalMeals = Number(mealAgg.total)
    const totalBazar = Number(bazarAgg.total)
    const totalExpenses = Number(expenseAgg.total)
    const totalDeposits = Number(depositAgg.total)
    const activeMemberCount = memberCount.count

    const mealRate = totalMeals > 0 ? round2(totalBazar / totalMeals) : 0
    const expenseSharePerMember = activeMemberCount > 0 ? round2(totalExpenses / activeMemberCount) : 0

    return {
      monthId: month.id,
      year: month.year,
      monthNo: month.monthNo,
      closed: month.closed,
      memberCount: activeMemberCount,
      totalMeals,
      totalBazar,
      mealRate,
      totalExpenses,
      totalDeposits,
      expenseSharePerMember,
    }
  })
