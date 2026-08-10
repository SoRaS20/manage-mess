import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  bazarApi,
  dashboardApi,
  depositsApi,
  expensesApi,
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
}

const invalidateForMonth = async (queryClient: ReturnType<typeof useQueryClient>, monthId: number) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['meals', monthId] }),
    queryClient.invalidateQueries({ queryKey: ['bazar', monthId] }),
    queryClient.invalidateQueries({ queryKey: ['expenses', monthId] }),
    queryClient.invalidateQueries({ queryKey: ['deposits', monthId] }),
    queryClient.invalidateQueries({ queryKey: ['rents', monthId] }),
    queryClient.invalidateQueries({ queryKey: qk.dashboard(monthId) }),
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

export function useMonthlyReport(monthId: number) {
  return useQuery({
    queryKey: [qk.dashboard(monthId), 'report'],
    queryFn: () => reportsApi.monthly(monthId),
  })
}

export function useDailyReport(monthId: number, date: string | undefined) {
  return useQuery({
    queryKey: ['reports', 'daily', monthId, date],
    queryFn: () => reportsApi.daily(monthId, date!),
    enabled: !!date,
  })
}

export function useMemberReport(memberId: number | undefined, monthId: number) {
  return useQuery({
    queryKey: ['reports', 'member', memberId, monthId],
    queryFn: () => reportsApi.member(memberId!, monthId),
    enabled: !!memberId,
  })
}

// ---------------- mutations ----------------

function useApiMutation(options: { success: string; invalidate: () => Promise<unknown> | unknown }) {
  return {
    onSuccess: async () => {
      toast.success(options.success)
      await options.invalidate()
    },
    onError: (error: Error) => toast.error(error.message),
  }
}

export function useGenerateMeals(monthId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => mealsApi.generate(monthId),
    onSuccess: async (res) => {
      toast.success(`Generated ${res.created} meal rows`)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.meals(monthId) }),
        queryClient.invalidateQueries({ queryKey: qk.dashboard(monthId) }),
      ])
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
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.meals(monthId) }),
        queryClient.invalidateQueries({ queryKey: qk.dashboard(monthId) }),
      ])
    },
  })
}

export function useUpdateMeal(monthId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ mealId, flags }: { mealId: number; flags: { breakfastOn?: boolean; lunchOn?: boolean; dinnerOn?: boolean } }) =>
      mealsApi.update(mealId, flags),
    onSuccess: async () => {
      toast.success('Meal updated')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.meals(monthId) }),
        queryClient.invalidateQueries({ queryKey: qk.dashboard(monthId) }),
      ])
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useDeleteMeal(monthId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => mealsApi.remove(id),
    onSuccess: async () => {
      toast.success('Meal deleted')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.meals(monthId) }),
        queryClient.invalidateQueries({ queryKey: qk.dashboard(monthId) }),
      ])
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
    onSuccess: async (_data, monthId) => {
      toast.success('Month closed')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.months() }),
        queryClient.invalidateQueries({ queryKey: qk.month(monthId) }),
      ])
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useReopenMonth() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (monthId: number) => monthsApi.reopen(monthId),
    onSuccess: async (_data, monthId) => {
      toast.success('Month reopened')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.months() }),
        queryClient.invalidateQueries({ queryKey: qk.month(monthId) }),
      ])
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useSetManager() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ monthId, memberId }: { monthId: number; memberId: number }) => monthsApi.setManager(monthId, memberId),
    onSuccess: async (_data, { monthId }) => {
      toast.success('Manager assigned')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.months() }),
        queryClient.invalidateQueries({ queryKey: qk.month(monthId) }),
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
  const { onSuccess, onError } = useApiMutation({ success: 'Bazar entry added', invalidate: () => invalidateForMonth(queryClient, monthId) })
  return useMutation({ mutationFn: (data: BazarPayload) => bazarApi.create(data), onSuccess, onError })
}

export function useUpdateBazar(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Bazar entry updated', invalidate: () => invalidateForMonth(queryClient, monthId) })
  return useMutation({ mutationFn: ({ id, data }: { id: number; data: Partial<BazarPayload> }) => bazarApi.update(id, data), onSuccess, onError })
}

export function useDeleteBazar(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Bazar entry deleted', invalidate: () => invalidateForMonth(queryClient, monthId) })
  return useMutation({ mutationFn: (id: number) => bazarApi.remove(id), onSuccess, onError })
}

export function useCreateExpense(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Expense added', invalidate: () => invalidateForMonth(queryClient, monthId) })
  return useMutation({ mutationFn: (data: ExpensePayload) => expensesApi.create(data), onSuccess, onError })
}

export function useUpdateExpense(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Expense updated', invalidate: () => invalidateForMonth(queryClient, monthId) })
  return useMutation({ mutationFn: ({ id, data }: { id: number; data: Partial<ExpensePayload> }) => expensesApi.update(id, data), onSuccess, onError })
}

export function useDeleteExpense(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Expense deleted', invalidate: () => invalidateForMonth(queryClient, monthId) })
  return useMutation({ mutationFn: (id: number) => expensesApi.remove(id), onSuccess, onError })
}

export function useCreateDeposit(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Deposit added', invalidate: () => invalidateForMonth(queryClient, monthId) })
  return useMutation({ mutationFn: (data: DepositPayload) => depositsApi.create(data), onSuccess, onError })
}

export function useUpdateDeposit(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Deposit updated', invalidate: () => invalidateForMonth(queryClient, monthId) })
  return useMutation({ mutationFn: ({ id, data }: { id: number; data: Partial<DepositPayload> }) => depositsApi.update(id, data), onSuccess, onError })
}

export function useDeleteDeposit(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Deposit deleted', invalidate: () => invalidateForMonth(queryClient, monthId) })
  return useMutation({ mutationFn: (id: number) => depositsApi.remove(id), onSuccess, onError })
}

export function useCreateRent(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Rent set', invalidate: () => invalidateForMonth(queryClient, monthId) })
  return useMutation({ mutationFn: (data: RentPayload) => rentsApi.create(data), onSuccess, onError })
}

export function useUpdateRent(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Rent updated', invalidate: () => invalidateForMonth(queryClient, monthId) })
  return useMutation({ mutationFn: ({ id, data }: { id: number; data: Partial<RentPayload> }) => rentsApi.update(id, data), onSuccess, onError })
}

export function useDeleteRent(monthId: number) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = useApiMutation({ success: 'Rent removed', invalidate: () => invalidateForMonth(queryClient, monthId) })
  return useMutation({ mutationFn: (id: number) => rentsApi.remove(id), onSuccess, onError })
}