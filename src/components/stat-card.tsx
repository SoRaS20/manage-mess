import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function StatCard({
  title,
  description,
  value,
  icon,
  loading,
  className,
}: {
  title: string
  description?: string
  value: ReactNode
  icon?: ReactNode
  loading?: boolean
  className?: string
}) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardDescription>{title}</CardDescription>
          {loading ? (
            <Skeleton className="h-7 w-24" />
          ) : (
            <CardTitle className="text-2xl font-semibold tabular-nums">{value}</CardTitle>
          )}
        </div>
        {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      </CardHeader>
      {description ? <CardContent className="text-xs text-muted-foreground">{description}</CardContent> : null}
    </Card>
  )
}