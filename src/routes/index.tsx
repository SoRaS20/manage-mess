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
          description={dashboard ? `Billable ${formatTaka(dashboard.totalBillableExpenses)} · Regular ${formatTaka(dashboard.totalRegularExpenses)}` : undefined}
          icon={<FlaskConical className="size-5" />}
          iconBg="bg-destructive/10 text-destructive"
          loading={isLoading}
        />
        <StatCard
          title="Billable share / member"
          value={dashboard ? formatTaka(dashboard.billableSharePerMember) : '—'}
          description={`Billable only (wifi etc) ÷ ${dashboard?.memberCount ?? 0} members`}
          icon={<Receipt className="size-5" />}
          iconBg="bg-violet-500/10 text-violet-600 dark:text-violet-400"
          loading={isLoading}
        />
        <StatCard
          title="Regular share / member"
          value={dashboard ? formatTaka(dashboard.regularSharePerMember) : '—'}
          description="Regular expenses ÷ active members"
          icon={<Receipt className="size-5" />}
          iconBg="bg-amber-500/10 text-amber-600 dark:text-amber-400"
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
          title="Prev balances"
          value={dashboard ? formatTaka(dashboard.totalPreviousBalances) : '—'}
          description="Sum of previous dues this month"
          icon={<Wallet className="size-5" />}
          iconBg="bg-orange-500/10 text-orange-600 dark:text-orange-400"
          loading={isLoading}
        />
        <StatCard
          title="Expense share (all) / member"
          value={dashboard ? formatTaka(dashboard.expenseSharePerMember) : '—'}
          description={`Total expenses ÷ ${dashboard?.memberCount ?? 0} members`}
          icon={<Receipt className="size-5" />}
          iconBg="bg-muted"
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
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <Link
                to="/months/$monthId"
                params={{ monthId: String(selectedId) } as any}
                search={{ tab: 'meals' }}
                className="group flex flex-col items-center rounded-lg border bg-background px-2 py-3 text-center transition-all hover:border-primary/30 hover:bg-primary/5"
              >
                <Utensils className="mb-1.5 size-4 text-primary transition-colors group-hover:text-primary" />
                <span className="text-xs font-medium leading-tight">Meals</span>
              </Link>
              <Link
                to="/months/$monthId"
                params={{ monthId: String(selectedId) } as any}
                search={{ tab: 'bazar' }}
                className="group flex flex-col items-center rounded-lg border bg-background px-2 py-3 text-center transition-all hover:border-primary/30 hover:bg-primary/5"
              >
                <Banknote className="mb-1.5 size-4 text-emerald-600 dark:text-emerald-400 transition-colors" />
                <span className="text-xs font-medium leading-tight">Bazar</span>
              </Link>
              <Link
                to="/months/$monthId"
                params={{ monthId: String(selectedId) } as any}
                search={{ tab: 'expenses' }}
                className="group flex flex-col items-center rounded-lg border bg-background px-2 py-3 text-center transition-all hover:border-primary/30 hover:bg-primary/5"
              >
                <FlaskConical className="mb-1.5 size-4 text-destructive transition-colors" />
                <span className="text-xs font-medium leading-tight">Expenses</span>
              </Link>
              <Link
                to="/months/$monthId"
                params={{ monthId: String(selectedId) } as any}
                search={{ tab: 'deposits' }}
                className="group flex flex-col items-center rounded-lg border bg-background px-2 py-3 text-center transition-all hover:border-primary/30 hover:bg-primary/5"
              >
                <Wallet className="mb-1.5 size-4 text-blue-600 dark:text-blue-400 transition-colors" />
                <span className="text-xs font-medium leading-tight">Deposits</span>
              </Link>
              <Link
                to="/months/$monthId"
                params={{ monthId: String(selectedId) } as any}
                search={{ tab: 'reports' }}
                className="group flex flex-col items-center rounded-lg border bg-background px-2 py-3 text-center transition-all hover:border-primary/30 hover:bg-primary/5"
              >
                <FileText className="mb-1.5 size-4 text-violet-600 dark:text-violet-400 transition-colors" />
                <span className="text-xs font-medium leading-tight">Reports</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Member balances — Total Pay = Billable + Previous + Rent</CardTitle>
          <CardDescription>Individual summary: Gross Pay = billable share + previous balance + rent. Net Due = Gross − deposit.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
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
                  <TableHead className="text-right">Billable</TableHead>
                  <TableHead className="text-right">Prev</TableHead>
                  <TableHead className="text-right">Rent</TableHead>
                  <TableHead className="text-right">Gross Pay</TableHead>
                  <TableHead className="text-right">Deposit</TableHead>
                  <TableHead className="text-right">Net Due</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.members.map((m) => (
                  <TableRow key={m.memberId}>
                    <TableCell className="font-medium">{m.memberName}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(m.meals)}</TableCell>
                    <TableCell className="text-right tabular-nums text-violet-600">{formatTaka(m.billableShare)}</TableCell>
                    <TableCell className="text-right tabular-nums text-orange-600">{formatTaka(m.previousBalance)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatTaka(m.rent)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{formatTaka(m.grossPayable)}</TableCell>
                    <TableCell className="text-right tabular-nums text-purple-600">{formatTaka(m.deposit)}</TableCell>
                    <TableCell className={`text-right font-bold tabular-nums ${m.netDue <= 0 ? 'text-emerald-600' : 'text-destructive'}`}>{formatTaka(m.netDue)}</TableCell>
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