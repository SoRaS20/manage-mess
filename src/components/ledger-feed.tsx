import { useMemo } from 'react'
import { useLedger } from '@/api/hooks'
import type { LedgerEntry, LedgerEntryType } from '@/api/types'
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
import { formatDate, formatTaka } from '@/lib/format'
import { cn } from '@/lib/utils'

const TYPE_META: Record<LedgerEntryType, { label: string; className: string }> = {
  bazar: { label: 'Bazar', className: 'bg-primary/10 text-primary' },
  expense: { label: 'Expense', className: 'bg-destructive/10 text-destructive' },
  deposit: { label: 'Deposit', className: 'bg-emerald-500/10 text-emerald-600' },
  rent: { label: 'Rent', className: 'bg-muted text-muted-foreground' },
}

export function formatLoggedAt(createdAt?: string | null): string {
  if (!createdAt) return '—'
  const d = new Date(createdAt)
  if (Number.isNaN(d.getTime())) return createdAt
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function LedgerFeed({ monthId }: { monthId: number }) {
  const { data, isLoading } = useLedger(monthId)

  const totals = useMemo(() => {
    const t: Record<LedgerEntryType, number> = { bazar: 0, expense: 0, deposit: 0, rent: 0 }
    for (const row of data ?? []) t[row.type] += row.amount
    return t
  }, [data])

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    )
  }

  if (!data?.length) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No money entries logged this month yet.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        {(['bazar', 'expense', 'deposit', 'rent'] as LedgerEntryType[]).map((t) => (
          <Badge key={t} variant="outline" className={cn('normal-case', TYPE_META[t].className)}>
            {TYPE_META[t].label} {formatTaka(totals[t])}
          </Badge>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Logged at</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Entry date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row: LedgerEntry) => (
              <TableRow key={`${row.type}-${row.id}`}>
                <TableCell className="whitespace-nowrap tabular-nums">{formatLoggedAt(row.createdAt)}</TableCell>
                <TableCell>
                  <span className={cn('rounded px-1.5 py-0.5 text-xs capitalize', TYPE_META[row.type].className)}>
                    {TYPE_META[row.type].label}
                  </span>
                </TableCell>
                <TableCell className="font-medium">{row.memberName ?? '—'}</TableCell>
                <TableCell className="max-w-64 truncate text-muted-foreground">{row.description || (row.category ? row.category : '—')}</TableCell>
                <TableCell className="tabular-nums">{row.entryDate ? formatDate(row.entryDate) : '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{formatTaka(row.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
