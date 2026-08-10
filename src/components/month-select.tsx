import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { monthLabel } from '@/lib/format'
import type { Month } from '@/api/types'

export function MonthSelect({
  months,
  value,
  onChange,
  className,
  loading,
  disabled,
}: {
  months: Month[] | undefined
  value: number | undefined
  onChange: (id: number) => void
  className?: string
  loading?: boolean
  disabled?: boolean
}) {
  const items = months?.map((m) => ({
    value: m.id,
    label: `${monthLabel(m.year, m.monthNo)}${m.closed ? ' (closed)' : ''}`,
  }))
  return (
    <Select items={items} value={value} onValueChange={(v) => v !== null && onChange(v)} disabled={disabled || loading || !months?.length}>
      <SelectTrigger className={className} aria-label="Select month">
        <SelectValue placeholder="Select a month" />
      </SelectTrigger>
      <SelectContent>
        {months?.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {monthLabel(m.year, m.monthNo)}
            {m.closed ? ' (closed)' : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}