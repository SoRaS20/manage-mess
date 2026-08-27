import { createFileRoute, useLocation, useNavigate } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { z } from 'zod'
import { useMonths } from '@/api/hooks'
import { MonthSelect } from '@/components/month-select'
import { ReportsTab } from '@/components/reports-tab'
import { Skeleton } from '@/components/ui/skeleton'

const reportsSearchSchema = z.object({
  monthId: z.number().optional(),
})

export const Route = createFileRoute('/reports')({
  validateSearch: zodValidator(reportsSearchSchema),
  component: ReportsPage,
})

function ReportsPage() {
  const location = useLocation()
  const monthId = (location.search as { monthId?: number })?.monthId
  const navigate = useNavigate()
  const { data: months, isLoading } = useMonths()

  const now = new Date()
  const currentMonth = months?.find((m) => m.year === now.getFullYear() && m.monthNo === now.getMonth() + 1)
  const selectedId = monthId ?? currentMonth?.id ?? months?.[0]?.id

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-muted-foreground">Monthly, daily and per-member breakdowns.</p>
        </div>
        <MonthSelect
          months={months}
          value={selectedId}
          onChange={(id) => navigate({ search: { monthId: id } as any })}
          loading={isLoading}
          className="w-52"
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : selectedId ? (
        <ReportsTab monthId={selectedId} />
      ) : (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No months found — create one under Months first.
        </p>
      )}
    </div>
  )
}