import { createServerFn } from '@tanstack/react-start'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '../db'
import { months, members, meals, bazar, expenses, deposits, rents } from '../db/schema'
import { round2, dailyCount } from './utils'

// ── helpers ────────────────────────────────────────────
async function mealCountFor(memberId: number, monthId: number): Promise<number> {
  const rows = await db.query.meals.findMany({
    where: and(eq(meals.memberId, memberId), eq(meals.monthId, monthId)),
  })
  return rows.reduce((sum, r) => sum + dailyCount(r), 0)
}

async function bazarFor(memberId: number, monthId: number): Promise<number> {
  const [agg] = await db
    .select({ total: sql<string>`COALESCE(SUM(${bazar.amount}), 0)` })
    .from(bazar)
    .where(and(eq(bazar.memberId, memberId), eq(bazar.monthId, monthId)))
  return Number(agg.total)
}

async function expensePaidByFor(memberId: number, monthId: number): Promise<number> {
  const [agg] = await db
    .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
    .from(expenses)
    .where(and(eq(expenses.paidById, memberId), eq(expenses.monthId, monthId)))
  return Number(agg.total)
}

async function depositFor(memberId: number, monthId: number): Promise<number> {
  const [agg] = await db
    .select({ total: sql<string>`COALESCE(SUM(${deposits.amount}), 0)` })
    .from(deposits)
    .where(and(eq(deposits.memberId, memberId), eq(deposits.monthId, monthId)))
  return Number(agg.total)
}

async function rentFor(memberId: number, monthId: number): Promise<number> {
  const [row] = await db
    .select({ amount: rents.amount })
    .from(rents)
    .where(and(eq(rents.memberId, memberId), eq(rents.monthId, monthId)))
    .limit(1)
  return row ? Number(row.amount) : 0
}

interface Summary {
  totalMeals: number
  totalBazar: number
  totalExpenses: number
  totalDeposits: number
  memberCount: number
  mealRate: number
  expenseSharePerMember: number
}

async function buildSummary(monthId: number): Promise<Summary | null> {
  const [month] = await db.select().from(months).where(eq(months.id, monthId)).limit(1)
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
    .where(eq(meals.monthId, monthId))

  const [bazarAgg] = await db
    .select({ total: sql<string>`COALESCE(SUM(${bazar.amount}), 0)` })
    .from(bazar)
    .where(eq(bazar.monthId, monthId))

  const [expenseAgg] = await db
    .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
    .from(expenses)
    .where(eq(expenses.monthId, monthId))

  const [depositAgg] = await db
    .select({ total: sql<string>`COALESCE(SUM(${deposits.amount}), 0)` })
    .from(deposits)
    .where(eq(deposits.monthId, monthId))

  const [memberCount] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(members)
    .where(eq(members.active, true))

  const totalMeals = Number(mealAgg.total)
  const totalBazar = Number(bazarAgg.total)
  const totalExpenses = Number(expenseAgg.total)
  const totalDeposits = Number(depositAgg.total)
  const activeMemberCount = memberCount.count

  return {
    totalMeals,
    totalBazar,
    totalExpenses,
    totalDeposits,
    memberCount: activeMemberCount,
    mealRate: totalMeals > 0 ? round2(totalBazar / totalMeals) : 0,
    expenseSharePerMember: activeMemberCount > 0 ? round2(totalExpenses / activeMemberCount) : 0,
  }
}

async function buildBalance(memberId: number, memberName: string, monthId: number, summary: Summary) {
  const meals = await mealCountFor(memberId, monthId)
  const mealCost = round2(meals * summary.mealRate)
  const expenseShare = summary.expenseSharePerMember
  const bazarContribution = await bazarFor(memberId, monthId)
  const expenseContribution = await expensePaidByFor(memberId, monthId)
  const rent = await rentFor(memberId, monthId)
  const deposit = await depositFor(memberId, monthId)

  let foodBalance = round2(bazarContribution + expenseContribution - mealCost - expenseShare)
  const rentBalance = round2(deposit - rent)

  const isInactiveOrBanned = false // checked by caller
  if (isInactiveOrBanned && meals === 0) {
    // Handled at call site
  }

  return {
    memberId,
    memberName,
    meals,
    mealRate: summary.mealRate,
    mealCost,
    expenseShare,
    bazarContribution,
    expenseContribution,
    foodBalance,
    rent,
    deposit,
    rentBalance,
    balance: round2(foodBalance + rentBalance),
  }
}

