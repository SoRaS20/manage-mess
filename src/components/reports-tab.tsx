import { useState } from 'react'
import {
  useDailyReport,
  useMemberReport,
  useMembers,
  useMonthlyReport,
} from '@/api/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate, formatNumber, formatTaka, todayISO } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

export function ReportsTab({ monthId }: { monthId: number }) {
  const { data: report, isLoading } = useMonthlyReport(monthId)
  const [date, setDate] = useState(todayISO())
  const [memberId, setMemberId] = useState<number | undefined>()

  const { data: daily, isLoading: dailyLoading } = useDailyReport(monthId, date)
  const { data: memberReport, isLoading: memberLoading } = useMemberReport(memberId, monthId)
  const { data: members } = useMembers()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly report — Total Pay = Billable share + Previous Balance + Rent</CardTitle>
          <CardDescription>
            Per-member breakdown. Billable = wifi, current etc (split equally).{' '}
            {report
              ? `Totals: billable ${formatTaka(report.summary.totalBillableExpenses)} · regular ${formatTaka(report.summary.totalRegularExpenses)} · prevBal ${formatTaka(report.summary.totalPreviousBalances)} · rent ${formatTaka(report.totals.rent)} · grossPay ${formatTaka(report.totals.grossPayable)} · netDue ${formatTaka(report.totals.netDue)} · netBal ${formatTaka(report.totals.netBalance)}`
              : '—'}
          </CardDescription>
          {report?.summary ? (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">Billable share/member: {formatTaka(report.summary.billableSharePerMember)}</Badge>
              <Badge variant="outline">Regular share/member: {formatTaka(report.summary.regularSharePerMember)}</Badge>
              <Badge variant="secondary">{report.summary.memberCount} active members</Badge>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {!report || report.members.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No data for this month.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Member</TableHead>
                  <TableHead className="text-right font-semibold">Meals</TableHead>
                  <TableHead className="text-right font-semibold">Meal cost</TableHead>
                  <TableHead className="text-right font-semibold">Reg share</TableHead>
                  <TableHead className="text-right font-semibold">Billable share</TableHead>
                  <TableHead className="text-right font-semibold">Prev bal</TableHead>
                  <TableHead className="text-right font-semibold">Bazar</TableHead>
                  <TableHead className="text-right font-semibold">Exp contrib</TableHead>
                  <TableHead className="text-right font-semibold">Food bal</TableHead>
                  <TableHead className="text-right font-semibold">Rent</TableHead>
                  <TableHead className="text-right font-semibold">Rent dep</TableHead>
                  <TableHead className="text-right font-semibold">Gross Pay</TableHead>
                  <TableHead className="text-right font-semibold">Net Due</TableHead>
                  <TableHead className="text-right font-semibold">Net bal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.members.map((m) => (
                  <TableRow key={m.memberId} className="transition-colors hover:bg-muted/30">
                    <TableCell className="font-medium">{m.memberName}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(m.meals)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatTaka(m.mealCost)}</TableCell>
                    <TableCell className="text-right tabular-nums text-amber-600">{formatTaka(m.regularShare)}</TableCell>
                    <TableCell className="text-right tabular-nums text-violet-600 font-medium">{formatTaka(m.billableShare)}</TableCell>
                    <TableCell className="text-right tabular-nums text-orange-600">{formatTaka(m.previousBalance)}</TableCell>
                    <TableCell className="text-right tabular-nums text-blue-600">{formatTaka(m.bazarContribution)}</TableCell>
                    <TableCell className="text-right tabular-nums text-blue-600">{formatTaka(m.expenseContribution)}</TableCell>
                    <TableCell className={`text-right font-semibold tabular-nums ${m.foodBalance >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                      {formatTaka(m.foodBalance)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatTaka(m.rent)}</TableCell>
                    <TableCell className="text-right tabular-nums text-purple-600">{formatTaka(m.deposit)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold bg-violet-50 dark:bg-violet-950/20">{formatTaka(m.grossPayable)}</TableCell>
                    <TableCell className={`text-right tabular-nums font-bold ${m.netDue <= 0 ? 'text-emerald-600' : 'text-destructive'}`}>{formatTaka(m.netDue)}</TableCell>
                    <TableCell className={`text-right font-bold tabular-nums ${m.balance >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                      {formatTaka(m.balance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="font-medium">
                  <TableCell colSpan={3} className="text-xs">Totals</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{formatTaka(report.totals.regularExpenses)}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{formatTaka(report.totals.billableExpenses)}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{formatTaka(report.totals.previousBalances)}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{formatTaka(report.totals.bazarContributions)}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{formatTaka(report.totals.expenseContributions)}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{formatTaka(report.totals.foodBalances)}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{formatTaka(report.totals.rent)}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{formatTaka(report.totals.deposits)}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{formatTaka(report.totals.grossPayable)}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{formatTaka(report.totals.netDue)}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{formatTaka(report.totals.netBalance)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={14} className="font-semibold text-[11px] leading-relaxed">
                    Gross Pay (Total Pay) = Billable share + Previous Balance + Rent &nbsp;|&nbsp; Net Due = Gross Pay − Rent Deposit (amount still owed) <br />
                    Food bal = (Bazar + Exp contrib) − (Meal cost + Total Exp share) &nbsp;|&nbsp; Rent bal = Rent dep − Rent &nbsp;|&nbsp; Net bal = Food + Rent bal
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily report</CardTitle>
            <CardDescription>Meals and money for a single day.</CardDescription>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-44" />
          </CardHeader>
          <CardContent>
            {dailyLoading ? (
              <Skeleton className="h-28 w-full" />
            ) : !daily ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Pick a date.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{formatNumber(daily.dayTotals.totalMeals)} meals</Badge>
                  <Badge variant="secondary">Bazar {formatTaka(daily.dayTotals.bazarThatDay)}</Badge>
                  <Badge variant="secondary">Expenses {formatTaka(daily.dayTotals.expensesThatDay)}</Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead className="text-center">B</TableHead>
                      <TableHead className="text-center">L</TableHead>
                      <TableHead className="text-center">D</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {daily.members.map((m) => (
                      <TableRow key={m.memberId}>
                        <TableCell className="font-medium">{m.memberName}</TableCell>
                        {[m.breakfastCount, m.lunchCount, m.dinnerCount].map((count, i) => (
                          <TableCell key={i} className="text-center">
                            <span
                              className={`inline-flex size-5 items-center justify-center rounded-full text-[10px] font-bold ${count > 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground/40'}`}
                            >
                              {count > 0 ? count : '—'}
                            </span>
                          </TableCell>
                        ))}
                        <TableCell className="text-right tabular-nums">{formatNumber(m.dailyCount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Member report — Total Pay breakdown</CardTitle>
            <CardDescription>Per-member breakdown for this month.</CardDescription>
            <Select items={members?.map((m) => ({ value: m.id, label: m.name }))} value={memberId} onValueChange={(v) => setMemberId(Number(v))}>
              <SelectTrigger className="max-w-56">
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                {members?.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {memberLoading ? (
              <Skeleton className="h-28 w-full" />
            ) : !memberReport ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Select a member.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Meal cost</p>
                    <p className="text-lg font-semibold tabular-nums">{formatTaka(memberReport.mealCost)}</p>
                    <p className="text-[10px] text-muted-foreground">Reg share {formatTaka(memberReport.regularShare)} · Billable share {formatTaka(memberReport.billableShare)}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Bazar + Exp Contrib</p>
                    <p className="text-lg font-semibold tabular-nums text-blue-600">{formatTaka(memberReport.bazarContribution + memberReport.expenseContribution)}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Food Balance</p>
                    <p className={`text-lg font-semibold tabular-nums ${memberReport.foodBalance >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                      {formatTaka(memberReport.foodBalance)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Rent Cost</p>
                    <p className="text-lg font-semibold tabular-nums text-muted-foreground">{formatTaka(memberReport.rent)}</p>
                  </div>
                  <div className="rounded-lg bg-violet-50 dark:bg-violet-950/20 p-3 border border-violet-200 dark:border-violet-800/30">
                    <p className="text-xs text-violet-700 dark:text-violet-300">Previous Balance</p>
                    <p className="text-lg font-semibold tabular-nums text-violet-700 dark:text-violet-300">{formatTaka(memberReport.previousBalance)}</p>
                  </div>
                  <div className="rounded-lg bg-violet-50 dark:bg-violet-950/20 p-3 border border-violet-200 dark:border-violet-800/30">
                    <p className="text-xs text-violet-700 dark:text-violet-300">Billable Share</p>
                    <p className="text-lg font-semibold tabular-nums text-violet-700 dark:text-violet-300">{formatTaka(memberReport.billableShare)}</p>
                  </div>
                  <div className="rounded-lg bg-primary/10 p-3 border border-primary/20 col-span-2">
                    <p className="text-xs text-muted-foreground text-center">Gross Payable (Total Pay)</p>
                    <p className="text-xs text-center text-muted-foreground">Billable + Previous + Rent</p>
                    <p className="text-2xl font-bold tabular-nums text-center text-primary">{formatTaka(memberReport.grossPayable)}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Rent Deposit Paid</p>
                    <p className="text-lg font-semibold tabular-nums text-purple-600">{formatTaka(memberReport.totalDeposit)}</p>
                  </div>
                  <div className={`rounded-lg p-3 border ${memberReport.netDue <= 0 ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/30' : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/30'}`}>
                    <p className="text-xs text-muted-foreground">Net Due (Gross − Deposit)</p>
                    <p className={`text-lg font-bold tabular-nums ${memberReport.netDue <= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>{formatTaka(memberReport.netDue)}</p>
                    <p className="text-[10px] text-muted-foreground">{memberReport.netDue <= 0 ? 'Paid / overpaid' : 'Still owed'}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Rent Balance</p>
                    <p className={`text-lg font-semibold tabular-nums ${memberReport.rentBalance >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                      {formatTaka(memberReport.rentBalance)}
                    </p>
                  </div>
                  <div className="col-span-2 rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground text-center">Net Balance (Food + Rent)</p>
                    <p className={`text-2xl font-bold tabular-nums text-center ${memberReport.balance >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                      {formatTaka(memberReport.balance)}
                    </p>
                  </div>
                </div>
                {memberReport.meals.byDay.length > 0 ? (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Daily meal counts ({memberReport.meals.byDay.length} days)
                    </summary>
                    <div className="mt-2 max-h-44 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Count</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {memberReport.meals.byDay.map((d) => (
                            <TableRow key={d.date}>
                              <TableCell>{formatDate(d.date)}</TableCell>
                              <TableCell className="text-right tabular-nums">{formatNumber(d.dailyCount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </details>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
