import { createServerFn } from '@tanstack/react-start'
import { eq, and, sql, isNull } from 'drizzle-orm'
import { db } from '../db'
import { months, members, meals, bazar, expenses, deposits, rents, previousBalances } from '../db/schema'
import { round2, dailyCount } from './utils'

async function mealCountFor(memberId: number, monthId: number): Promise<number> {
  const rows = await db.query.meals.findMany({
    where: (t, { and }) => and(eq(t.memberId, memberId), eq(t.monthId, monthId), eq(t.status, 'approved'), isNull(t.deletedAt)),
  })
  return rows.reduce((sum, r) => sum + dailyCount(r), 0)
}

async function bazarFor(memberId: number, monthId: number): Promise<number> {
  const [agg] = await db
    .select({ total: sql<string>`COALESCE(SUM(${bazar.amount}), 0)` })
    .from(bazar)
    .where(and(eq(bazar.memberId, memberId), eq(bazar.monthId, monthId), eq(bazar.status, 'approved'), isNull(bazar.deletedAt)))
  return Number(agg.total)
}

async function expensePaidByFor(memberId: number, monthId: number): Promise<number> {
  const [agg] = await db
    .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
    .from(expenses)
    .where(and(eq(expenses.paidById, memberId), eq(expenses.monthId, monthId), eq(expenses.status, 'approved'), isNull(expenses.deletedAt)))
  return Number(agg.total)
}

async function depositFor(memberId: number, monthId: number): Promise<number> {
  const [agg] = await db
    .select({ total: sql<string>`COALESCE(SUM(${deposits.amount}), 0)` })
    .from(deposits)
    .where(and(eq(deposits.memberId, memberId), eq(deposits.monthId, monthId), isNull(deposits.deletedAt)))
  return Number(agg.total)
}

async function rentFor(memberId: number, monthId: number): Promise<number> {
  const [row] = await db
    .select({ amount: rents.amount })
    .from(rents)
    .where(and(eq(rents.memberId, memberId), eq(rents.monthId, monthId), isNull(rents.deletedAt)))
    .limit(1)
  return row ? Number(row.amount) : 0
}

async function previousBalanceFor(memberId: number, monthId: number): Promise<number> {
  try {
    const [row] = await db
      .select({ amount: previousBalances.amount })
      .from(previousBalances)
      .where(and(eq(previousBalances.memberId, memberId), eq(previousBalances.monthId, monthId), isNull(previousBalances.deletedAt)))
      .limit(1)
    return row ? Number(row.amount) : 0
  } catch {
    return 0
  }
}

interface Summary {
  totalMeals: number
  totalBazar: number
  totalExpenses: number
  totalRegularExpenses: number
  totalBillableExpenses: number
  totalDeposits: number
  totalPreviousBalances: number
  memberCount: number
  mealRate: number
  expenseSharePerMember: number
  regularSharePerMember: number
  billableSharePerMember: number
}

