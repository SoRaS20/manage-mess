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
          <CardTitle className="text-base">Monthly report</CardTitle>
          <CardDescription>
            Per-member breakdown and rolled-up totals. Totals:{' '}
            {report
              ? `deposits ${formatTaka(report.totals.deposits)} · meal cost ${formatTaka(report.totals.mealCost)} · expenses ${formatTaka(report.totals.expenses)} · rent ${formatTaka(report.totals.rent)} · net ${formatTaka(report.totals.netBalance)}`
              : '—'}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {!report || report.members.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No data for this month.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-right">Meals</TableHead>
                  <TableHead className="text-right">Meal rate</TableHead>
                  <TableHead className="text-right">Meal cost</TableHead>
                  <TableHead className="text-right">Expense share</TableHead>
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
                    <TableCell className="text-right tabular-nums">{formatTaka(m.mealRate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatTaka(m.mealCost)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatTaka(m.expenseShare)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatTaka(m.rent)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatTaka(m.deposit)}</TableCell>
                    <TableCell className={`text-right font-semibold tabular-nums ${m.balance >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                      {formatTaka(m.balance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="font-semibold">
                    Balance = meal cost + expense share + rent − deposit
                  </TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell />
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
                        {[m.breakfastOn, m.lunchOn, m.dinnerOn].map((on, i) => (
                          <TableCell key={i} className="text-center">
                            <span
                              className={`inline-block size-3.5 rounded-full ${on ? 'bg-primary' : 'bg-muted'}`}
                            />
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
            <CardTitle className="text-base">Member report</CardTitle>
            <CardDescription>Per-member breakdown for this month.</CardDescription>
            <Select value={memberId} onValueChange={(v) => setMemberId(Number(v))}>
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
                    <p className="text-xs text-muted-foreground">Total meals</p>
                    <p className="text-lg font-semibold tabular-nums">{formatNumber(memberReport.meals.totalCount)}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Meal cost</p>
                    <p className="text-lg font-semibold tabular-nums">{formatTaka(memberReport.mealCost)}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Expense share</p>
                    <p className="text-lg font-semibold tabular-nums">{formatTaka(memberReport.expenseShare)}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Rent</p>
                    <p className="text-lg font-semibold tabular-nums">{formatTaka(memberReport.rent)}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Deposits</p>
                    <p className="text-lg font-semibold tabular-nums">{formatTaka(memberReport.totalDeposit)}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Balance</p>
                    <p className={`text-lg font-semibold tabular-nums ${memberReport.balance >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
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