import { Link, createFileRoute, useLocation, useNavigate } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { ArrowRight, Banknote, CalendarDays, Coins, FileText, FlaskConical, Receipt, Users, Utensils, Wallet } from 'lucide-react'
import { z } from 'zod'
import { useDashboard, useMonthlyReport, useMonths } from '@/api/hooks'
import { MonthSelect } from '@/components/month-select'
import { StatCard } from '@/components/stat-card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatNumber, formatTaka, monthLabel } from '@/lib/format'

const dashboardSearchSchema = z.object({
  monthId: z.number().optional(),
})

export const Route = createFileRoute('/')({
  validateSearch: zodValidator(dashboardSearchSchema),
  component: DashboardPage,
})

function DashboardPage() {
  const location = useLocation()
  const monthId = (location.search as { monthId?: number })?.monthId
  const navigate = useNavigate()

  const { data: months, isLoading: monthsLoading } = useMonths()
  const now = new Date()
  const currentMonth = months?.find((m) => m.year === now.getFullYear() && m.monthNo === now.getMonth() + 1)
  const selectedId = monthId ?? currentMonth?.id ?? months?.[0]?.id

  const { data: dashboard, isLoading } = useDashboard(selectedId)
  const { data: report, isLoading: reportLoading } = useMonthlyReport(selectedId ?? 0)

  const setMonth = (id: number) => navigate({ search: { monthId: id } as any })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {dashboard ? monthLabel(dashboard.year, dashboard.monthNo) : 'Select a month to view summary'}
          </p>
        </div>
        <MonthSelect months={months} value={selectedId} onChange={setMonth} loading={monthsLoading} className="w-52" />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        <StatCard
          title="Active members"
          value={dashboard?.memberCount ?? '—'}
          icon={<Users className="size-5" />}
          iconBg="bg-primary/10 text-primary"
          loading={isLoading}
        />
        <StatCard
          title="Total meals"
          value={dashboard ? formatNumber(dashboard.totalMeals) : '—'}
          description="Breakfast 0.5 · lunch 1 · dinner 1"
          icon={<Utensils className="size-5" />}
          iconBg="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          loading={isLoading}
        />
        <StatCard
          title="Meal rate"
          value={dashboard ? formatTaka(dashboard.mealRate) : '—'}
          description="Total bazar ÷ total meals"
          icon={<Coins className="size-5" />}
          iconBg="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          loading={isLoading}
        />
        <StatCard
          title="Total bazar"
          value={dashboard ? formatTaka(dashboard.totalBazar) : '—'}
          icon={<Banknote className="size-5" />}
          iconBg="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          loading={isLoading}
        />
        <StatCard
          title="Total expenses"
          value={dashboard ? formatTaka(dashboard.totalExpenses) : '—'}
          icon={<FlaskConical className="size-5" />}
          iconBg="bg-destructive/10 text-destructive"
          loading={isLoading}
        />
        <StatCard
          title="Total deposits"
          value={dashboard ? formatTaka(dashboard.totalDeposits) : '—'}
          icon={<Coins className="size-5" />}
          iconBg="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          loading={isLoading}
        />
        <StatCard
          title="Expense share / member"
          value={dashboard ? formatTaka(dashboard.expenseSharePerMember) : '—'}
          description={`Split across ${dashboard?.memberCount ?? 0} active members`}
          icon={<Receipt className="size-5" />}
          iconBg="bg-violet-500/10 text-violet-600 dark:text-violet-400"
          loading={isLoading}
        />
        <StatCard
          title="Status"
          value={
            dashboard ? (
              dashboard.closed ? (
                <Badge variant="destructive">Closed</Badge>
              ) : (
                <Badge variant="secondary">Open</Badge>
              )
            ) : (
              '—'
            )
          }
          icon={<CalendarDays className="size-5" />}
          iconBg="bg-muted"
          loading={isLoading}
        />
      </div>

      {selectedId ? (
        <Card className="border-primary/20 bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
                <CardDescription>Direct shortcuts to manage mess activities for this month.</CardDescription>
              </div>
              <Link
                to="/months/$monthId"
                params={{ monthId: String(selectedId) } as any}
                className={buttonVariants({ variant: 'default', size: 'sm' })}
              >
                Full Month View <ArrowRight />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              <Link
                to="/months/$monthId"
                params={{ monthId: String(selectedId) } as any}
                search={{ tab: 'meals' }}
                className="group flex flex-col items-center justify-center rounded-xl border bg-background p-4 text-center transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm"
              >
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Utensils className="size-5" />
                </div>
                <span className="text-xs font-medium">Meals Grid</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">Toggle daily meals</span>
              </Link>
              <Link
                to="/months/$monthId"
                params={{ monthId: String(selectedId) } as any}
                search={{ tab: 'bazar' }}
                className="group flex flex-col items-center justify-center rounded-xl border bg-background p-4 text-center transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm"
              >
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 transition-colors group-hover:bg-emerald-500 group-hover:text-white">
                  <Banknote className="size-5" />
                </div>
                <span className="text-xs font-medium">Bazar</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">Log shopping costs</span>
              </Link>
              <Link
                to="/months/$monthId"
                params={{ monthId: String(selectedId) } as any}
                search={{ tab: 'expenses' }}
                className="group flex flex-col items-center justify-center rounded-xl border bg-background p-4 text-center transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm"
              >
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive transition-colors group-hover:bg-destructive group-hover:text-white">
                  <FlaskConical className="size-5" />
                </div>
                <span className="text-xs font-medium">Expenses</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">Record extra costs</span>
              </Link>
              <Link
                to="/months/$monthId"
                params={{ monthId: String(selectedId) } as any}
                search={{ tab: 'deposits' }}
                className="group flex flex-col items-center justify-center rounded-xl border bg-background p-4 text-center transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm"
              >
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 transition-colors group-hover:bg-blue-500 group-hover:text-white">
                  <Wallet className="size-5" />
                </div>
                <span className="text-xs font-medium">Deposits</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">Track member deposits</span>
              </Link>
              <Link
                to="/months/$monthId"
                params={{ monthId: String(selectedId) } as any}
                search={{ tab: 'reports' }}
                className="group flex flex-col items-center justify-center rounded-xl border bg-background p-4 text-center transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm"
              >
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 transition-colors group-hover:bg-violet-500 group-hover:text-white">
                  <FileText className="size-5" />
                </div>
                <span className="text-xs font-medium">Reports</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">View detailed reports</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Member balances</CardTitle>
          <CardDescription>Individual summary of meals, costs, expenses, and net balance.</CardDescription>
        </CardHeader>
        <CardContent>
          {reportLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : report?.members.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-right">Meals</TableHead>
                  <TableHead className="text-right">Meal cost</TableHead>
                  <TableHead className="text-right">Expense</TableHead>
                  <TableHead className="text-right">Rent</TableHead>
                  <TableHead className="text-right">Deposit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.members.map((m) => (
                  <TableRow key={m.memberId}>
                    <TableCell className="font-medium">{m.memberName}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(m.meals)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatTaka(m.mealCost)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatTaka(m.expenseShare)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatTaka(m.rent)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatTaka(m.deposit)}</TableCell>
                    <TableCell className={`text-right font-medium tabular-nums ${m.balance >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                      {formatTaka(m.balance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {!selectedId ? 'No month found — create one under Months.' : 'No member data for this month yet.'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}