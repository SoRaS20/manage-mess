import { createFileRoute, useLocation, useNavigate } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { Clock } from 'lucide-react'
import { z } from 'zod'
import { useMonths } from '@/api/hooks'
import { LedgerFeed } from '@/components/ledger-feed'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { monthLabel } from '@/lib/format'

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

  const activeMonth = monthId ?? months?.[0]?.id

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
        <Select
          items={months?.map((m) => ({ value: m.id, label: monthLabel(m.year, m.monthNo) }))}
          value={activeMonth ?? 0}
          onValueChange={(v) => v !== null && navigate({ search: { monthId: v } } as any)}
        >
          <SelectTrigger size="sm" className="w-48">
            <SelectValue placeholder="Select month" />
          </SelectTrigger>
          <SelectContent>
            {months?.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {monthLabel(m.year, m.monthNo)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {activeMonth ? <LedgerFeed monthId={activeMonth} /> : <p className="py-12 text-center text-sm text-muted-foreground">No month selected.</p>}
    </div>
  )
}
