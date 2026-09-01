import { createServerFn } from '@tanstack/react-start'
import { eq, and, sql, isNull } from 'drizzle-orm'
import { db } from '../db'
import { months, members, meals, bazar, expenses, deposits, previousBalances } from '../db/schema'
import { round2 } from './utils'

export const getDashboardSummary = createServerFn({ method: 'GET' as const })
  .validator((data: { monthId: number }) => data)
  .handler(async ({ data }) => {
    const [month] = await db.select().from(months).where(eq(months.id, data.monthId)).limit(1)
    if (!month) return null

    const [mealAgg] = await db
      .select({
        total: sql<string>`COALESCE(SUM(
          ${meals.breakfastCount} * 0.5 + ${meals.lunchCount} * 1.0 + ${meals.dinnerCount} * 1.0
        ), 0)`,
      })
      .from(meals)
      .where(and(eq(meals.monthId, data.monthId), eq(meals.status, 'approved'), isNull(meals.deletedAt)))

    const [bazarAgg] = await db
      .select({ total: sql<string>`COALESCE(SUM(${bazar.amount}), 0)` })
      .from(bazar)
      .where(and(eq(bazar.monthId, data.monthId), eq(bazar.status, 'approved'), isNull(bazar.deletedAt)))

    let totalExpenses = 0
    let totalRegularExpenses = 0
    let totalBillableExpenses = 0
    try {
      const [expenseAgg] = await db
        .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
        .from(expenses)
        .where(and(eq(expenses.monthId, data.monthId), eq(expenses.status, 'approved'), isNull(expenses.deletedAt)))
      totalExpenses = Number(expenseAgg.total)

      const [regularAgg] = await db
        .select({ total: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.expenseType} = 'regular' THEN ${expenses.amount}::numeric ELSE 0 END), 0)` })
        .from(expenses)
        .where(and(eq(expenses.monthId, data.monthId), eq(expenses.status, 'approved'), isNull(expenses.deletedAt)))
      totalRegularExpenses = Number(regularAgg.total)

      const [billableAgg] = await db
        .select({ total: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.expenseType} = 'billable' THEN ${expenses.amount}::numeric ELSE 0 END), 0)` })
        .from(expenses)
        .where(and(eq(expenses.monthId, data.monthId), eq(expenses.status, 'approved'), isNull(expenses.deletedAt)))
      totalBillableExpenses = Number(billableAgg.total)

      if (totalRegularExpenses === 0 && totalBillableExpenses === 0 && totalExpenses > 0) {
        totalBillableExpenses = totalExpenses
      }
      if (totalBillableExpenses + totalRegularExpenses !== totalExpenses && totalExpenses > 0) {
        const diff = totalExpenses - (totalRegularExpenses + totalBillableExpenses)
        if (diff !== 0) totalBillableExpenses += diff
      }
    } catch {
      const [fallbackAgg] = await db
        .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
        .from(expenses)
        .where(and(eq(expenses.monthId, data.monthId), eq(expenses.status, 'approved'), isNull(expenses.deletedAt)))
      totalExpenses = Number(fallbackAgg.total)
      totalBillableExpenses = totalExpenses
      totalRegularExpenses = 0
    }

    const [depositAgg] = await db
      .select({ total: sql<string>`COALESCE(SUM(${deposits.amount}), 0)` })
      .from(deposits)
      .where(and(eq(deposits.monthId, data.monthId), isNull(deposits.deletedAt)))

    let totalPreviousBalances = 0
    try {
      const [prevAgg] = await db
        .select({ total: sql<string>`COALESCE(SUM(${previousBalances.amount}), 0)` })
        .from(previousBalances)
        .where(and(eq(previousBalances.monthId, data.monthId), isNull(previousBalances.deletedAt)))
      totalPreviousBalances = Number(prevAgg.total)
    } catch {
      totalPreviousBalances = 0
    }

    const [memberCount] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(members)
      .where(and(eq(members.active, true), isNull(members.deletedAt)))

    const totalMeals = Number(mealAgg.total)
    const totalBazar = Number(bazarAgg.total)
    const totalDeposits = Number(depositAgg.total)
    const activeMemberCount = memberCount.count

    const mealRate = totalMeals > 0 ? round2(totalBazar / totalMeals) : 0
    const expenseSharePerMember = activeMemberCount > 0 ? round2(totalExpenses / activeMemberCount) : 0
    const regularSharePerMember = activeMemberCount > 0 ? round2(totalRegularExpenses / activeMemberCount) : 0
    const billableSharePerMember = activeMemberCount > 0 ? round2(totalBillableExpenses / activeMemberCount) : 0

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
      totalRegularExpenses,
      totalBillableExpenses,
      totalDeposits,
      totalPreviousBalances,
      expenseSharePerMember,
      regularSharePerMember,
      billableSharePerMember,
    }
  })
