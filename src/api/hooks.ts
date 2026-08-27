import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { toast } from 'sonner'
import { loginServerFn } from '@/server/auth'
import { listMembers, createMember, updateMember, toggleMemberActive, deleteMember } from '@/server/members'
import { listMonths, getMonth, createMonth, updateMonth, closeMonth, reopenMonth, setManager, deleteMonth } from '@/server/months'
import { getMealsByMonth, createMeal, deleteMeal, approveMeal, rejectMeal, updateMealSlot } from '@/server/meals'
import { listBazarByMonth, createBazar, updateBazar, deleteBazar, approveBazar, rejectBazar } from '@/server/bazar'
import { listExpensesByMonth, createExpense, updateExpense, deleteExpense, approveExpense, rejectExpense } from '@/server/expenses'
import { listDepositsByMonth, createDeposit, updateDeposit, deleteDeposit } from '@/server/deposits'
import { listRentsByMonth, createRent, updateRent, deleteRent } from '@/server/rents'
import { getDashboardSummary } from '@/server/dashboard'
import { getLedgerByMonth } from '@/server/ledger'
import { getMonthlyReport, getDailyReport, getMemberReport } from '@/server/reports'

import type {
  BazarPayload,
  DepositPayload,
  ExpensePayload,
  Meal,
  MemberPayload,
  RentPayload,
} from './types'

// ── Query key factory ──────────────────────────────────
export const qk = {
  members: () => ['members'] as const,
  months: () => ['months'] as const,
  month: (id: number) => ['months', id] as const,
  dashboard: (monthId: number) => ['dashboard', monthId] as const,
  meals: (monthId: number) => ['meals', monthId] as const,
  bazar: (monthId: number) => ['bazar', monthId] as const,
  expenses: (monthId: number) => ['expenses', monthId] as const,
  deposits: (monthId: number) => ['deposits', monthId] as const,
  rents: (monthId: number) => ['rents', monthId] as const,
  ledger: (monthId: number) => ['ledger', monthId] as const,
  reports: (monthId: number) => ['reports', monthId] as const,
  monthlyReport: (monthId: number) => ['reports', monthId, 'monthly'] as const,
  dailyReport: (monthId: number, date: string | undefined) => ['reports', monthId, 'daily', date ?? ''] as const,
  memberReport: (monthId: number, memberId: number | undefined) => ['reports', monthId, 'member', memberId ?? 0] as const,
}

type AppQueryClient = ReturnType<typeof useQueryClient>

const invalidateQueries = (queryClient: AppQueryClient, queryKeys: QueryKey[]) => {
  for (const queryKey of queryKeys) {
    void queryClient.invalidateQueries({ queryKey })
  }
}

const invalidateMealForMonth = (queryClient: AppQueryClient, monthId: number) => {
  invalidateQueries(queryClient, [
    qk.meals(monthId),
    qk.dashboard(monthId),
    qk.reports(monthId),
  ])
}

const invalidateMoneyForMonth = (queryClient: AppQueryClient, monthId: number, changedQueryKey: QueryKey) => {
  invalidateQueries(queryClient, [
    changedQueryKey,
    qk.dashboard(monthId),
    qk.ledger(monthId),
    qk.reports(monthId),
  ])
}

// ── Auth ───────────────────────────────────────────────
export { loginServerFn }

// ── Queries ────────────────────────────────────────────
export function useDashboard(monthId: number | undefined) {
  return useQuery({
    queryKey: qk.dashboard(monthId ?? 0),
    queryFn: () => getDashboardSummary({ data: { monthId: monthId! } }),
    enabled: !!monthId,
  })
}

export function useMonths() {
  return useQuery({ queryKey: qk.months(), queryFn: () => listMonths({ data: {} }) })
}

export function useMonth(id: number | undefined) {
  return useQuery({
    queryKey: qk.month(id ?? 0),
    queryFn: () => getMonth({ data: { id: id! } }),
    enabled: !!id,
  })
}

export function useMembers() {
  return useQuery({ queryKey: qk.members(), queryFn: () => listMembers({ data: {} }) })
}

export function useMeals(monthId: number) {
  return useQuery({ queryKey: qk.meals(monthId), queryFn: () => getMealsByMonth({ data: { monthId } }) })
}

export function useBazar(monthId: number) {
  return useQuery({ queryKey: qk.bazar(monthId), queryFn: () => listBazarByMonth({ data: { monthId } }) })
}

