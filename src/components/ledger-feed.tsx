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

function AuditInfo({ createdAt, updatedAt }: { createdAt?: string | null; updatedAt?: string | null }) {
  const created = createdAt ? new Date(createdAt) : null
  const updated = updatedAt ? new Date(updatedAt) : null
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (!created && !updated) return null
  return (
    <div className="text-[10px] leading-tight text-muted-foreground">
      {created && <span>Created {fmt(created)}</span>}
      {updated && <span>{created ? ' · ' : ''}Updated {fmt(updated)}</span>}
    </div>
  )
}

const TYPE_META: Record<LedgerEntryType, { label: string; className: string }> = {
  bazar: { label: 'Bazar', className: 'bg-primary/10 text-primary' },
  expense: { label: 'Expense', className: 'bg-destructive/10 text-destructive' },
  deposit: { label: 'Deposit', className: 'bg-emerald-500/10 text-emerald-600' },
  rent: { label: 'Rent', className: 'bg-muted text-muted-foreground' },
  previous_balance: { label: 'Prev Bal', className: 'bg-orange-500/10 text-orange-600' },
}

function StatusBadge({ status }: { status?: string | null }) {
  if (!status || status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <span className="size-1 rounded-full bg-green-500" />
        Approved
      </span>
    )
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
        <span className="size-1 rounded-full bg-yellow-500" />
        Pending
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
      <span className="size-1 rounded-full bg-red-500" />
      Rejected
    </span>
  )
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
    const t: Record<LedgerEntryType, number> = { bazar: 0, expense: 0, deposit: 0, rent: 0, previous_balance: 0 }
    for (const row of data ?? []) {
      if (row.status === 'approved' || !row.status) t[row.type] += row.amount
    }
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
        {(['bazar', 'expense', 'deposit', 'rent', 'previous_balance'] as LedgerEntryType[]).map((t) => (
          <Badge key={t} variant="outline" className={cn('normal-case font-medium', TYPE_META[t].className)}>
            {TYPE_META[t].label} {formatTaka(totals[t])}
          </Badge>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Logged at</TableHead>
              <TableHead className="font-semibold">Type</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Member</TableHead>
              <TableHead className="font-semibold">Description</TableHead>
              <TableHead className="font-semibold">Entry date</TableHead>
              <TableHead className="text-right font-semibold">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row: LedgerEntry) => (
              <TableRow key={`${row.type}-${row.id}`} className="transition-colors hover:bg-muted/30">
                <TableCell className="whitespace-nowrap tabular-nums text-sm">
                  {formatLoggedAt(row.createdAt)}
                  <AuditInfo createdAt={row.createdAt} updatedAt={row.updatedAt} />
                </TableCell>
                <TableCell>
                  <span className={cn('rounded-md px-2 py-1 text-xs font-medium capitalize', TYPE_META[row.type]?.className ?? 'bg-muted')}>
                    {TYPE_META[row.type]?.label ?? row.type}
                  </span>
                  {row.expenseType ? <span className="ml-1 rounded bg-muted px-1 py-0.5 text-[10px] capitalize">{row.expenseType}</span> : null}
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell className="font-medium">{row.memberName ?? '—'}</TableCell>
                <TableCell className="max-w-64 truncate text-muted-foreground">{row.description || (row.category ? `${row.category}${row.expenseType ? ` (${row.expenseType})` : ''}` : '—')}</TableCell>
                <TableCell className="tabular-nums text-sm">{row.entryDate ? formatDate(row.entryDate) : '—'}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{formatTaka(row.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
