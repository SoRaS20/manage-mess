import { useMemo, useState } from 'react'
import { Pencil, Trash2, Wand2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useGenerateMeals, useMembers, useMeals, useToggleMeal, useUpdateMeal, useDeleteMeal } from '@/api/hooks'
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
  const isManagerOrAdmin = isAdmin || (user?.memberId !== null && user?.memberId === managerId)

  const { data: meals, isLoading } = useMeals(monthId)
  const { data: members } = useMembers()
  const generate = useGenerateMeals(monthId)
  const toggle = useToggleMeal(monthId)
  const updateMeal = useUpdateMeal(monthId)
  const deleteMeal = useDeleteMeal(monthId)

  const [editingMeal, setEditingMeal] = useState<Meal | null>(null)

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

  const rows = useMemo(() => {
    const list = [...(members ?? [])].sort(
      (a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)
    )
    const ids = new Set(list.map((m) => m.id))
    for (const meal of meals ?? []) {
      if (!ids.has(meal.memberId)) {
        list.push({ id: meal.memberId, name: meal.memberName, joinDate: '', active: false })
        ids.add(meal.memberId)
      }
    }
    return list
  }, [members, meals])

  const anyMeal = (meals?.length ?? 0) > 0
  const today = new Date()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <p>Click a chip to toggle a meal slot (B 0.5 · L 1 · D 1).</p>
        </div>
        {isManagerOrAdmin && (
          <Button size="sm" variant="outline" onClick={() => generate.mutate()} disabled={closed || generate.isPending || anyMeal}>
            <Wand2 /> Generate meals
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No members yet — add members first, then generate meals.
        </p>
      ) : (
        <div className="overflow-auto rounded-lg border">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-32 border-b border-r bg-muted px-3 py-2 text-left font-medium">
                  Member
                </th>
                {days.map((d) => {
                  const date = new Date(year, monthNo - 1, d)
                  const isToday = today.getFullYear() === year && today.getMonth() === monthNo - 1 && today.getDate() === d
                  return (
                    <th
                      key={d}
                      className={cn(
                        'min-w-11 border-b border-r bg-muted px-1 py-2 text-center font-medium tabular-nums',
                        date.getDay() === 0 && 'text-red-500',
                        isToday && 'bg-primary/10 ring-1 ring-inset ring-primary/40'
                      )}
                    >
                      {d}
                      <span className="block text-[10px] font-normal text-muted-foreground">
                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                    </th>
                  )
                })}
                <th className="min-w-14 border-b bg-muted px-1 py-2 text-center font-medium">Count</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((member) => {
                const memberMeals = days
                  .map((d) => byKey.get(`${member.id}:${dateKey(year, monthNo, d)}`))
                  .filter((m): m is Meal => !!m)
                const total = memberMeals.reduce((sum, m) => sum + m.dailyCount, 0)
                return (
                  <tr key={member.id} className="group">
                    <td className="sticky left-0 z-10 border-b border-r bg-background px-3 py-1.5 font-medium">
                      {member.name}
                    </td>
                    {days.map((d) => {
                      const meal = byKey.get(`${member.id}:${dateKey(year, monthNo, d)}`)
                      return (
                        <td key={d} className="border-b border-r p-0.5">
                          {meal ? (
                            <div
                              className={cn(
                                'flex items-center justify-center gap-0.5 rounded',
                                !closed && isAdmin && 'cursor-pointer hover:bg-accent/60'
                              )}
                              onClick={() => {
                                if (isAdmin && !closed) setEditingMeal(meal)
                              }}
                              title={isAdmin ? "Edit all slots (admin correction)" : undefined}
                            >
                              {SLOTS.map((slot) => {
                                const on = meal[`${slot.key}On`]
                                return (
                                  <button
                                    key={slot.key}
                                    type="button"
                                    disabled={closed || (!isAdmin && member.id !== user?.memberId)}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toggle.mutate({ mealId: meal.id, slot: slot.key, on: !on })
                                    }}
                                    className={cn(
                                      'size-5 rounded text-[10px] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40',
                                      on
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'bg-muted text-muted-foreground hover:bg-accent'
                                    )}
                                  >
                                    {slot.label}
                                  </button>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-0.5">
                              <span className="text-muted-foreground/40">·</span>
                            </div>
                          )}
                        </td>
                      )
                    })}
                    <td className="border-b bg-muted/40 px-1 py-1.5 text-center font-semibold tabular-nums">
                      {total > 0 ? total.toFixed(1) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editingMeal ? (
        <AdminCorrectDialog
          key={editingMeal.id}
          meal={editingMeal}
          open={!!editingMeal}
          onOpenChange={(v) => !v && setEditingMeal(null)}
          submitting={updateMeal.isPending}
          isDeleting={deleteMeal.isPending}
          onSave={async (flags) => {
            await updateMeal.mutateAsync({ mealId: editingMeal.id, flags })
            setEditingMeal(null)
          }}
          onDelete={async () => {
            await deleteMeal.mutateAsync(editingMeal.id)
            setEditingMeal(null)
          }}
        />
      ) : null}
    </div>
  )
}

function AdminCorrectDialog({
  meal,
  open,
  onOpenChange,
  submitting,
  isDeleting,
  onSave,
  onDelete,
}: {
  meal: Meal
  open: boolean
  onOpenChange: (v: boolean) => void
  submitting: boolean
  isDeleting: boolean
  onSave: (flags: { breakfastOn: boolean; lunchOn: boolean; dinnerOn: boolean }) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [flags, setFlags] = useState({ breakfastOn: meal.breakfastOn, lunchOn: meal.lunchOn, dinnerOn: meal.dinnerOn })

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Admin correction — ${meal.memberName}`}
      description={`${meal.recordDate} · daily count ${((flags.breakfastOn ? 0.5 : 0) + (flags.lunchOn ? 1 : 0) + (flags.dinnerOn ? 1 : 0)).toFixed(1)}`}
      submitLabel="Save"
      submitting={submitting || isDeleting}
      onSubmit={() => onSave(flags)}
      extraFooter={
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
                'flex h-14 flex-col items-center justify-center gap-1 rounded-lg border text-sm font-semibold transition-colors',
                on ? 'border-primary bg-primary text-primary-foreground' : 'border-input text-muted-foreground hover:bg-muted'
              )}
            >
              <span className="uppercase">{slot.key}</span>
              <Badge variant={on ? 'outline' : 'secondary'} className="text-[10px]">
                {on ? 'ON' : 'OFF'}
              </Badge>
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