export function useExpenses(monthId: number) {
  return useQuery({ queryKey: qk.expenses(monthId), queryFn: () => listExpensesByMonth({ data: { monthId } }) })
}

export function useDeposits(monthId: number) {
  return useQuery({ queryKey: qk.deposits(monthId), queryFn: () => listDepositsByMonth({ data: { monthId } }) })
}

export function useRents(monthId: number) {
  return useQuery({ queryKey: qk.rents(monthId), queryFn: () => listRentsByMonth({ data: { monthId } }) })
}

export function useLedger(monthId: number) {
  return useQuery({ queryKey: qk.ledger(monthId), queryFn: () => getLedgerByMonth({ data: { monthId } }) })
}

export function useMonthlyReport(monthId: number) {
  return useQuery({
    queryKey: qk.monthlyReport(monthId),
    queryFn: () => getMonthlyReport({ data: { monthId } }),
  })
}

export function useDailyReport(monthId: number, date: string | undefined) {
  return useQuery({
    queryKey: qk.dailyReport(monthId, date),
    queryFn: () => getDailyReport({ data: { monthId, date: date! } }),
    enabled: !!date,
  })
}

export function useMemberReport(memberId: number | undefined, monthId: number) {
  return useQuery({
    queryKey: qk.memberReport(monthId, memberId),
    queryFn: () => getMemberReport({ data: { memberId: memberId!, monthId } }),
    enabled: !!memberId,
  })
}

// ── Mutations ──────────────────────────────────────────
function useApiMutation(options: { success: string; invalidate: () => void }) {
  return {
    onSuccess: () => {
      toast.success(options.success)
      options.invalidate()
    },
    onError: (error: Error) => toast.error(error.message),
  }
}

export function useUpdateMealSlot(monthId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ mealId, slot, count, status }: { mealId: number; slot: 'breakfast' | 'lunch' | 'dinner'; count: number; status?: string }) =>
      updateMealSlot({ data: { mealId, slot, count, status } }),
    onMutate: async ({ mealId, slot, count }) => {
      await queryClient.cancelQueries({ queryKey: qk.meals(monthId) })
      const prev = queryClient.getQueryData<Meal[]>(qk.meals(monthId))
      queryClient.setQueryData<Meal[]>(qk.meals(monthId), (old) =>
        old?.map((m) => {
          if (m.id !== mealId) return m
          const field = slot === 'breakfast' ? 'breakfastCount' : slot === 'lunch' ? 'lunchCount' : 'dinnerCount'
          const updated = { ...m, [field]: count }
          return { ...updated, dailyCount: updated.breakfastCount * 0.5 + updated.lunchCount * 1.0 + updated.dinnerCount * 1.0 }
        })
      )
      return { prev }
    },
    onError: (error, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(qk.meals(monthId), context.prev)
      toast.error(error.message)
    },
    onSettled: () => {
      invalidateMealForMonth(queryClient, monthId)
    },
  })
}

