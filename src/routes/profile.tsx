import { createFileRoute } from '@tanstack/react-router'
import { User, Shield, Utensils, Coins, Receipt, TrendingUp, TrendingDown } from 'lucide-react'
import { useMonths, useMonthlyReport, useMembers } from '@/api/hooks'
import { useAuthStore } from '@/store/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatCard } from '@/components/stat-card'
import { monthLabel, formatTaka, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
})

function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const { data: months, isLoading: monthsLoading } = useMonths()
  const { data: members } = useMembers()

  const member = members?.find((m) => m.id === user?.memberId)

  if (monthsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">Your account information and monthly summaries.</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Account Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
              {user?.username?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">{user?.username}</span>
                <Badge variant={user?.role === 'ADMIN' ? 'default' : 'secondary'}>
                  <Shield className="mr-1 size-3" />
                  {user?.role}
                </Badge>
              </div>
              {member && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="size-3.5" />
                  <span>Member: <span className="font-medium text-foreground">{member.name}</span></span>
                  {member.phone && <span>· {member.phone}</span>}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <MyMonthReports />
    </div>
  )
}

function MyMonthReports() {
  const user = useAuthStore((s) => s.user)
  const { data: months, isLoading: monthsLoading } = useMonths()

  const sorted = [...(months ?? [])].sort((a, b) => b.year - a.year || b.monthNo - a.monthNo)

  if (monthsLoading) {
    return <Skeleton className="h-64 w-full" />
  }

  if (!sorted.length) {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No months found yet.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Monthly Reports</h2>
      <div className="space-y-3">
        {sorted.map((m) => (
          <MonthRow key={m.id} monthId={m.id} year={m.year} monthNo={m.monthNo} memberId={user?.memberId ?? null} />
        ))}
      </div>
    </div>
  )
}

function MonthRow({ monthId, year, monthNo, memberId }: { monthId: number; year: number; monthNo: number; memberId: number | null }) {
  const { data: report, isLoading } = useMonthlyReport(monthId)

  if (isLoading) {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-4">
          <Skeleton className="h-8 w-48" />
        </CardContent>
      </Card>
    )
  }

  if (!report || !memberId) return null

  const me = report.members.find((m) => m.memberId === memberId)
  if (!me) return null

  return (
    <Card className="shadow-sm">
      <CardContent className="py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
              {monthNo}
            </div>
            <div>
              <div className="font-medium">{monthLabel(year, monthNo)}</div>
              <div className="text-xs text-muted-foreground">{formatNumber(me.meals)} meals · rate {formatTaka(me.mealRate)}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Utensils className="size-3.5 text-muted-foreground" />
              <span className="tabular-nums">{formatNumber(me.meals)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Receipt className="size-3.5 text-muted-foreground" />
              <span className="tabular-nums">{formatTaka(me.mealCost)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Coins className="size-3.5 text-emerald-500" />
              <span className="tabular-nums">{formatTaka(me.deposit)}</span>
            </div>
            <div className={cn('flex items-center gap-1.5 font-semibold', me.balance >= 0 ? 'text-emerald-600' : 'text-destructive')}>
              {me.balance >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
              <span className="tabular-nums">{formatTaka(me.balance)}</span>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
          <div>Meal cost: <span className="tabular-nums text-foreground">{formatTaka(me.mealCost)}</span></div>
          <div>Exp share: <span className="tabular-nums text-foreground">{formatTaka(me.expenseShare)}</span></div>
          <div>Bazar contrib: <span className="tabular-nums text-blue-600">{formatTaka(me.bazarContribution)}</span></div>
          <div>Exp contrib: <span className="tabular-nums text-blue-600">{formatTaka(me.expenseContribution)}</span></div>
          <div>Food balance: <span className={cn('tabular-nums font-medium', me.foodBalance >= 0 ? 'text-emerald-600' : 'text-destructive')}>{formatTaka(me.foodBalance)}</span></div>
          <div>Rent: <span className="tabular-nums text-foreground">{formatTaka(me.rent)}</span></div>
          <div>Deposit: <span className="tabular-nums text-purple-600">{formatTaka(me.deposit)}</span></div>
          <div>Rent balance: <span className={cn('tabular-nums font-medium', me.rentBalance >= 0 ? 'text-emerald-600' : 'text-destructive')}>{formatTaka(me.rentBalance)}</span></div>
        </div>
      </CardContent>
    </Card>
  )
}
