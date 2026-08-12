import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  bazarApi,
  dashboardApi,
  depositsApi,
  expensesApi,
  ledgerApi,
  mealsApi,
  membersApi,
  monthsApi,
  rentsApi,
  reportsApi,
} from './resources'
import type { BazarPayload, DepositPayload, ExpensePayload, Meal, MemberPayload, RentPayload } from './types'

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

export function useDashboard(monthId: number | undefined) {
  return useQuery({ queryKey: qk.dashboard(monthId ?? 0), queryFn: () => dashboardApi.summary(monthId!), enabled: !!monthId })
}

export function useMonths() {
  return useQuery({ queryKey: qk.months(), queryFn: monthsApi.list })
}

export function useMonth(id: number | undefined) {
  return useQuery({ queryKey: qk.month(id ?? 0), queryFn: () => monthsApi.get(id!), enabled: !!id })
}

export function useMembers() {
  return useQuery({ queryKey: qk.members(), queryFn: membersApi.list })
}

export function useMeals(monthId: number) {
  return useQuery({ queryKey: qk.meals(monthId), queryFn: () => mealsApi.byMonth(monthId) })
}

export function useBazar(monthId: number) {
  return useQuery({ queryKey: qk.bazar(monthId), queryFn: () => bazarApi.byMonth(monthId) })
}

export function useExpenses(monthId: number) {
  return useQuery({ queryKey: qk.expenses(monthId), queryFn: () => expensesApi.byMonth(monthId) })
}

export function useDeposits(monthId: number) {
  return useQuery({ queryKey: qk.deposits(monthId), queryFn: () => depositsApi.byMonth(monthId) })
}

export function useRents(monthId: number) {
  return useQuery({ queryKey: qk.rents(monthId), queryFn: () => rentsApi.byMonth(monthId) })
}

export function useLedger(monthId: number) {
  return useQuery({ queryKey: qk.ledger(monthId), queryFn: () => ledgerApi.byMonth(monthId) })
}

export function useMonthlyReport(monthId: number) {
  return useQuery({
    queryKey: qk.monthlyReport(monthId),
    queryFn: () => reportsApi.monthly(monthId),
  })
}

export function useDailyReport(monthId: number, date: string | undefined) {
  return useQuery({
    queryKey: qk.dailyReport(monthId, date),
    queryFn: () => reportsApi.daily(monthId, date!),
    enabled: !!date,
  })
}

export function useMemberReport(memberId: number | undefined, monthId: number) {
  return useQuery({
    queryKey: qk.memberReport(monthId, memberId),
    queryFn: () => reportsApi.member(memberId!, monthId),
    enabled: !!memberId,
  })
}

// ---------------- mutations ----------------

function useApiMutation(options: { success: string; invalidate: () => void }) {
  return {
    onSuccess: () => {
      toast.success(options.success)
      options.invalidate()
    },
    onError: (error: Error) => toast.error(error.message),
  }
}