// ── Monthly Report ─────────────────────────────────────
export const getMonthlyReport = createServerFn({ method: 'GET' as const })
  .validator((data: { monthId: number }) => data)
  .handler(async ({ data }) => {
    const [month] = await db.select().from(months).where(eq(months.id, data.monthId)).limit(1)
    if (!month) return null

    const summary = await buildSummary(data.monthId)
    if (!summary) return null

    const allMembers = await db.query.members.findMany()
    const memberBalances = []

    for (const m of allMembers) {
      const meals = await mealCountFor(m.id, data.monthId)
      const rent = await rentFor(m.id, data.monthId)
      const deposit = await depositFor(m.id, data.monthId)
      const bazarContribution = await bazarFor(m.id, data.monthId)
      const expenseContribution = await expensePaidByFor(m.id, data.monthId)

      const hasParticipation = meals > 0 || rent > 0 || deposit > 0 || bazarContribution > 0 || expenseContribution > 0
      const isIncluded = (m.active && !m.banned) || hasParticipation
      if (!isIncluded) continue

      const mealCost = round2(meals * summary.mealRate)
      let expenseShare = summary.expenseSharePerMember
      let foodBalance = round2(bazarContribution + expenseContribution - mealCost - expenseShare)

      if ((m.banned || !m.active) && meals === 0) {
        expenseShare = 0
        foodBalance = round2(bazarContribution + expenseContribution - mealCost - 0)
      }

      const rentBalance = round2(deposit - rent)

      memberBalances.push({
        memberId: m.id,
        memberName: m.name,
        meals,
        mealRate: summary.mealRate,
        mealCost,
        expenseShare,
        bazarContribution,
        expenseContribution,
        foodBalance,
        rent,
        deposit,
        rentBalance,
        balance: round2(foodBalance + rentBalance),
      })
    }

    memberBalances.sort((a, b) => a.memberName.localeCompare(b.memberName))

    const totals = {
      deposits: round2(memberBalances.reduce((s, r) => s + r.deposit, 0)),
      mealCost: round2(memberBalances.reduce((s, r) => s + r.mealCost, 0)),
      expenses: summary.totalExpenses,
      rent: round2(memberBalances.reduce((s, r) => s + r.rent, 0)),
      bazarContributions: round2(memberBalances.reduce((s, r) => s + r.bazarContribution, 0)),
      expenseContributions: round2(memberBalances.reduce((s, r) => s + r.expenseContribution, 0)),
      foodBalances: round2(memberBalances.reduce((s, r) => s + r.foodBalance, 0)),
      rentBalances: round2(memberBalances.reduce((s, r) => s + r.rentBalance, 0)),
      netBalance: round2(memberBalances.reduce((s, r) => s + r.balance, 0)),
    }

    return {
      month: { id: month.id, year: month.year, monthNo: month.monthNo, closed: month.closed },
      summary: {
        totalMeals: summary.totalMeals,
        totalBazar: summary.totalBazar,
        mealRate: summary.mealRate,
        totalExpenses: summary.totalExpenses,
        totalDeposits: summary.totalDeposits,
        memberCount: summary.memberCount,
        expenseSharePerMember: summary.expenseSharePerMember,
      },
      members: memberBalances,
      totals,
    }
  })

// ── Daily Report ───────────────────────────────────────
export const getDailyReport = createServerFn({ method: 'GET' as const })
  .validator((data: { monthId: number; date: string }) => data)
  .handler(async ({ data }) => {
    const dayMeals = await db.query.meals.findMany({
      where: and(eq(meals.monthId, data.monthId), eq(meals.recordDate, data.date)),
      with: { member: { columns: { id: true, name: true } } },
    })

    const memberRows = dayMeals.map((r) => ({
      memberId: r.memberId,
      memberName: r.member.name,
      breakfastOn: r.breakfastOn,
      lunchOn: r.lunchOn,
      dinnerOn: r.dinnerOn,
      dailyCount: dailyCount(r),
    }))

    const totalMeals = memberRows.reduce((s, r) => s + r.dailyCount, 0)

    const monthBazar = await db.query.bazar.findMany({
      where: eq(bazar.monthId, data.monthId),
    })
    const bazarThatDay = monthBazar
      .filter((b) => b.bazarDate === data.date)
      .reduce((s, b) => s + Number(b.amount), 0)

    const monthExpenses = await db.query.expenses.findMany({
      where: eq(expenses.monthId, data.monthId),
    })
    const expensesThatDay = monthExpenses
      .filter((e) => e.expenseDate === data.date)
      .reduce((s, e) => s + Number(e.amount), 0)

    return {
      date: data.date,
      monthId: data.monthId,
      members: memberRows,
      dayTotals: { totalMeals, bazarThatDay, expensesThatDay },
    }
  })

// ── Member Report ──────────────────────────────────────
export const getMemberReport = createServerFn({ method: 'GET' as const })
  .validator((data: { memberId: number; monthId: number }) => data)
  .handler(async ({ data }) => {
    const [member] = await db.select().from(members).where(eq(members.id, data.memberId)).limit(1)
    if (!member) return null

    const [month] = await db.select().from(months).where(eq(months.id, data.monthId)).limit(1)
    if (!month) return null

    const memberMeals = await db.query.meals.findMany({
      where: and(eq(meals.memberId, data.memberId), eq(meals.monthId, data.monthId)),
    })

    const byDay = memberMeals.map((r) => ({ date: r.recordDate, dailyCount: dailyCount(r) }))
    const totalCount = byDay.reduce((s, d) => s + d.dailyCount, 0)

    const memberDeposits = await db.query.deposits.findMany({
      where: and(eq(deposits.memberId, data.memberId), eq(deposits.monthId, data.monthId)),
    })
    const depositList = memberDeposits.map((r) => ({ date: r.depositDate, amount: Number(r.amount) }))

    const balance = await buildBalance(member.name, member.name, data.monthId, (await buildSummary(data.monthId))!)

    return {
      member: { id: member.id, name: member.name },
      month: { id: month.id, year: month.year, monthNo: month.monthNo },
      meals: { totalCount, byDay },
      deposits: depositList,
      rent: balance.rent,
      mealRate: balance.mealRate,
      mealCost: balance.mealCost,
      expenseShare: balance.expenseShare,
      bazarContribution: balance.bazarContribution,
      expenseContribution: balance.expenseContribution,
      totalDeposit: balance.deposit,
      foodBalance: balance.foodBalance,
      rentBalance: balance.rentBalance,
      balance: balance.balance,
    }
  })