async function buildSummary(monthId: number): Promise<Summary | null> {
  const [month] = await db.select().from(months).where(eq(months.id, monthId)).limit(1)
  if (!month) return null

  const [mealAgg] = await db
    .select({
      total: sql<string>`COALESCE(SUM(
        ${meals.breakfastCount} * 0.5 + ${meals.lunchCount} * 1.0 + ${meals.dinnerCount} * 1.0
      ), 0)`,
    })
    .from(meals)
    .where(and(eq(meals.monthId, monthId), eq(meals.status, 'approved'), isNull(meals.deletedAt)))

  const [bazarAgg] = await db
    .select({ total: sql<string>`COALESCE(SUM(${bazar.amount}), 0)` })
    .from(bazar)
    .where(and(eq(bazar.monthId, monthId), eq(bazar.status, 'approved'), isNull(bazar.deletedAt)))

  // Expense aggregates: split by expense_type, fallback if column missing
  let totalExpenses = 0
  let totalRegularExpenses = 0
  let totalBillableExpenses = 0
  try {
    const [expenseAgg] = await db
      .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
      .from(expenses)
      .where(and(eq(expenses.monthId, monthId), eq(expenses.status, 'approved'), isNull(expenses.deletedAt)))
    totalExpenses = Number(expenseAgg.total)

    const [regularAgg] = await db
      .select({ total: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.expenseType} = 'regular' THEN ${expenses.amount}::numeric ELSE 0 END), 0)` })
      .from(expenses)
      .where(and(eq(expenses.monthId, monthId), eq(expenses.status, 'approved'), isNull(expenses.deletedAt)))
    totalRegularExpenses = Number(regularAgg.total)

    const [billableAgg] = await db
      .select({ total: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.expenseType} = 'billable' THEN ${expenses.amount}::numeric ELSE 0 END), 0)` })
      .from(expenses)
      .where(and(eq(expenses.monthId, monthId), eq(expenses.status, 'approved'), isNull(expenses.deletedAt)))
    totalBillableExpenses = Number(billableAgg.total)

    // If both splits are 0 but total >0, treat all as billable (fallback for old data without expense_type)
    if (totalRegularExpenses === 0 && totalBillableExpenses === 0 && totalExpenses > 0) {
      totalBillableExpenses = totalExpenses
    }
    // If billable still 0 and regular has value but total mismatch, adjust
    if (totalBillableExpenses + totalRegularExpenses !== totalExpenses && totalExpenses > 0) {
      // recalc ensures consistency: let total drive split if expense_type null
      const diff = totalExpenses - (totalRegularExpenses + totalBillableExpenses)
      if (diff !== 0) totalBillableExpenses += diff
    }
  } catch {
    // column missing -> fallback to total only as billable
    const [fallbackAgg] = await db
      .select({ total: sql<string>`COALESCE(SUM(${expenses.amount}), 0)` })
      .from(expenses)
      .where(and(eq(expenses.monthId, monthId), eq(expenses.status, 'approved'), isNull(expenses.deletedAt)))
    totalExpenses = Number(fallbackAgg.total)
    totalBillableExpenses = totalExpenses
    totalRegularExpenses = 0
  }

  const [depositAgg] = await db
    .select({ total: sql<string>`COALESCE(SUM(${deposits.amount}), 0)` })
    .from(deposits)
    .where(and(eq(deposits.monthId, monthId), isNull(deposits.deletedAt)))

  let totalPreviousBalances = 0
  try {
    const [prevAgg] = await db
      .select({ total: sql<string>`COALESCE(SUM(${previousBalances.amount}), 0)` })
      .from(previousBalances)
      .where(and(eq(previousBalances.monthId, monthId), isNull(previousBalances.deletedAt)))
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

  return {
    totalMeals,
    totalBazar,
    totalExpenses,
    totalRegularExpenses,
    totalBillableExpenses,
    totalDeposits,
    totalPreviousBalances,
    memberCount: activeMemberCount,
    mealRate: totalMeals > 0 ? round2(totalBazar / totalMeals) : 0,
    expenseSharePerMember: activeMemberCount > 0 ? round2(totalExpenses / activeMemberCount) : 0,
    regularSharePerMember: activeMemberCount > 0 ? round2(totalRegularExpenses / activeMemberCount) : 0,
    billableSharePerMember: activeMemberCount > 0 ? round2(totalBillableExpenses / activeMemberCount) : 0,
  }
}

async function buildBalance(memberId: number, memberName: string, monthId: number, summary: Summary) {
  const mealsCount = await mealCountFor(memberId, monthId)
  const mealCost = round2(mealsCount * summary.mealRate)
  const expenseShare = summary.expenseSharePerMember
  const regularShare = summary.regularSharePerMember
  const billableShare = summary.billableSharePerMember
  const bazarContribution = await bazarFor(memberId, monthId)
  const expenseContribution = await expensePaidByFor(memberId, monthId)
  const rent = await rentFor(memberId, monthId)
  const deposit = await depositFor(memberId, monthId)
  const previousBalance = await previousBalanceFor(memberId, monthId)

  let foodBalance = round2(bazarContribution + expenseContribution - mealCost - expenseShare)
  const rentBalance = round2(deposit - rent)
  // New: total payable per user spec: gross = billableShare + previousBalance + rent
  const grossPayable = round2(billableShare + previousBalance + rent)
  const netDue = round2(grossPayable - deposit)

  return {
    memberId,
    memberName,
    meals: mealsCount,
    mealRate: summary.mealRate,
    mealCost,
    expenseShare,
    regularShare,
    billableShare,
    previousBalance,
    grossPayable,
    netDue,
    bazarContribution,
    expenseContribution,
    foodBalance,
    rent,
    deposit,
    rentBalance,
    balance: round2(foodBalance + rentBalance),
  }
}

