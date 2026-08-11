import { useMemo, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useMembers, useMeals, useToggleMeal, useUpdateMeal, useDeleteMeal, useCreateMeal } from '@/api/hooks'
import type { Meal, MealSlot } from '@/api/types'
import { FormDialog } from '@/components/form-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const SLOTS: Array<{ key: MealSlot; label: string; weight: number }> = [
  { key: 'breakfast', label: 'B', weight: 0.5 },
  { key: 'lunch', label: 'L', weight: 1 },
  { key: 'dinner', label: 'D', weight: 1 },
]

function dateKey(year: number, monthNo: number, day: number): string {
  return `${year}-${String(monthNo).padStart(2, '0')}-${String(day).padStart(2, '0')}`
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
  const createMeal = useCreateMeal(monthId)
  const updateMeal = useUpdateMeal(monthId)
  const deleteMeal = useDeleteMeal(monthId)

  const [editingMealInfo, setEditingMealInfo] = useState<{
    memberId: number
    memberName: string
    dateStr: string
    meal: Meal | null
  } | null>(null)

  const daysInMonth = new Date(year, monthNo, 0).getDate()
  const days = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => i + 1),
    [daysInMonth]
  )

  const byKey = useMemo(() => {
    const map = new Map<string, Meal>()
    for (const meal of meals ?? []) {
      map.set(`${meal.memberId}:${meal.recordDate}`, meal)
    }
    return map
  }, [meals])

  const memberCols = useMemo(() => {
    const list = [...(members ?? [])].sort(
      (a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)
    )
    const ids = new Set(list.map((m) => m.id))
    for (const meal of meals ?? []) {
      if (!ids.has(meal.memberId)) {
        list.push({ id: meal.memberId, name: meal.memberName, joinDate: '', active: false, banned: false })
        ids.add(meal.memberId)
      }
    }
    return list
  }, [members, meals])

  const today = new Date()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <p>Click a cell to set meals (B 0.5 · L 1 · D 1).</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : memberCols.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No members yet — add members first to start tracking meals.
        </p>
      ) : (
        <div className="overflow-auto rounded-lg border">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-24 border-b border-r bg-muted px-3 py-2 text-left font-medium">
                  Date
                </th>
                {memberCols.map((member) => (
                  <th
                    key={member.id}
                    className="min-w-20 border-b border-r bg-muted px-1 py-2 text-center font-medium"
                  >
                    {member.name}
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
                return (
                  <tr key={d} className="group">
                    <td
                      className={cn(
                        'sticky left-0 z-10 border-b border-r bg-background px-3 py-1.5 font-medium tabular-nums',
                        isWeekend && 'text-red-500',
                        isToday && 'bg-primary/10 ring-1 ring-inset ring-primary/40'
                      )}
                    >
                      {d}
                      <span className={cn('ml-1.5 text-[10px] font-normal', isWeekend ? 'text-red-500/80' : 'text-muted-foreground')}>
                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                    </td>
                    {memberCols.map((member) => {
                      const meal = byKey.get(`${member.id}:${dateKey(year, monthNo, d)}`)
                      const canEdit = !closed && (isManagerOrAdmin || member.id === user?.memberId)
                      return (
                        <td
                          key={member.id}
                          className={cn(
                            'border-b border-r p-0 cursor-pointer transition-colors',
                            canEdit ? 'hover:bg-accent/60' : 'opacity-70 pointer-events-none'
                          )}
                          onClick={() => {
                            if (canEdit) {
                              setEditingMealInfo({
                                memberId: member.id,
                                memberName: member.name,
                                dateStr: dateKey(year, monthNo, d),
                                meal: meal || null,
                              })
                            }
                          }}
                        >
                          <div className="flex h-8 w-full items-center justify-center gap-1 p-1">
                            {meal ? (
                              <>
                                <span className={cn("size-2 rounded-full", meal.breakfastOn ? "bg-primary" : "bg-muted")} title="Breakfast"></span>
                                <span className={cn("size-2 rounded-full", meal.lunchOn ? "bg-primary" : "bg-muted")} title="Lunch"></span>
                                <span className={cn("size-2 rounded-full", meal.dinnerOn ? "bg-primary" : "bg-muted")} title="Dinner"></span>
                              </>
                            ) : (
                              <span className="text-muted-foreground/30 text-[10px] font-medium">+</span>
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
                <td className="sticky left-0 z-10 border-t border-r bg-muted px-3 py-1.5 text-left font-semibold">
                  Count
                </td>
                {memberCols.map((member) => {
                  const total = days
                    .map((d) => byKey.get(`${member.id}:${dateKey(year, monthNo, d)}`))
                    .filter((m): m is Meal => !!m)
                    .reduce((sum, m) => sum + m.dailyCount, 0)
                  return (
                    <td key={member.id} className="border-t border-r bg-muted/40 px-1 py-1.5 text-center font-semibold tabular-nums">
                      {total > 0 ? total.toFixed(1) : '—'}
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
          submitting={updateMeal.isPending || createMeal.isPending}
          isDeleting={deleteMeal.isPending}
          onSave={async (flags) => {
            if (editingMealInfo.meal) {
              await updateMeal.mutateAsync({ mealId: editingMealInfo.meal.id, flags })
            } else {
              await createMeal.mutateAsync({
                member: { id: editingMealInfo.memberId },
                month: { id: monthId },
                recordDate: editingMealInfo.dateStr,
                breakfastOn: flags.breakfastOn,
                lunchOn: flags.lunchOn,
                dinnerOn: flags.dinnerOn,
              })
            }
            setEditingMealInfo(null)
          }}
          onDelete={async () => {
            if (editingMealInfo.meal) {
              await deleteMeal.mutateAsync(editingMealInfo.meal.id)
            }
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
  onSave: (flags: { breakfastOn: boolean; lunchOn: boolean; dinnerOn: boolean }) => Promise<void>
  onDelete: () => Promise<void>
}) {
  // Default to all ON if creating a new meal
  const [flags, setFlags] = useState({
    breakfastOn: info.meal ? info.meal.breakfastOn : true,
    lunchOn: info.meal ? info.meal.lunchOn : true,
    dinnerOn: info.meal ? info.meal.dinnerOn : true,
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Meal entry — ${info.memberName}`}
      description={`${info.dateStr} · daily count ${((flags.breakfastOn ? 0.5 : 0) + (flags.lunchOn ? 1 : 0) + (flags.dinnerOn ? 1 : 0)).toFixed(1)}`}
      submitLabel="Save"
      submitting={submitting || isDeleting}
      onSubmit={() => onSave(flags)}
      extraFooter={
        info.meal ? (
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
        ) : null
      }
    >
      <div className="grid grid-cols-3 gap-3">
        {SLOTS.map((slot) => {
          const on = slot.key === 'breakfast' ? flags.breakfastOn : slot.key === 'lunch' ? flags.lunchOn : flags.dinnerOn
          return (
            <button
              key={slot.key}
              type="button"
              onClick={() =>
                setFlags((f) => ({
                  ...f,
                  [slot.key]: !on,
                }))
              }
              className={cn(
                'flex h-16 flex-col items-center justify-center gap-1.5 rounded-lg border text-sm font-semibold transition-colors',
                on ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-input text-muted-foreground hover:bg-muted'
              )}
            >
              <span className="uppercase">{slot.key}</span>
              <div
                className={cn(
                  'flex size-5 items-center justify-center rounded-full border',
                  on ? 'border-primary-foreground/50 bg-primary-foreground text-primary' : 'border-muted-foreground/30 bg-background/50'
                )}
              >
                {on && (
                  <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </button>
          )
        })}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Pencil className="size-3" /> Weights: breakfast 0.5 · lunch 1 · dinner 1
      </p>
    </FormDialog>
  )
}