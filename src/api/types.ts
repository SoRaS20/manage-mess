export type Member = {
  id: number
  name: string
  phone?: string
  joinDate: string
  active: boolean
  banned: boolean
  userId?: number
}

export type Month = {
  id: number
  year: number
  monthNo: number
  closed: boolean
  managerId?: number | null
  managerName?: string | null
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner'

export type Meal = {
  id: number
  memberId: number
  memberName: string
  monthId: number
  recordDate: string
  breakfastOn: boolean
  lunchOn: boolean
  dinnerOn: boolean
  dailyCount: number
}

export type Bazar = {
  id: number
  memberId: number
  memberName: string
  monthId: number
  amount: number
  description?: string
  bazarDate: string
}

export type ExpenseCategory = 'gas' | 'electricity' | 'water' | 'internet' | 'other'

export type Expense = {
  id: number
  monthId: number
  amount: number
  description?: string
  category: ExpenseCategory
  expenseDate: string
  paidById?: number | null
  paidByName?: string | null
}

export type Deposit = {
  id: number
  memberId: number
  memberName: string
  monthId: number
  amount: number
  depositDate: string
  description?: string
}

export type Rent = {
  id: number
  memberId: number
  memberName: string
  monthId: number
  amount: number
}

export type DashboardSummary = {
  monthId: number
  year: number
  monthNo: number
  closed: boolean
  memberCount: number
  totalMeals: number
  totalBazar: number
  mealRate: number
  totalExpenses: number
  totalDeposits: number
  expenseSharePerMember: number
}

export type MonthlyReport = {
  month: { id: number; year: number; monthNo: number; closed: boolean }
  summary: {
    totalMeals: number
    totalBazar: number
    mealRate: number
    totalExpenses: number
    totalDeposits: number
    memberCount: number
    expenseSharePerMember: number
  }
  members: Array<{
    memberId: number
    memberName: string
    meals: number
    mealRate: number
    mealCost: number
    expenseShare: number
    rent: number
    deposit: number
    balance: number
  }>
  totals: {
    deposits: number
    mealCost: number
    expenses: number
    rent: number
    netBalance: number
  }
}

export type DailyReport = {
  date: string
  monthId: number
  members: Array<{
    memberId: number
    memberName: string
    breakfastOn: boolean
    lunchOn: boolean
    dinnerOn: boolean
    dailyCount: number
  }>
  dayTotals: {
    totalMeals: number
    bazarThatDay: number
    expensesThatDay: number
  }
}

export type MemberReport = {
  member: { id: number; name: string }
  month: { id: number; year: number; monthNo: number }
  meals: {
    totalCount: number
    byDay: Array<{ date: string; dailyCount: number }>
  }
  deposits: Array<{ date: string; amount: number }>
  rent: number
  mealRate: number
  mealCost: number
  expenseShare: number
  totalDeposit: number
  balance: number
}

// ---- payloads ----
export type MemberPayload = {
  name: string
  phone?: string
  joinDate: string
  active?: boolean
  banned?: boolean
  createAppUser?: boolean
  username?: string
  password?: string
}

export type MonthPayload = {
  year: number
  monthNo: number
}

export type MealTogglePayload = {
  slot: MealSlot
  on: boolean
}

export type MealFlagsPayload = {
  breakfastOn?: boolean
  lunchOn?: boolean
  dinnerOn?: boolean
}

export type BazarPayload = {
  member: { id: number }
  month: { id: number }
  amount: number
  description?: string
  bazarDate: string
}

export type ExpensePayload = {
  month: { id: number }
  amount: number
  description?: string
  category: ExpenseCategory
  expenseDate: string
  paidBy?: { id: number }
}

export type DepositPayload = {
  member: { id: number }
  month: { id: number }
  amount: number
  depositDate: string
  description?: string
}

export type RentPayload = {
  member: { id: number }
  month: { id: number }
  amount: number
}