export const getMonthlyReport = createServerFn({ method: 'GET' as const })
  .validator((data: { monthId: number }) => data)
  .handler(async ({ data }) => {
    const [month] = await db.select().from(months).where(eq(months.id, data.monthId)).limit(1)
    if (!month) return null

    const summary = await buildSummary(data.monthId)
    if (!summary) return null

    const allMembers = await db.query.members.findMany({
      where: isNull(members.deletedAt),
    })
    const memberBalances = []

    for (const m of allMembers) {
      const mealsCount = await mealCountFor(m.id, data.monthId)
      const rent = await rentFor(m.id, data.monthId)
      const deposit = await depositFor(m.id, data.monthId)
      const bazarContribution = await bazarFor(m.id, data.monthId)
      const expenseContribution = await expensePaidByFor(m.id, data.monthId)
      const previousBalance = await previousBalanceFor(m.id, data.monthId)

      const hasParticipation = mealsCount > 0 || rent > 0 || deposit > 0 || bazarContribution > 0 || expenseContribution > 0 || previousBalance !== 0
      const isIncluded = (m.active && !m.banned) || hasParticipation
      if (!isIncluded) continue

      const mealCost = round2(mealsCount * summary.mealRate)
      let expenseShare = summary.expenseSharePerMember
      let regularShare = summary.regularSharePerMember
      let billableShare = summary.billableSharePerMember
      let foodBalance = round2(bazarContribution + expenseContribution - mealCost - expenseShare)

      if ((m.banned || !m.active) && mealsCount === 0) {
        expenseShare = 0
        regularShare = 0
        billableShare = 0
        foodBalance = round2(bazarContribution + expenseContribution - mealCost - 0)
      }

      const rentBalance = round2(deposit - rent)
      const grossPayable = round2(billableShare + previousBalance + rent)
      const netDue = round2(grossPayable - deposit)

      memberBalances.push({
        memberId: m.id,
        memberName: m.name,
        meals: mealsCount,
        mealRate: summary.mealRate,
        mealCost,
        expenseShare,
        regularShare,
        billableShare,
        previousBalance,
        grossPayable,
        netDue,
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
      regularExpenses: summary.totalRegularExpenses,
      billableExpenses: summary.totalBillableExpenses,
      previousBalances: round2(memberBalances.reduce((s, r) => s + r.previousBalance, 0)),
      grossPayable: round2(memberBalances.reduce((s, r) => s + r.grossPayable, 0)),
      netDue: round2(memberBalances.reduce((s, r) => s + r.netDue, 0)),
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
        totalRegularExpenses: summary.totalRegularExpenses,
        totalBillableExpenses: summary.totalBillableExpenses,
        totalDeposits: summary.totalDeposits,
        totalPreviousBalances: summary.totalPreviousBalances,
        memberCount: summary.memberCount,
        expenseSharePerMember: summary.expenseSharePerMember,
        regularSharePerMember: summary.regularSharePerMember,
        billableSharePerMember: summary.billableSharePerMember,
      },
      members: memberBalances,
      totals,
    }
  })

export const getDailyReport = createServerFn({ method: 'GET' as const })
  .validator((data: { monthId: number; date: string }) => data)
  .handler(async ({ data }) => {
    const dayMeals = await db.query.meals.findMany({
      where: (t, { and }) => and(eq(t.monthId, data.monthId), eq(t.recordDate, data.date), eq(t.status, 'approved'), isNull(t.deletedAt)),
      with: { member: { columns: { id: true, name: true } } },
    })

    const memberRows = dayMeals.map((r) => ({
      memberId: r.memberId,
      memberName: r.member.name,
      breakfastCount: r.breakfastCount,
      lunchCount: r.lunchCount,
      dinnerCount: r.dinnerCount,
      dailyCount: dailyCount(r),
    }))

    const totalMeals = memberRows.reduce((s, r) => s + r.dailyCount, 0)

    const monthBazar = await db.query.bazar.findMany({
      where: (t, { and }) => and(eq(t.monthId, data.monthId), eq(t.status, 'approved'), isNull(t.deletedAt)),
    })
    const bazarThatDay = monthBazar
      .filter((b) => b.bazarDate === data.date)
      .reduce((s, b) => s + Number(b.amount), 0)

    const monthExpenses = await db.query.expenses.findMany({
      where: (t, { and }) => and(eq(t.monthId, data.monthId), eq(t.status, 'approved'), isNull(t.deletedAt)),
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

export const getMemberReport = createServerFn({ method: 'GET' as const })
  .validator((data: { memberId: number; monthId: number }) => data)
  .handler(async ({ data }) => {
    const [member] = await db.select().from(members).where(and(eq(members.id, data.memberId), isNull(members.deletedAt))).limit(1)
    if (!member) return null

    const [month] = await db.select().from(months).where(eq(months.id, data.monthId)).limit(1)
    if (!month) return null

    const memberMeals = await db.query.meals.findMany({
      where: (t, { and }) => and(eq(t.memberId, data.memberId), eq(t.monthId, data.monthId), eq(t.status, 'approved'), isNull(t.deletedAt)),
    })

    const byDay = memberMeals.map((r) => ({ date: r.recordDate, dailyCount: dailyCount(r) }))
    const totalCount = byDay.reduce((s, d) => s + d.dailyCount, 0)

    const memberDeposits = await db.query.deposits.findMany({
      where: (t, { and }) => and(eq(t.memberId, data.memberId), eq(t.monthId, data.monthId), isNull(t.deletedAt)),
    })
    const depositList = memberDeposits.map((r) => ({ date: r.depositDate, amount: Number(r.amount) }))

    const summary = await buildSummary(data.monthId)
    const balance = await buildBalance(member.id, member.name, data.monthId, summary!)

    return {
      member: { id: member.id, name: member.name },
      month: { id: month.id, year: month.year, monthNo: month.monthNo },
      meals: { totalCount, byDay },
      deposits: depositList,
      rent: balance.rent,
      mealRate: balance.mealRate,
      mealCost: balance.mealCost,
      expenseShare: balance.expenseShare,
      regularShare: balance.regularShare,
      billableShare: balance.billableShare,
      previousBalance: balance.previousBalance,
      grossPayable: balance.grossPayable,
      netDue: balance.netDue,
      bazarContribution: balance.bazarContribution,
      expenseContribution: balance.expenseContribution,
      totalDeposit: balance.deposit,
      foodBalance: balance.foodBalance,
      rentBalance: balance.rentBalance,
      balance: balance.balance,
    }
  })
