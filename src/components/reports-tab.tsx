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
                  <TableHead className="text-right">Meal cost</TableHead>
                  <TableHead className="text-right">Exp share</TableHead>
                  <TableHead className="text-right">Bazar contrib</TableHead>
                  <TableHead className="text-right">Exp contrib</TableHead>
                  <TableHead className="text-right">Food bal</TableHead>
                  <TableHead className="text-right">Rent cost</TableHead>
                  <TableHead className="text-right">Rent dep</TableHead>
                  <TableHead className="text-right">Rent bal</TableHead>
                  <TableHead className="text-right">Net bal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.members.map((m) => (
                  <TableRow key={m.memberId}>
                    <TableCell className="font-medium">{m.memberName}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(m.meals)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatTaka(m.mealCost)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatTaka(m.expenseShare)}</TableCell>
                    <TableCell className="text-right tabular-nums text-blue-600">{formatTaka(m.bazarContribution)}</TableCell>
                    <TableCell className="text-right tabular-nums text-blue-600">{formatTaka(m.expenseContribution)}</TableCell>
                    <TableCell className={`text-right font-semibold tabular-nums ${m.foodBalance >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                      {formatTaka(m.foodBalance)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatTaka(m.rent)}</TableCell>
                    <TableCell className="text-right tabular-nums text-purple-600">{formatTaka(m.deposit)}</TableCell>
                    <TableCell className={`text-right font-semibold tabular-nums ${m.rentBalance >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                      {formatTaka(m.rentBalance)}
                    </TableCell>
                    <TableCell className={`text-right font-bold tabular-nums ${m.balance >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                      {formatTaka(m.balance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={6} className="font-semibold text-xs">
                    Food bal = (Bazar + Exp contrib) - (Meal cost + Exp share) <br/> Rent bal = Rent dep - Rent cost <br/> Net = Food + Rent bal
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
            <CardTitle className="text-base">Member report</CardTitle>
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
                    <p className="text-xs text-muted-foreground">Food/Utility cost</p>
                    <p className="text-lg font-semibold tabular-nums text-muted-foreground">{formatTaka(memberReport.mealCost + memberReport.expenseShare)}</p>
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
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Rent Deposit</p>
                    <p className="text-lg font-semibold tabular-nums text-purple-600">{formatTaka(memberReport.totalDeposit)}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Rent Balance</p>
                    <p className={`text-lg font-semibold tabular-nums ${memberReport.rentBalance >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                      {formatTaka(memberReport.rentBalance)}
                    </p>
                  </div>
                  <div className="col-span-2 rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground text-center">Net Balance</p>
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