export function useGenerateMeals(monthId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => mealsApi.generate(monthId),
    onSuccess: (res) => {
      toast.success(`Generated ${res.created} meal rows`)
      invalidateMealForMonth(queryClient, monthId)
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useToggleMeal(monthId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ mealId, slot, on }: { mealId: number; slot: 'breakfast' | 'lunch' | 'dinner'; on: boolean }) =>
      mealsApi.toggle(mealId, { slot, on }),
    onMutate: async ({ mealId, slot, on }) => {
      await queryClient.cancelQueries({ queryKey: qk.meals(monthId) })
      const prev = queryClient.getQueryData<Meal[]>(qk.meals(monthId))
      queryClient.setQueryData<Meal[]>(qk.meals(monthId), (old) =>
        old?.map((m) => {
          if (m.id !== mealId) return m
          const updated = slot === 'breakfast' ? { ...m, breakfastOn: on } : slot === 'lunch' ? { ...m, lunchOn: on } : { ...m, dinnerOn: on }
          return { ...updated, dailyCount: (updated.breakfastOn ? 0.5 : 0) + (updated.lunchOn ? 1 : 0) + (updated.dinnerOn ? 1 : 0) }
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
    mutationFn: (data: import('./types').MealPayload) => mealsApi.create(data),
    onSuccess: () => {
      invalidateMealForMonth(queryClient, monthId)
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useUpdateMeal(monthId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ mealId, flags }: { mealId: number; flags: { breakfastOn?: boolean; lunchOn?: boolean; dinnerOn?: boolean } }) =>
      mealsApi.update(mealId, flags),
    onSuccess: () => {
      toast.success('Meal updated')
      invalidateMealForMonth(queryClient, monthId)
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useDeleteMeal(monthId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => mealsApi.remove(id),
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
  return useMutation({ mutationFn: (data: MemberPayload) => membersApi.create(data), onSuccess, onError })
}

export function useUpdateMember() {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Member updated', invalidate: () => queryClient.invalidateQueries({ queryKey: qk.members() }) })
  return useMutation({ mutationFn: ({ id, data }: { id: number; data: Partial<MemberPayload> }) => membersApi.update(id, data), onSuccess, onError })
}

export function useToggleMemberActive() {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Member status updated', invalidate: () => queryClient.invalidateQueries({ queryKey: qk.members() }) })
  return useMutation({
    mutationFn: (id: number) => membersApi.toggleActive(id),
    onSuccess,
    onError,
  })
}

export function useDeleteMember() {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Member deleted', invalidate: () => queryClient.invalidateQueries({ queryKey: qk.members() }) })
  return useMutation({ mutationFn: (id: number) => membersApi.remove(id), onSuccess, onError })
}

export function useCreateMonth() {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Month created', invalidate: () => queryClient.invalidateQueries({ queryKey: qk.months() }) })
  return useMutation({ mutationFn: ({ year, monthNo }: { year: number; monthNo: number }) => monthsApi.create({ year, monthNo }), onSuccess, onError })
}

export function useUpdateMonth() {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Month updated', invalidate: () => queryClient.invalidateQueries({ queryKey: qk.months() }) })
  return useMutation({ mutationFn: ({ id, data }: { id: number; data: Partial<{ year: number; monthNo: number }> }) => monthsApi.update(id, data), onSuccess, onError })
}

export function useCloseMonth() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (monthId: number) => monthsApi.close(monthId),
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
    mutationFn: (monthId: number) => monthsApi.reopen(monthId),
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
    mutationFn: ({ monthId, memberId }: { monthId: number; memberId: number }) => monthsApi.setManager(monthId, memberId),
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
  return useMutation({ mutationFn: (id: number) => monthsApi.remove(id), onSuccess, onError })
}

export function useCreateBazar(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Bazar entry added', invalidate: () => invalidateMoneyForMonth(queryClient, monthId, qk.bazar(monthId)) })
  return useMutation({ mutationFn: (data: BazarPayload) => bazarApi.create(data), onSuccess, onError })
}

export function useUpdateBazar(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Bazar entry updated', invalidate: () => invalidateMoneyForMonth(queryClient, monthId, qk.bazar(monthId)) })
  return useMutation({ mutationFn: ({ id, data }: { id: number; data: Partial<BazarPayload> }) => bazarApi.update(id, data), onSuccess, onError })
}

export function useDeleteBazar(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Bazar entry deleted', invalidate: () => invalidateMoneyForMonth(queryClient, monthId, qk.bazar(monthId)) })
  return useMutation({ mutationFn: (id: number) => bazarApi.remove(id), onSuccess, onError })
}

export function useCreateExpense(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Expense added', invalidate: () => invalidateMoneyForMonth(queryClient, monthId, qk.expenses(monthId)) })
  return useMutation({ mutationFn: (data: ExpensePayload) => expensesApi.create(data), onSuccess, onError })
}

export function useUpdateExpense(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Expense updated', invalidate: () => invalidateMoneyForMonth(queryClient, monthId, qk.expenses(monthId)) })
  return useMutation({ mutationFn: ({ id, data }: { id: number; data: Partial<ExpensePayload> }) => expensesApi.update(id, data), onSuccess, onError })
}

export function useDeleteExpense(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Expense deleted', invalidate: () => invalidateMoneyForMonth(queryClient, monthId, qk.expenses(monthId)) })
  return useMutation({ mutationFn: (id: number) => expensesApi.remove(id), onSuccess, onError })
}

export function useCreateDeposit(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Deposit added', invalidate: () => invalidateMoneyForMonth(queryClient, monthId, qk.deposits(monthId)) })
  return useMutation({ mutationFn: (data: DepositPayload) => depositsApi.create(data), onSuccess, onError })
}

export function useUpdateDeposit(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Deposit updated', invalidate: () => invalidateMoneyForMonth(queryClient, monthId, qk.deposits(monthId)) })
  return useMutation({ mutationFn: ({ id, data }: { id: number; data: Partial<DepositPayload> }) => depositsApi.update(id, data), onSuccess, onError })
}

export function useDeleteDeposit(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Deposit deleted', invalidate: () => invalidateMoneyForMonth(queryClient, monthId, qk.deposits(monthId)) })
  return useMutation({ mutationFn: (id: number) => depositsApi.remove(id), onSuccess, onError })
}

export function useCreateRent(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Rent set', invalidate: () => invalidateMoneyForMonth(queryClient, monthId, qk.rents(monthId)) })
  return useMutation({ mutationFn: (data: RentPayload) => rentsApi.create(data), onSuccess, onError })
}

export function useUpdateRent(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Rent updated', invalidate: () => invalidateMoneyForMonth(queryClient, monthId, qk.rents(monthId)) })
  return useMutation({ mutationFn: ({ id, data }: { id: number; data: Partial<RentPayload> }) => rentsApi.update(id, data), onSuccess, onError })
}

export function useDeleteRent(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Rent removed', invalidate: () => invalidateMoneyForMonth(queryClient, monthId, qk.rents(monthId)) })
  return useMutation({ mutationFn: (id: number) => rentsApi.remove(id), onSuccess, onError })
}
