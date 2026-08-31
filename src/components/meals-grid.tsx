import { useMemo, useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useMembers, useMeals, useUpdateMealSlot, useDeleteMeal, useCreateMeal, useApproveMeal, useRejectMeal } from '@/api/hooks'
import type { Meal } from '@/api/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

function dateKey(year: number, monthNo: number, day: number): string {
  return `${year}-${String(monthNo).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

type MealSlot = 'breakfast' | 'lunch' | 'dinner'

const MAX_COUNT = 3

function isPastDate(year: number, monthNo: number, day: number): boolean {
  const now = new Date()
  const d = new Date(year, monthNo - 1, day)
  d.setHours(0, 0, 0, 0)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return d < today
}

export function MealsGrid({
  monthId,
  year,
  monthNo,
  closed,
  managerId,
}: {
  monthId: number
  year: number
  monthNo: number
  closed: boolean
  managerId: number | null
}) {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'ADMIN'
  const isManager = !isAdmin && user?.memberId !== null && user?.memberId !== undefined && user?.memberId === managerId
  const isManagerOrAdmin = isAdmin || isManager

  const { data: meals, isLoading } = useMeals(monthId)
  const { data: members } = useMembers()
  const updateSlot = useUpdateMealSlot(monthId)
  const createMeal = useCreateMeal(monthId)
  const deleteMeal = useDeleteMeal(monthId)
  const approveMeal = useApproveMeal(monthId)
  const rejectMeal = useRejectMeal(monthId)

  const [editingMealInfo, setEditingMealInfo] = useState<{
    memberId: number
    memberName: string
    dateStr: string
    meal: Meal | null
  } | null>(null)

  const daysInMonth = new Date(year, monthNo, 0).getDate()
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth])

  const byKey = useMemo(() => {
    const map = new Map<string, Meal>()
    for (const meal of meals ?? []) map.set(`${meal.memberId}:${meal.recordDate}`, meal)
    return map
  }, [meals])

  const memberCols = useMemo(() => {
    const list = [...(members ?? [])].sort(
      (a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name),
    )
    const ids = new Set(list.map((m) => m.id))
    for (const meal of meals ?? []) {
      if (!ids.has(meal.memberId)) {
        list.push({ id: meal.memberId, name: meal.memberName, phone: null, joinDate: '', active: false, banned: false, userId: null, user: null })
        ids.add(meal.memberId)
      }
    }
    return list
  }, [members, meals])

  const today = new Date()

  const handleSlotClick = (e: React.MouseEvent, meal: Meal, slot: MealSlot) => {
    e.stopPropagation()
    if (closed) return
    const isOwn = user?.memberId === meal.memberId
    if (!isManagerOrAdmin && !isOwn) return
    if (!isManagerOrAdmin) {
      const [y, m, d] = meal.recordDate.split('-').map(Number)
      if (isPastDate(y, m, d)) return
    }
    const field = slot === 'breakfast' ? 'breakfastCount' : slot === 'lunch' ? 'lunchCount' : 'dinnerCount'
    const current = meal[field]
    const next = current >= MAX_COUNT ? 0 : current + 1
    updateSlot.mutate({ mealId: meal.id, slot, count: next, status: isManagerOrAdmin ? 'approved' : 'pending' })
  }

  const handleApprove = (e: React.MouseEvent, meal: Meal) => {
    e.stopPropagation()
    if (!isManagerOrAdmin || !user?.memberId) return
    approveMeal.mutate({ mealId: meal.id, approvedBy: user.memberId })
  }

  const handleReject = (e: React.MouseEvent, meal: Meal) => {
    e.stopPropagation()
    if (!isManagerOrAdmin || !user?.memberId) return
    rejectMeal.mutate({ mealId: meal.id, approvedBy: user.memberId })
  }

  const dayTotals = useMemo(() => {
    const map = new Map<number, { breakfast: number; lunch: number; dinner: number; total: number }>()
    for (const d of days) {
      let breakfast = 0, lunch = 0, dinner = 0
      for (const member of memberCols) {
        const meal = byKey.get(`${member.id}:${dateKey(year, monthNo, d)}`)
        if (meal) {
          breakfast += meal.breakfastCount
          lunch += meal.lunchCount
          dinner += meal.dinnerCount
        }
      }
      map.set(d, { breakfast, lunch, dinner, total: breakfast * 0.5 + lunch * 1.0 + dinner * 1.0 })
    }
    return map
  }, [days, memberCols, byKey, year, monthNo])

  const slotBadge = (count: number, slot: MealSlot, editable: boolean, meal: Meal) => {
    const label = slot[0].toUpperCase()
    return (
      <span
        role="button"
        tabIndex={editable ? 0 : -1}
        title={`${slot}: ${count}${count > 0 ? ` × ${slot === 'breakfast' ? '0.5' : '1.0'} = ${(count * (slot === 'breakfast' ? 0.5 : 1)).toFixed(1)}` : ''}`}
        className={cn(
          'inline-flex size-6 items-center justify-center rounded-md text-[10px] font-bold transition-all',
          editable && 'cursor-pointer hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          count > 0
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'bg-muted text-muted-foreground/40',
        )}
        onClick={(e) => handleSlotClick(e, meal, slot)}
      >
        {count > 0 ? count : label}
      </span>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Daily meal register</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Click B/L/D to cycle count (0 → 1 → 2 → 3 → 0). Click empty cell to add.
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm">
          <span className="font-bold text-foreground">B</span><span>×0.5</span>
          <span className="mx-1 text-border">•</span>
          <span className="font-bold text-foreground">L</span><span>×1.0</span>
          <span className="mx-1 text-border">•</span>
          <span className="font-bold text-foreground">D</span><span>×1.0</span>
        </div>
      </div>

      {isLoading ? (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-none border-b last:border-0" />)}
        </div>
      ) : memberCols.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <p className="text-sm font-medium">No members yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Add members first to start tracking meals.</p>
        </div>
      ) : (
        <div className="max-h-[70vh] overflow-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full min-w-max border-separate border-spacing-0 text-xs">
            <thead>
              <tr className="sticky top-0 z-30">
                <th className="sticky left-0 z-30 w-24 min-w-24 border-b border-r bg-muted px-3 py-3 text-left align-bottom font-semibold">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Calendar</div>
                  <div className="mt-0.5 text-sm text-foreground">Date</div>
                </th>
                <th className="sticky left-24 z-30 w-20 min-w-20 border-b border-r bg-muted px-2 py-3 text-center align-bottom font-semibold">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Daily</div>
                  <div className="mt-0.5 text-xs text-foreground">B · L · D</div>
                </th>
                {memberCols.map((member) => (
                  <th key={member.id} className="min-w-24 border-b border-r bg-muted px-2 py-2.5 text-center align-bottom font-medium">
                    <div className="mx-auto flex max-w-24 items-center justify-center gap-1.5">
                      <span className={cn('size-1.5 shrink-0 rounded-full', member.active ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />
                      <span className="truncate text-xs font-semibold" title={member.name}>{member.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const date = new Date(year, monthNo - 1, d)
                const dow = date.getDay()
                const isWeekend = dow === 5 || dow === 6
                const isToday = today.getFullYear() === year && today.getMonth() === monthNo - 1 && today.getDate() === d
                const totals = dayTotals.get(d)
                return (
                  <tr key={d} className="group">
                    <td className={cn(
                      'sticky left-0 z-20 border-b border-r px-3 py-2.5 backdrop-blur',
                      isWeekend ? 'bg-muted/55' : 'bg-background/95',
                      isToday && 'bg-primary/10',
                    )}>
                      <div className="flex items-center gap-2">
                        <span className={cn('flex size-7 items-center justify-center rounded-lg text-sm font-bold tabular-nums', isToday ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                          {d}
                        </span>
                        <div className="leading-none">
                          <div className={cn('text-[10px] font-semibold uppercase tracking-wide', isWeekend ? 'text-red-500' : 'text-muted-foreground')}>
                            {date.toLocaleDateString('en-US', { weekday: 'short' })}
                          </div>
                          {isToday && <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-primary">Today</div>}
                        </div>
                      </div>
                    </td>
                    <td className={cn(
                      'sticky left-24 z-20 border-b border-r px-2 py-2 backdrop-blur',
                      isWeekend ? 'bg-muted/55' : 'bg-background/95',
                      isToday && 'bg-primary/10',
                    )}>
                      {totals && (
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="flex items-center gap-1 text-[10px] tabular-nums">
                            <span className={cn('font-bold', totals.breakfast > 0 ? 'text-foreground' : 'text-muted-foreground/40')}>{totals.breakfast}</span>
                            <span className="text-muted-foreground/30">·</span>
                            <span className={cn('font-bold', totals.lunch > 0 ? 'text-foreground' : 'text-muted-foreground/40')}>{totals.lunch}</span>
                            <span className="text-muted-foreground/30">·</span>
                            <span className={cn('font-bold', totals.dinner > 0 ? 'text-foreground' : 'text-muted-foreground/40')}>{totals.dinner}</span>
                          </div>
                          <span className={cn('text-[9px] font-semibold tabular-nums', totals.total > 0 ? 'text-primary' : 'text-muted-foreground/40')}>
                            {totals.total > 0 ? totals.total.toFixed(1) : '—'}
                          </span>
                        </div>
                      )}
                    </td>
                    {memberCols.map((member) => {
                      const meal = byKey.get(`${member.id}:${dateKey(year, monthNo, d)}`)
                      const pastDate = isPastDate(year, monthNo, d)
                      const canEdit = !closed && (isManagerOrAdmin || (member.id === user?.memberId && !pastDate))
                      return (
                        <td
                          key={member.id}
                          className={cn(
                            'relative border-b border-r p-0 transition-colors',
                            isWeekend && 'bg-muted/20',
                            canEdit && 'cursor-pointer hover:bg-primary/[0.035]',
                            !canEdit && 'opacity-70',
                            pastDate && !isManagerOrAdmin && 'pointer-events-none opacity-40',
                          )}
                          onClick={() => {
                            if (canEdit && !meal) setEditingMealInfo({ memberId: member.id, memberName: member.name, dateStr: dateKey(year, monthNo, d), meal: null })
                          }}
                        >
                          <div className="flex min-h-14 w-full items-center justify-center px-2">
                            {meal ? (
                              <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center gap-1">
                                  {(['breakfast', 'lunch', 'dinner'] as MealSlot[]).map((slot) => slotBadge(meal[`${slot}Count`], slot, canEdit && meal.status !== 'rejected', meal))}
                                </div>
                                {meal.status === 'pending' && isManagerOrAdmin && !closed ? (
                                  <div className="flex items-center gap-0.5 rounded-full border bg-background px-1 py-0.5 shadow-sm">
                                    <Button type="button" variant="ghost" size="icon" className="size-6 rounded-full text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700" onClick={(e) => handleApprove(e, meal)} title="Approve">
                                      <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    </Button>
                                    <Button type="button" variant="ghost" size="icon" className="size-6 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={(e) => handleReject(e, meal)} title="Reject">
                                      <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </Button>
                                  </div>
                                ) : meal.status === 'rejected' ? (
                                  <span className="text-[8px] font-bold uppercase tracking-wider text-destructive/70">Rejected</span>
                                ) : null}
                              </div>
                            ) : (
                              <span className={cn('flex size-8 items-center justify-center rounded-full border-2 border-dashed text-muted-foreground/50 transition-all', canEdit && 'group-hover:border-primary/50 group-hover:bg-primary/5 group-hover:text-primary')}>
                                +
                              </span>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="sticky bottom-0 left-0 z-20 border-r border-t bg-muted px-3 py-3 backdrop-blur">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Monthly</div>
                  <div className="text-sm font-bold">Total</div>
                </td>
                <td className="sticky bottom-0 left-24 z-20 border-r border-t bg-muted/80 px-2 py-3 backdrop-blur">
                  <div className="text-center text-[9px] text-muted-foreground">—</div>
                </td>
                {memberCols.map((member) => {
                  const total = days
                    .map((d) => byKey.get(`${member.id}:${dateKey(year, monthNo, d)}`))
                    .filter((m): m is Meal => !!m && m.status !== 'rejected')
                    .reduce((sum, m) => sum + m.dailyCount, 0)
                  return (
                    <td key={member.id} className="sticky bottom-0 border-r border-t bg-muted/80 px-2 py-3 text-center backdrop-blur">
                      <span className={cn('inline-flex min-w-12 items-center justify-center rounded-full px-2 py-1 font-bold tabular-nums', total > 0 ? 'bg-primary/10 text-primary' : 'bg-background text-muted-foreground')}>
                        {total > 0 ? total.toFixed(1) : '—'}
                      </span>
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {editingMealInfo ? (
        <MealEntryDialog
          key={`${editingMealInfo.memberId}-${editingMealInfo.dateStr}`}
          info={editingMealInfo}
          open={!!editingMealInfo}
          onOpenChange={(v) => !v && setEditingMealInfo(null)}
          submitting={createMeal.isPending}
          isDeleting={deleteMeal.isPending}
          onSave={async (counts) => {
            await createMeal.mutateAsync({
              member: { id: editingMealInfo.memberId },
              month: { id: monthId },
              recordDate: editingMealInfo.dateStr,
              breakfastCount: counts.breakfastCount,
              lunchCount: counts.lunchCount,
              dinnerCount: counts.dinnerCount,
              status: isManagerOrAdmin ? 'approved' : 'pending',
            })
            setEditingMealInfo(null)
          }}
          onDelete={async () => {
            if (editingMealInfo.meal) await deleteMeal.mutateAsync(editingMealInfo.meal.id)
            setEditingMealInfo(null)
          }}
        />
      ) : null}
    </div>
  )
}

function MealEntryDialog({
  info,
  open,
  onOpenChange,
  submitting,
  isDeleting,
  onSave,
  onDelete,
}: {
  info: { memberName: string; dateStr: string; meal: Meal | null }
  open: boolean
  onOpenChange: (v: boolean) => void
  submitting: boolean
  isDeleting: boolean
  onSave: (counts: { breakfastCount: number; lunchCount: number; dinnerCount: number }) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [breakfastCount, setBreakfastCount] = useState(info.meal ? info.meal.breakfastCount : 1)
  const [lunchCount, setLunchCount] = useState(info.meal ? info.meal.lunchCount : 1)
  const [dinnerCount, setDinnerCount] = useState(info.meal ? info.meal.dinnerCount : 1)

  const total = breakfastCount * 0.5 + lunchCount * 1.0 + dinnerCount * 1.0
  const activeSlots = (breakfastCount > 0 ? 1 : 0) + (lunchCount > 0 ? 1 : 0) + (dinnerCount > 0 ? 1 : 0)

  const dateObj = new Date(info.dateStr + 'T00:00:00')
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' })
  const dateLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const handleSave = () => onSave({ breakfastCount, lunchCount, dinnerCount })

  const slots: Array<{
    key: MealSlot
    count: number
    set: React.Dispatch<React.SetStateAction<number>>
    time: string
    weight: string
    weightNum: number
  }> = [
    { key: 'breakfast', count: breakfastCount, set: setBreakfastCount, time: '7 – 9 AM', weight: '0.5', weightNum: 0.5 },
    { key: 'lunch', count: lunchCount, set: setLunchCount, time: '12 – 2 PM', weight: '1.0', weightNum: 1.0 },
    { key: 'dinner', count: dinnerCount, set: setDinnerCount, time: '7 – 9 PM', weight: '1.0', weightNum: 1.0 },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{info.memberName}</DialogTitle>
          <DialogDescription>{dayName}, {dateLabel}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {slots.map((slot) => (
            <div
              key={slot.key}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border-2 px-4 py-3 transition-all',
                slot.count > 0
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-background',
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn('text-sm font-semibold capitalize', slot.count > 0 ? 'text-foreground' : 'text-muted-foreground')}>
                    {slot.key}
                  </span>
                  <span className={cn('text-xs', slot.count > 0 ? 'text-primary font-medium' : 'text-muted-foreground/60')}>
                    {slot.time}
                  </span>
                </div>
                <span className={cn('text-xs', slot.count > 0 ? 'text-primary/70' : 'text-muted-foreground/50')}>
                  {slot.weight} per meal
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={() => slot.set((v) => Math.max(0, v - 1))}
                  disabled={slot.count <= 0}
                >
                  −
                </Button>
                <span className={cn('w-8 text-center text-lg font-bold tabular-nums', slot.count > 0 ? 'text-primary' : 'text-muted-foreground')}>
                  {slot.count}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={() => slot.set((v) => Math.min(MAX_COUNT, v + 1))}
                  disabled={slot.count >= MAX_COUNT}
                >
                  +
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2.5">
          <span className="text-sm text-muted-foreground">
            {activeSlots === 0 ? 'No meals selected' : `${activeSlots} meal slot${activeSlots > 1 ? 's' : ''} active`}
          </span>
          <span className="text-sm font-semibold tabular-nums">
            Total: {total.toFixed(1)}
          </span>
        </div>

        <DialogFooter>
          {info.meal ? (
            <div className="mr-auto">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={onDelete}
                disabled={submitting || isDeleting}
                title="Delete meal record"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ) : null}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
