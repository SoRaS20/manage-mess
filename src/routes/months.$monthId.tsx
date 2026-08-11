import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { CalendarDays, Lock, LockOpen } from 'lucide-react'
import { z } from 'zod'
import { useCloseMonth, useMonth, useMembers, useMonthlyReport, useReopenMonth, useSetManager } from '@/api/hooks'
import { useAuthStore } from '@/store/auth'
import { MealsGrid } from '@/components/meals-grid'
import { LedgerFeed } from '@/components/ledger-feed'
import { BazarLedger, DepositsLedger, ExpensesLedger, RentsLedger } from '@/components/ledgers'
import { ReportsTab } from '@/components/reports-tab'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { monthLabel } from '@/lib/format'


const monthDetailSearchSchema = z.object({
  tab: z.enum(['meals', 'bazar', 'expenses', 'deposits', 'rents', 'ledger', 'reports']).optional(),
})

export const Route = createFileRoute('/months/$monthId')({
  validateSearch: zodValidator(monthDetailSearchSchema),
  component: MonthDetailPage,
})

function MonthDetailPage() {
  const { monthId } = Route.useParams()
  const id = Number(monthId)
  const { tab } = Route.useSearch()
  const navigate = useNavigate()

  const { data: month, isLoading } = useMonth(id)
  const { data: report } = useMonthlyReport(id)
  const { data: members } = useMembers()

  const closeMonth = useCloseMonth()
  const reopenMonth = useReopenMonth()
  const setManager = useSetManager()

  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'ADMIN'

  const setTab = (tab: string) => navigate({ search: { tab } as any })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  if (!month) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Month #{id} not found. It may have been deleted.
      </div>
    )
  }

  const closed = month.closed
  const activeTab = tab ?? 'meals'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="size-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold">{monthLabel(month.year, month.monthNo)}</h1>
            {closed ? <Badge variant="destructive">Closed</Badge> : <Badge variant="secondary">Open</Badge>}
            {report ? <Badge variant="outline">{report.summary.memberCount} members</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manager:
            <span className="ml-2 inline-block align-middle">
              <Select
                items={members?.filter((m) => m.active).map((m) => ({ value: m.id, label: m.name }))}
                value={month.managerId ?? 0}
                onValueChange={(v) => v !== null && setManager.mutate({ monthId: id, memberId: v })}
                disabled={closed || !isAdmin}
              >
                <SelectTrigger size="sm" className="h-6 min-w-28 px-2 text-xs">
                  <SelectValue placeholder="Not assigned" />
                </SelectTrigger>
                <SelectContent>
                  {members
                    ?.filter((m) => m.active)
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </span>
          </p>
        </div>
        {isAdmin && (
          <Button
            variant={closed ? 'outline' : 'default'}
            onClick={() => (closed ? reopenMonth.mutate(id) : closeMonth.mutate(id))}
            disabled={closeMonth.isPending || reopenMonth.isPending}
          >
            {closed ? (
              <>
                <LockOpen /> Reopen month
              </>
            ) : (
              <>
                <Lock /> Close month
              </>
            )}
          </Button>
        )}
      </div>

      {closed ? (
        <p className="rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This month is closed — all writes are blocked by the backend (422). Reopen it to edit records.
        </p>
      ) : null}

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList className="w-full max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="meals" className="flex-none">Meals</TabsTrigger>
          <TabsTrigger value="bazar" className="flex-none">Bazar</TabsTrigger>
          <TabsTrigger value="expenses" className="flex-none">Expenses</TabsTrigger>
          <TabsTrigger value="deposits" className="flex-none">Deposits</TabsTrigger>
          <TabsTrigger value="rents" className="flex-none">Rents</TabsTrigger>
          <TabsTrigger value="ledger" className="flex-none">Ledger</TabsTrigger>
          <TabsTrigger value="reports" className="flex-none">Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="meals">
          <MealsGrid monthId={id} year={month.year} monthNo={month.monthNo} closed={closed} managerId={month.managerId ?? null} />
        </TabsContent>
        <TabsContent value="bazar">
          <BazarLedger monthId={id} closed={closed} managerId={month.managerId ?? null} />
        </TabsContent>
        <TabsContent value="expenses">
          <ExpensesLedger monthId={id} closed={closed} managerId={month.managerId ?? null} />
        </TabsContent>
        <TabsContent value="deposits">
          <DepositsLedger monthId={id} closed={closed} />
        </TabsContent>
        <TabsContent value="rents">
          <RentsLedger monthId={id} closed={closed} />
        </TabsContent>
        <TabsContent value="ledger">
          <LedgerFeed monthId={id} />
        </TabsContent>
        <TabsContent value="reports">
          <ReportsTab monthId={id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}