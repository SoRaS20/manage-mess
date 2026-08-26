import { Link, createFileRoute, useLocation, useNavigate } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { ArrowRight, Banknote, CalendarDays, Coins, FlaskConical, Receipt, Users, Utensils } from 'lucide-react'
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
  const active = months?.find((m) => !m.closed) ?? months?.[0]
  const selectedId = monthId ?? active?.id

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
          icon={<Users className="size-4" />}
          loading={isLoading}
        />
        <StatCard
          title="Total meals"
          value={dashboard ? formatNumber(dashboard.totalMeals) : '—'}
          description="Breakfast 0.5 · lunch 1 · dinner 1"
          icon={<Utensils className="size-4" />}
          loading={isLoading}
        />
        <StatCard
          title="Meal rate"
          value={dashboard ? formatTaka(dashboard.mealRate) : '—'}
          description="Total bazar ÷ total meals"
          icon={<Coins className="size-4" />}
          loading={isLoading}
        />
        <StatCard
          title="Total bazar"
          value={dashboard ? formatTaka(dashboard.totalBazar) : '—'}
          icon={<Banknote className="size-4" />}
          loading={isLoading}
        />
        <StatCard
          title="Total expenses"
          value={dashboard ? formatTaka(dashboard.totalExpenses) : '—'}
          icon={<FlaskConical className="size-4" />}
          loading={isLoading}
        />
        <StatCard
          title="Total deposits"
          value={dashboard ? formatTaka(dashboard.totalDeposits) : '—'}
          icon={<Coins className="size-4" />}
          loading={isLoading}
        />
        <StatCard
          title="Expense share / member"
          value={dashboard ? formatTaka(dashboard.expenseSharePerMember) : '—'}
          description={`Split across ${dashboard?.memberCount ?? 0} active members`}
          icon={<Receipt className="size-4" />}
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
          icon={<CalendarDays className="size-4" />}
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
                className="flex flex-col items-center justify-center rounded-lg border bg-background p-3 text-center transition-all hover:bg-accent hover:border-primary/50"
              >
                <Utensils className="size-5 text-primary mb-1.5" />
                <span className="text-xs font-medium">Meals Grid</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">Toggle daily meals</span>
              </Link>
              <Link
                to="/months/$monthId"
                params={{ monthId: String(selectedId) } as any}
                search={{ tab: 'bazar' }}
                className="flex flex-col items-center justify-center rounded-lg border bg-background p-3 text-center transition-all hover:bg-accent hover:border-primary/50"
              >
                <Banknote className="size-5 text-emerald-500 mb-1.5" />
                <span className="text-xs font-medium">Bazar</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">Add grocery cost</span>
              </Link>
              <Link
                to="/months/$monthId"
                params={{ monthId: String(selectedId) } as any}
                search={{ tab: 'expenses' }}
                className="flex flex-col items-center justify-center rounded-lg border bg-background p-3 text-center transition-all hover:bg-accent hover:border-primary/50"
              >
                <FlaskConical className="size-5 text-amber-500 mb-1.5" />
                <span className="text-xs font-medium">Expenses</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">Gas, electricity, etc.</span>
              </Link>
              <Link
                to="/months/$monthId"
                params={{ monthId: String(selectedId) } as any}
                search={{ tab: 'deposits' }}
                className="flex flex-col items-center justify-center rounded-lg border bg-background p-3 text-center transition-all hover:bg-accent hover:border-primary/50"
              >
                <Coins className="size-5 text-blue-500 mb-1.5" />
                <span className="text-xs font-medium">Deposits</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">Record payments</span>
              </Link>
              <Link
                to="/months/$monthId"
                params={{ monthId: String(selectedId) } as any}
                search={{ tab: 'rents' }}
                className="col-span-2 sm:col-span-1 flex flex-col items-center justify-center rounded-lg border bg-background p-3 text-center transition-all hover:bg-accent hover:border-primary/50"
              >
                <Receipt className="size-5 text-purple-500 mb-1.5" />
                <span className="text-xs font-medium">Rents</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">House rent charges</span>
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