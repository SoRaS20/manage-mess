import { api } from '@/lib/api'
import type {
  Bazar,
  BazarPayload,
  DailyReport,
  DashboardSummary,
  Deposit,
  DepositPayload,
  Expense,
  ExpensePayload,
  Meal,
  MealFlagsPayload,
  MealTogglePayload,
  Member,
  MemberPayload,
  MemberReport,
  Month,
  MonthPayload,
  MonthlyReport,
  Rent,
  RentPayload,
} from './types'

export const membersApi = {
  list: () => api.get<Member[]>('/members'),
  get: (id: number) => api.get<Member>(`/members/${id}`),
  create: (data: MemberPayload) => api.post<Member>('/members', data),
  update: (id: number, data: Partial<MemberPayload>) => api.put<Member>(`/members/${id}`, data),
  toggleActive: (id: number) => api.put<Member>(`/members/${id}/toggleActive`),
  remove: (id: number) => api.del(`/members/${id}`),
}

export const monthsApi = {
  list: () => api.get<Month[]>('/months'),
  get: (id: number) => api.get<Month>(`/months/${id}`),
  create: (data: MonthPayload) => api.post<Month>('/months', data),
  close: (id: number) => api.put<Month>(`/months/${id}/close`),
  reopen: (id: number) => api.put<Month>(`/months/${id}/reopen`),
  setManager: (id: number, memberId: number) => api.put<Month>(`/months/${id}/manager/${memberId}`),
  update: (id: number, data: Partial<MonthPayload>) => api.put<Month>(`/months/${id}`, data),
  remove: (id: number) => api.del(`/months/${id}`),
}

export const mealsApi = {
  generate: (monthId: number) => api.post<{ created: number }>(`/meals/generate/${monthId}`),
  byMonth: (monthId: number) => api.get<Meal[]>(`/meals/byMonth/${monthId}`),
  byDate: (monthId: number, date: string) => api.get<Meal[]>(`/meals/byDate/${monthId}/${date}`),
  get: (id: number) => api.get<Meal>(`/meals/${id}`),
  toggle: (id: number, data: MealTogglePayload) => api.put<Meal>(`/meals/${id}/toggle`, data),
  update: (id: number, data: MealFlagsPayload) => api.put<Meal>(`/meals/${id}`, data),
  remove: (id: number) => api.del(`/meals/${id}`),
}

export const bazarApi = {
  byMonth: (monthId: number) => api.get<Bazar[]>(`/bazar/byMonth/${monthId}`),
  get: (id: number) => api.get<Bazar>(`/bazar/${id}`),
  create: (data: BazarPayload) => api.post<Bazar>('/bazar', data),
  update: (id: number, data: Partial<BazarPayload>) => api.put<Bazar>(`/bazar/${id}`, data),
  remove: (id: number) => api.del(`/bazar/${id}`),
}

export const expensesApi = {
  byMonth: (monthId: number) => api.get<Expense[]>(`/expenses/byMonth/${monthId}`),
  create: (data: ExpensePayload) => api.post<Expense>('/expenses', data),
  update: (id: number, data: Partial<ExpensePayload>) => api.put<Expense>(`/expenses/${id}`, data),
  remove: (id: number) => api.del(`/expenses/${id}`),
}

export const depositsApi = {
  byMonth: (monthId: number) => api.get<Deposit[]>(`/deposits/byMonth/${monthId}`),
  create: (data: DepositPayload) => api.post<Deposit>('/deposits', data),
  update: (id: number, data: Partial<DepositPayload>) => api.put<Deposit>(`/deposits/${id}`, data),
  remove: (id: number) => api.del(`/deposits/${id}`),
}

export const rentsApi = {
  byMonth: (monthId: number) => api.get<Rent[]>(`/rents/byMonth/${monthId}`),
  create: (data: RentPayload) => api.post<Rent>('/rents', data),
  update: (id: number, data: Partial<RentPayload>) => api.put<Rent>(`/rents/${id}`, data),
  remove: (id: number) => api.del(`/rents/${id}`),
}

export const dashboardApi = {
  summary: (monthId: number) => api.get<DashboardSummary>(`/dashboard/${monthId}`),
}

export const reportsApi = {
  monthly: (monthId: number) => api.get<MonthlyReport>(`/reports/monthly/${monthId}`),
  daily: (monthId: number, date: string) => api.get<DailyReport>(`/reports/daily/${monthId}/${date}`),
  member: (memberId: number, monthId: number) => api.get<MemberReport>(`/reports/member/${memberId}/${monthId}`),
}

