import { createFileRoute, useLocation, useNavigate } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { Clock } from 'lucide-react'
import { z } from 'zod'
import { useMonths } from '@/api/hooks'
import { LedgerFeed } from '@/components/ledger-feed'
import { MonthSelect } from '@/components/month-select'
import { Skeleton } from '@/components/ui/skeleton'

const ledgerSearchSchema = z.object({
  monthId: z.coerce.number().optional(),
})

export const Route = createFileRoute('/ledger')({
  validateSearch: zodValidator(ledgerSearchSchema),
  component: LedgerPage,
})

function LedgerPage() {
  const location = useLocation()
  const monthId = (location.search as { monthId?: number })?.monthId
  const navigate = useNavigate()
  const { data: months, isLoading } = useMonths()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  const now = new Date()
  const currentMonth = months?.find((m) => m.year === now.getFullYear() && m.monthNo === now.getMonth() + 1)
  const activeMonth = monthId ?? currentMonth?.id ?? months?.[0]?.id

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Clock className="size-5 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold">Money log</h1>
            <p className="text-sm text-muted-foreground">All bazar, expense, deposit and rent entries with timestamps.</p>
          </div>
        </div>
        <MonthSelect
          months={months}
          value={activeMonth}
          onChange={(id) => navigate({ search: { monthId: id } } as any)}
          loading={isLoading}
          className="w-52"
        />
      </div>

      {activeMonth ? <LedgerFeed monthId={activeMonth} /> : <p className="py-12 text-center text-sm text-muted-foreground">No month selected.</p>}
    </div>
  )
}
