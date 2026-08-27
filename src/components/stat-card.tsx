import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function StatCard({
  title,
  description,
  value,
  icon,
  iconBg,
  loading,
  className,
}: {
  title: string
  description?: string
  value: ReactNode
  icon?: ReactNode
  iconBg?: string
  loading?: boolean
  className?: string
}) {
  return (
    <Card className={cn('transition-shadow hover:shadow-md', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardDescription className="text-xs font-medium uppercase tracking-wide">{title}</CardDescription>
          {loading ? (
            <Skeleton className="h-7 w-24" />
          ) : (
            <CardTitle className="text-2xl font-semibold tabular-nums">{value}</CardTitle>
          )}
        </div>
        {icon ? (
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground', iconBg)}>
            {icon}
          </div>
        ) : null}
      </CardHeader>
      {description ? <CardContent className="pt-0 text-xs text-muted-foreground">{description}</CardContent> : null}
    </Card>
  )
}