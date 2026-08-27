import { useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { CalendarRange, Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  useCloseMonth,
  useCreateMonth,
  useDeleteMonth,
  useMembers,
  useMonths,
  useReopenMonth,
  useSetManager,
  useUpdateMonth,
} from '@/api/hooks'
import type { Month } from '@/api/types'
import { useAuthStore } from '@/store/auth'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Field, FormDialog } from '@/components/form-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Lock, LockOpen, Pencil, Trash2 } from 'lucide-react'
import { MONTH_NAMES, monthShort } from '@/lib/format'

export const Route = createFileRoute('/months/')({
  component: MonthsPage,
})

const createMonthSchema = z.object({
  year: z
    .string()
    .trim()
    .min(1, 'Year is required')
    .refine((v) => {
      const n = Number(v)
      return Number.isInteger(n) && n >= 2000 && n <= 2100
    }, 'Year must be 2000-2100'),
  monthNo: z.string().min(1, 'Month is required'),
})

function MonthDialog({
  open,
  edit,
  onOpenChange,
}: {
  open: boolean
  edit: Month | null
  onOpenChange: (v: boolean) => void
}) {
  const createMonth = useCreateMonth()
  const updateMonth = useUpdateMonth()
  const currentYear = new Date().getFullYear()
  const form = useForm<z.infer<typeof createMonthSchema>>({
    resolver: zodResolver(createMonthSchema),
    values: edit
      ? { year: String(edit.year), monthNo: String(edit.monthNo) }
      : { year: String(currentYear), monthNo: String(new Date().getMonth() + 1) },
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={edit ? 'Edit month' : 'Create month'}
      description={edit ? 'Update the year and month.' : 'Open a new billing month. Duplicate (year, month) returns the existing month.'}
      submitLabel={edit ? 'Save changes' : 'Create'}
      submitting={createMonth.isPending || updateMonth.isPending}
      onSubmit={form.handleSubmit(async (values) => {
        const payload = { year: Number(values.year), monthNo: Number(values.monthNo) }
        if (edit) {
          await updateMonth.mutateAsync({ id: edit.id, data: payload })
        } else {
          await createMonth.mutateAsync(payload)
        }
        form.reset()
        onOpenChange(false)
      })}
    >
      <Field label="Year" error={form.formState.errors.year?.message}>
        <Input type="number" {...form.register('year')} />
      </Field>
      <Field label="Month" error={form.formState.errors.monthNo?.message}>
        <Select
          items={MONTH_NAMES.map((name, i) => ({ value: String(i + 1), label: name }))}
          value={form.watch('monthNo')}
          onValueChange={(v) => form.setValue('monthNo', v ?? '', { shouldValidate: true })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            {MONTH_NAMES.map((name, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </FormDialog>
  )
}

function MonthsPage() {
  const { data: months, isLoading } = useMonths()
  const { data: members } = useMembers()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'ADMIN'
  const [dialog, setDialog] = useState<{ open: boolean; edit: Month | null }>({ open: false, edit: null })
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [managerConfirm, setManagerConfirm] = useState<{ monthId: number; memberId: number; monthLabel: string; currentManagerName: string | null } | null>(null)

  const closeMonth = useCloseMonth()
  const reopenMonth = useReopenMonth()
  const setManager = useSetManager()
  const deleteMonth = useDeleteMonth()

  const sorted = useMemo(() => {
    const list = [...(months ?? [])]
    list.sort((a, b) => b.year - a.year || b.monthNo - a.monthNo)
    return list
  }, [months])

  const toggleClose = async (monthId: number, closed: boolean) => {
    if (closed) reopenMonth.mutate(monthId)
    else closeMonth.mutate(monthId)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Months</h1>
          <p className="text-sm text-muted-foreground">Open, close and manage billing months.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setDialog({ open: true, edit: null })}>
            <Plus /> New month
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No months yet. Create one to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-48">Manager</TableHead>
                  <TableHead className="w-56 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Link to="/months/$monthId" params={{ monthId: String(m.id) } as any} className="font-medium hover:underline">
                        <CalendarRange className="mr-2 inline size-3.5 text-muted-foreground" />
                        {monthShort(m.year, m.monthNo)}
                      </Link>
                      <span className="text-xs text-muted-foreground"> #{m.id}</span>
                    </TableCell>
                    <TableCell>
                      {m.closed ? <Badge variant="destructive">Closed</Badge> : <Badge variant="secondary">Open</Badge>}
                    </TableCell>
                    <TableCell>
                      <Select
                        items={members?.filter((mb) => mb.active).map((mb) => ({ value: mb.id, label: mb.name }))}
                        value={m.managerId ?? undefined}
                        onValueChange={(v) => {
                          if (v === null) return
                          const currentManager = m.managerId ? members?.find((mb) => mb.id === m.managerId) : null
                          setManagerConfirm({
                            monthId: m.id,
                            memberId: v,
                            monthLabel: monthShort(m.year, m.monthNo),
                            currentManagerName: currentManager?.name ?? null,
                          })
                        }}
                        disabled={m.closed || !isAdmin}
                      >
                        <SelectTrigger size="sm" className="w-full">
                          <SelectValue placeholder="No manager" />
                        </SelectTrigger>
                        <SelectContent>
                          {members
                            ?.filter((mb) => mb.active)
                            .map((mb) => (
                              <SelectItem key={mb.id} value={mb.id}>
                                {mb.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleClose(m.id, m.closed)}
                            disabled={closeMonth.isPending || reopenMonth.isPending || setManager.isPending}
                          >
                            {m.closed ? (
                              <>
                                <LockOpen /> Reopen
                              </>
                            ) : (
                              <>
                                <Lock /> Close
                              </>
                            )}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDialog({ open: true, edit: m })}>
                            <Pencil />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(m.id)}>
                            <Trash2 className="text-destructive" />
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <MonthDialog open={dialog.open} edit={dialog.edit} onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))} />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete month"
        description="This removes the month and its meals, bazar, expenses, deposits and rents. This cannot be undone."
        submitting={deleteMonth.isPending}
        onConfirm={async () => {
          if (deleteTarget === null) return
          await deleteMonth.mutateAsync(deleteTarget)
          setDeleteTarget(null)
        }}
      />

      <ConfirmDialog
        open={managerConfirm !== null}
        onOpenChange={(v) => !v && setManagerConfirm(null)}
        title={managerConfirm?.currentManagerName ? 'Change Manager' : 'Assign Manager'}
        description={
          managerConfirm
            ? managerConfirm.currentManagerName
              ? `Change manager for ${managerConfirm.monthLabel} from ${managerConfirm.currentManagerName} to ${members?.find((mb) => mb.id === managerConfirm.memberId)?.name}?`
              : `Assign ${members?.find((mb) => mb.id === managerConfirm.memberId)?.name} as manager for ${managerConfirm.monthLabel}?`
            : undefined
        }
        confirmLabel="Confirm"
        submitting={setManager.isPending}
        onConfirm={async () => {
          if (!managerConfirm) return
          await setManager.mutateAsync({ monthId: managerConfirm.monthId, memberId: managerConfirm.memberId })
          setManagerConfirm(null)
        }}
      />
    </div>
  )
}