export function useCreateMeal(monthId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: import('./types').MealPayload & { status?: string }) =>
      createMeal({ data: { memberId: data.member.id, monthId: data.month.id, recordDate: data.recordDate, breakfastCount: data.breakfastCount, lunchCount: data.lunchCount, dinnerCount: data.dinnerCount, status: data.status } }),
    onSuccess: () => {
      invalidateMealForMonth(queryClient, monthId)
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useDeleteMeal(monthId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (mealId: number) => deleteMeal({ data: { mealId } }),
    onSuccess: () => {
      toast.success('Meal deleted')
      invalidateMealForMonth(queryClient, monthId)
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useCreateMember() {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Member created', invalidate: () => queryClient.invalidateQueries({ queryKey: qk.members() }) })
  return useMutation({ mutationFn: (data: MemberPayload) => createMember({ data }), onSuccess, onError })
}

export function useUpdateMember() {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Member updated', invalidate: () => queryClient.invalidateQueries({ queryKey: qk.members() }) })
  return useMutation({ mutationFn: ({ id, data }: { id: number; data: Partial<MemberPayload> }) => updateMember({ data: { id, ...data } }), onSuccess, onError })
}

export function useToggleMemberActive() {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Member status updated', invalidate: () => queryClient.invalidateQueries({ queryKey: qk.members() }) })
  return useMutation({
    mutationFn: (id: number) => toggleMemberActive({ data: { id } }),
    onSuccess,
    onError,
  })
}

export function useDeleteMember() {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Member deleted', invalidate: () => queryClient.invalidateQueries({ queryKey: qk.members() }) })
  return useMutation({ mutationFn: (id: number) => deleteMember({ data: { id } }), onSuccess, onError })
}

export function useCreateMonth() {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Month created', invalidate: () => queryClient.invalidateQueries({ queryKey: qk.months() }) })
  return useMutation({ mutationFn: ({ year, monthNo }: { year: number; monthNo: number }) => createMonth({ data: { year, monthNo } }), onSuccess, onError })
}

export function useUpdateMonth() {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Month updated', invalidate: () => queryClient.invalidateQueries({ queryKey: qk.months() }) })
  return useMutation({ mutationFn: ({ id, data }: { id: number; data: Partial<{ year: number; monthNo: number }> }) => updateMonth({ data: { id, ...data } }), onSuccess, onError })
}

export function useCloseMonth() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (monthId: number) => closeMonth({ data: { id: monthId } }),
    onSuccess: (_data, monthId) => {
      toast.success('Month closed')
      invalidateQueries(queryClient, [
        qk.months(),
        qk.month(monthId),
        qk.dashboard(monthId),
        qk.reports(monthId),
      ])
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useReopenMonth() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (monthId: number) => reopenMonth({ data: { id: monthId } }),
    onSuccess: (_data, monthId) => {
      toast.success('Month reopened')
      invalidateQueries(queryClient, [
        qk.months(),
        qk.month(monthId),
        qk.dashboard(monthId),
        qk.reports(monthId),
      ])
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useSetManager() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ monthId, memberId }: { monthId: number; memberId: number }) => setManager({ data: { monthId, memberId } }),
    onSuccess: (_data, { monthId }) => {
      toast.success('Manager assigned')
      invalidateQueries(queryClient, [
        qk.months(),
        qk.month(monthId),
      ])
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useDeleteMonth() {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Month deleted', invalidate: () => queryClient.invalidateQueries({ queryKey: qk.months() }) })
  return useMutation({ mutationFn: (id: number) => deleteMonth({ data: { id } }), onSuccess, onError })
}

export function useCreateBazar(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Bazar entry added', invalidate: () => invalidateMoneyForMonth(queryClient, monthId, qk.bazar(monthId)) })
  return useMutation({ mutationFn: (data: BazarPayload & { status?: string }) => createBazar({ data: { memberId: data.member.id, monthId: data.month.id, amount: data.amount, description: data.description, bazarDate: data.bazarDate, status: data.status } }), onSuccess, onError })
}

export function useUpdateBazar(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Bazar entry updated', invalidate: () => invalidateMoneyForMonth(queryClient, monthId, qk.bazar(monthId)) })
  return useMutation({ mutationFn: ({ id, data }: { id: number; data: Partial<BazarPayload> }) => updateBazar({ data: { id, ...(data.member && { memberId: data.member.id }), ...(data.amount !== undefined && { amount: data.amount }), description: data.description, bazarDate: data.bazarDate } }), onSuccess, onError })
}

export function useDeleteBazar(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Bazar entry deleted', invalidate: () => invalidateMoneyForMonth(queryClient, monthId, qk.bazar(monthId)) })
  return useMutation({ mutationFn: (id: number) => deleteBazar({ data: { id } }), onSuccess, onError })
}

export function useCreateExpense(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Expense added', invalidate: () => invalidateMoneyForMonth(queryClient, monthId, qk.expenses(monthId)) })
  return useMutation({ mutationFn: (data: ExpensePayload & { status?: string }) => createExpense({ data: { monthId: data.month.id, amount: data.amount, description: data.description, category: data.category, expenseDate: data.expenseDate, paidById: data.paidBy?.id, status: data.status } }), onSuccess, onError })
}

export function useUpdateExpense(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Expense updated', invalidate: () => invalidateMoneyForMonth(queryClient, monthId, qk.expenses(monthId)) })
  return useMutation({ mutationFn: ({ id, data }: { id: number; data: Partial<ExpensePayload> }) => updateExpense({ data: { id, ...(data.amount !== undefined && { amount: data.amount }), description: data.description, category: data.category, expenseDate: data.expenseDate, paidById: data.paidBy?.id } }), onSuccess, onError })
}

export function useDeleteExpense(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Expense deleted', invalidate: () => invalidateMoneyForMonth(queryClient, monthId, qk.expenses(monthId)) })
  return useMutation({ mutationFn: (id: number) => deleteExpense({ data: { id } }), onSuccess, onError })
}

export function useCreateDeposit(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Deposit added', invalidate: () => invalidateMoneyForMonth(queryClient, monthId, qk.deposits(monthId)) })
  return useMutation({ mutationFn: (data: DepositPayload) => createDeposit({ data: { memberId: data.member.id, monthId: data.month.id, amount: data.amount, depositDate: data.depositDate, description: data.description } }), onSuccess, onError })
}

export function useUpdateDeposit(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Deposit updated', invalidate: () => invalidateMoneyForMonth(queryClient, monthId, qk.deposits(monthId)) })
  return useMutation({ mutationFn: ({ id, data }: { id: number; data: Partial<DepositPayload> }) => updateDeposit({ data: { id, ...(data.member && { memberId: data.member.id }), ...(data.amount !== undefined && { amount: data.amount }), depositDate: data.depositDate, description: data.description } }), onSuccess, onError })
}

export function useDeleteDeposit(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Deposit deleted', invalidate: () => invalidateMoneyForMonth(queryClient, monthId, qk.deposits(monthId)) })
  return useMutation({ mutationFn: (id: number) => deleteDeposit({ data: { id } }), onSuccess, onError })
}

export function useCreateRent(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Rent set', invalidate: () => invalidateMoneyForMonth(queryClient, monthId, qk.rents(monthId)) })
  return useMutation({ mutationFn: (data: RentPayload) => createRent({ data: { memberId: data.member.id, monthId: data.month.id, amount: data.amount } }), onSuccess, onError })
}

export function useUpdateRent(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Rent updated', invalidate: () => invalidateMoneyForMonth(queryClient, monthId, qk.rents(monthId)) })
  return useMutation({ mutationFn: ({ id, data }: { id: number; data: Partial<RentPayload> }) => updateRent({ data: { id, ...(data.member && { memberId: data.member.id }), ...(data.month && { monthId: data.month.id }), ...(data.amount !== undefined && { amount: data.amount }) } }), onSuccess, onError })
}

export function useDeleteRent(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Rent removed', invalidate: () => invalidateMoneyForMonth(queryClient, monthId, qk.rents(monthId)) })
  return useMutation({ mutationFn: (id: number) => deleteRent({ data: { id } }), onSuccess, onError })
}

// ── Approve / Reject ──────────────────────────────────

export function useApproveMeal(monthId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ mealId, approvedBy }: { mealId: number; approvedBy: number }) =>
      approveMeal({ data: { mealId, approvedBy } }),
    onSuccess: () => {
      toast.success('Meal approved')
      invalidateMealForMonth(queryClient, monthId)
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useRejectMeal(monthId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ mealId, approvedBy }: { mealId: number; approvedBy: number }) =>
      rejectMeal({ data: { mealId, approvedBy } }),
    onSuccess: () => {
      toast.success('Meal rejected')
      invalidateMealForMonth(queryClient, monthId)
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useApproveBazar(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Bazar approved', invalidate: () => invalidateMoneyForMonth(queryClient, monthId, qk.bazar(monthId)) })
  return useMutation({
    mutationFn: ({ id, approvedBy }: { id: number; approvedBy: number }) =>
      approveBazar({ data: { id, approvedBy } }),
    onSuccess, onError,
  })
}

export function useRejectBazar(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Bazar rejected', invalidate: () => invalidateMoneyForMonth(queryClient, monthId, qk.bazar(monthId)) })
  return useMutation({
    mutationFn: ({ id, approvedBy }: { id: number; approvedBy: number }) =>
      rejectBazar({ data: { id, approvedBy } }),
    onSuccess, onError,
  })
}

export function useApproveExpense(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Expense approved', invalidate: () => invalidateMoneyForMonth(queryClient, monthId, qk.expenses(monthId)) })
  return useMutation({
    mutationFn: ({ id, approvedBy }: { id: number; approvedBy: number }) =>
      approveExpense({ data: { id, approvedBy } }),
    onSuccess, onError,
  })
}

export function useRejectExpense(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Expense rejected', invalidate: () => invalidateMoneyForMonth(queryClient, monthId, qk.expenses(monthId)) })
  return useMutation({
    mutationFn: ({ id, approvedBy }: { id: number; approvedBy: number }) =>
      rejectExpense({ data: { id, approvedBy } }),
    onSuccess, onError,
  })
}
