import { useState, type ReactNode } from 'react'
import { useAuthStore } from '@/store/auth'
import { Pencil, Plus, Trash2, Check, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  useBazar,
  useCreateBazar,
  useCreateDeposit,
  useCreateExpense,
  useCreateRent,
  useDeleteBazar,
  useDeleteDeposit,
  useDeleteExpense,
  useDeleteRent,
  useDeposits,
  useExpenses,
  useMembers,
  useRents,
  useUpdateBazar,
  useUpdateDeposit,
  useUpdateExpense,
  useUpdateRent,
  useApproveBazar,
  useRejectBazar,
  useApproveExpense,
  useRejectExpense,
} from '@/api/hooks'
import type { Bazar, Deposit, Expense, ExpenseCategory, Member, Rent } from '@/api/types'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Field, FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { formatDate, formatTaka, todayISO } from '@/lib/format'
import { cn } from '@/lib/utils'

const EXPENSE_CATEGORIES: Array<{ value: ExpenseCategory; label: string }> = [
  { value: 'gas', label: 'Gas' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'water', label: 'Water' },
  { value: 'internet', label: 'Internet' },
  { value: 'other', label: 'Other' },
]

const amountRule = (v: string) => {
  if (!v.trim()) return false
  const n = Number(v)
  return !Number.isNaN(n) && n >= 0
}

// ---------- shared pieces ----------

function MemberSelectField({
  value,
  onChange,
  disabled,
}: {
  value: string | undefined
  onChange: (id: string) => void
  disabled?: boolean
}) {
  const { data: members } = useMembers()
  return (
    <Select items={members?.map((m) => ({ value: String(m.id), label: m.name }))} value={value} onValueChange={(v) => v !== null && onChange(v)} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select member" />
      </SelectTrigger>
      <SelectContent>
        {members?.map((m) => (
          <SelectItem key={m.id} value={String(m.id)}>
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function LedgerShell({
  title,
  description,
  addLabel,
  onAdd,
  disabled,
  count,
  children,
}: {
  title: string
  description: string
  addLabel: string
  onAdd: () => void
  disabled: boolean
  count?: number
  children: ReactNode
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          {count !== undefined ? <span className="text-xs text-muted-foreground">{count} rows</span> : null}
          <Button size="sm" onClick={onAdd} disabled={disabled}>
            <Plus /> {addLabel}
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border">{children}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
        <span className="size-1 rounded-full bg-yellow-500" />
        Pending
      </span>
    )
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
        <span className="size-1 rounded-full bg-red-500" />
        Rejected
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
      <span className="size-1 rounded-full bg-green-500" />
      Approved
    </span>
  )
}

function AuditInfo({ createdAt, updatedAt }: { createdAt?: string | null; updatedAt?: string | null }) {
  const created = createdAt ? new Date(createdAt) : null
  const updated = updatedAt ? new Date(updatedAt) : null
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (!created && !updated) return null
  return (
    <div className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
      {created && <span>Created {fmt(created)}</span>}
      {updated && <span>{created ? ' · ' : ''}Updated {fmt(updated)}</span>}
    </div>
  )
}

function LoadingRows() {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{text}</p>
}

function RowActions({
  disabled,
  onEdit,
  onDelete,
}: {
  disabled: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className={cn('flex justify-end gap-1', disabled && 'pointer-events-none opacity-40')}>
      <Button variant="ghost" size="icon" onClick={onEdit}>
        <Pencil />
      </Button>
      <Button variant="ghost" size="icon" onClick={onDelete}>
        <Trash2 className="text-destructive" />
      </Button>
    </div>
  )
}

// ---------- Bazar ----------

const bazarSchema = z.object({
  memberId: z.string().min(1, 'Select a member'),
  amount: z.string().refine(amountRule, 'Enter a valid amount'),
  description: z.string().max(255).optional(),
  bazarDate: z.string().min(1, 'Date is required'),
})

type BazarForm = z.infer<typeof bazarSchema>

export function BazarLedger({ monthId, closed, managerId }: { monthId: number; closed: boolean; managerId: number | null }) {
  const user = useAuthStore((s) => s.user)
  const isManagerOrAdmin = user?.role === 'ADMIN' || (user?.memberId !== null && user?.memberId === managerId)
  const { data, isLoading } = useBazar(monthId)
  const create = useCreateBazar(monthId)
  const update = useUpdateBazar(monthId)
  const remove = useDeleteBazar(monthId)
  const approveB = useApproveBazar(monthId)
  const rejectB = useRejectBazar(monthId)
  const [dialog, setDialog] = useState<{ open: boolean; edit: Bazar | null }>({ open: false, edit: null })
  const [deleteTarget, setDeleteTarget] = useState<Bazar | null>(null)

  return (
    <LedgerShell
      title="Bazar"
      description="Grocery and shopping entries. Meal rate = total bazar / total meals."
      addLabel="Add bazar"
      onAdd={() => setDialog({ open: true, edit: null })}
      disabled={closed}
      count={data?.length}
    >
      {isLoading ? (
        <LoadingRows />
      ) : !data?.length ? (
        <Empty text="No bazar entries this month." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Date</TableHead>
              <TableHead className="font-semibold">Member</TableHead>
              <TableHead className="font-semibold">Description</TableHead>
              <TableHead className="text-right font-semibold">Amount</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.id} className={cn('transition-colors hover:bg-muted/30', row.status === 'pending' ? 'bg-yellow-50/50 dark:bg-yellow-950/20' : row.status === 'rejected' ? 'bg-destructive/5' : '')}>
                <TableCell>
                  {formatDate(row.bazarDate)}
                  <AuditInfo createdAt={row.createdAt} updatedAt={row.updatedAt} />
                </TableCell>
                <TableCell className="font-medium">{row.memberName}</TableCell>
                <TableCell className="text-muted-foreground">{row.description || '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{formatTaka(row.amount)}</TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {isManagerOrAdmin && !closed && row.status === 'pending' && user?.memberId && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-green-600 hover:bg-green-50 hover:text-green-700"
                          onClick={() => approveB.mutate({ id: row.id, approvedBy: user.memberId! })}
                          title="Approve"
                        >
                          <Check className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => rejectB.mutate({ id: row.id, approvedBy: user.memberId! })}
                          title="Reject"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </>
                    )}
                    <RowActions
                      disabled={closed || !isManagerOrAdmin}
                      onEdit={() => setDialog({ open: true, edit: row })}
                      onDelete={() => setDeleteTarget(row)}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <BazarDialog
        monthId={monthId}
        open={dialog.open}
        edit={dialog.edit}
        submitting={create.isPending || update.isPending}
        onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))}
        onSubmit={async (values, existing) => {
          const payload = {
            member: { id: Number(values.memberId) },
            month: { id: monthId },
            amount: Number(values.amount),
            description: values.description || undefined,
            bazarDate: values.bazarDate,
            status: isManagerOrAdmin ? 'approved' : 'pending',
          }
          if (existing) {
            await update.mutateAsync({ id: existing.id, data: payload })
          } else {
            await create.mutateAsync(payload)
          }
          setDialog({ open: false, edit: null })
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete bazar entry"
        description={deleteTarget ? `${formatTaka(deleteTarget.amount)} on ${formatDate(deleteTarget.bazarDate)} will be removed.` : undefined}
        submitting={remove.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return
          await remove.mutateAsync(deleteTarget.id)
          setDeleteTarget(null)
        }}
      />
    </LedgerShell>
  )
}

function bazarFormValues(edit: Bazar | null, userMemberId?: number | null) {
  return edit
    ? { memberId: String(edit.memberId), amount: String(edit.amount), description: edit.description ?? '', bazarDate: edit.bazarDate }
    : { memberId: userMemberId ? String(userMemberId) : '', amount: '', description: '', bazarDate: todayISO() }
}

function BazarDialog({
  monthId: _monthId,
  open,
  edit,
  submitting,
  onOpenChange,
  onSubmit,
}: {
  monthId: number
  open: boolean
  edit: Bazar | null
  submitting: boolean
  onOpenChange: (v: boolean) => void
  onSubmit: (values: BazarForm, existing: Bazar | null) => Promise<void>
}) {
  const userMemberId = useAuthStore((s) => s.user?.memberId)
  const form = useForm<BazarForm>({
    resolver: zodResolver(bazarSchema),
    values: bazarFormValues(edit, userMemberId),
  })
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={edit ? 'Update bazar entry' : 'Add bazar entry'}
      submitting={submitting}
      onSubmit={form.handleSubmit(async (v) => onSubmit(v, edit))}
    >
      <Field label="Member" error={form.formState.errors.memberId?.message}>
        <MemberSelectField value={form.watch('memberId')} onChange={(id) => form.setValue('memberId', id, { shouldValidate: true })} />
      </Field>
      <Field label="Amount (BDT)" error={form.formState.errors.amount?.message}>
        <Input type="number" step="0.01" min={0} {...form.register('amount')} />
      </Field>
      <Field label="Description" error={form.formState.errors.description?.message}>
        <Input {...form.register('description')} placeholder="e.g. Rice, oil, spices" />
      </Field>
      <Field label="Date" error={form.formState.errors.bazarDate?.message}>
        <Input type="date" {...form.register('bazarDate')} />
      </Field>
    </FormDialog>
  )
}

// ---------- Expenses ----------

const expenseSchema = z.object({
  amount: z.string().refine(amountRule, 'Enter a valid amount'),
  description: z.string().max(255).optional(),
  category: z.enum(['gas', 'electricity', 'water', 'internet', 'other']),
  expenseDate: z.string().min(1, 'Date is required'),
  paidById: z.string().optional(),
})

type ExpenseForm = z.infer<typeof expenseSchema>

export function ExpensesLedger({ monthId, closed, managerId }: { monthId: number; closed: boolean; managerId: number | null }) {
  const user = useAuthStore((s) => s.user)
  const isManagerOrAdmin = user?.role === 'ADMIN' || (user?.memberId !== null && user?.memberId === managerId)
  const { data, isLoading } = useExpenses(monthId)
  const create = useCreateExpense(monthId)
  const update = useUpdateExpense(monthId)
  const remove = useDeleteExpense(monthId)
  const approveE = useApproveExpense(monthId)
  const rejectE = useRejectExpense(monthId)
  const [dialog, setDialog] = useState<{ open: boolean; edit: Expense | null }>({ open: false, edit: null })
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)

  return (
    <LedgerShell
      title="Expenses"
      description="Shared bills — split equally among active members."
      addLabel="Add expense"
      onAdd={() => setDialog({ open: true, edit: null })}
      disabled={closed}
      count={data?.length}
    >
      {isLoading ? (
        <LoadingRows />
      ) : !data?.length ? (
        <Empty text="No expenses this month." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Date</TableHead>
              <TableHead className="font-semibold">Category</TableHead>
              <TableHead className="font-semibold">Description</TableHead>
              <TableHead className="font-semibold">Paid by</TableHead>
              <TableHead className="text-right font-semibold">Amount</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.id} className={cn('transition-colors hover:bg-muted/30', row.status === 'pending' ? 'bg-yellow-50/50 dark:bg-yellow-950/20' : row.status === 'rejected' ? 'bg-destructive/5' : '')}>
                <TableCell>
                  {formatDate(row.expenseDate)}
                  <AuditInfo createdAt={row.createdAt} updatedAt={row.updatedAt} />
                </TableCell>
                <TableCell>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs capitalize">{row.category}</span>
                </TableCell>
                <TableCell className="text-muted-foreground">{row.description || '—'}</TableCell>
                <TableCell>{row.paidByName ?? '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{formatTaka(row.amount)}</TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {isManagerOrAdmin && !closed && row.status === 'pending' && user?.memberId && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-green-600 hover:bg-green-50 hover:text-green-700"
                          onClick={() => approveE.mutate({ id: row.id, approvedBy: user.memberId! })}
                          title="Approve"
                        >
                          <Check className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => rejectE.mutate({ id: row.id, approvedBy: user.memberId! })}
                          title="Reject"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </>
                    )}
                    <RowActions disabled={closed || !isManagerOrAdmin} onEdit={() => setDialog({ open: true, edit: row })} onDelete={() => setDeleteTarget(row)} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ExpenseDialog
        monthId={monthId}
        open={dialog.open}
        edit={dialog.edit}
        submitting={create.isPending || update.isPending}
        onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))}
        onSubmit={async (values, existing) => {
          const paidById = values.paidById && values.paidById !== 'none' ? Number(values.paidById) : undefined
          const payload = {
            month: { id: monthId },
            amount: Number(values.amount),
            description: values.description || undefined,
            category: values.category,
            expenseDate: values.expenseDate,
            paidBy: paidById ? { id: paidById } : undefined,
            status: isManagerOrAdmin ? 'approved' : 'pending',
          }
          if (existing) {
            await update.mutateAsync({ id: existing.id, data: payload })
          } else {
            await create.mutateAsync(payload)
          }
          setDialog({ open: false, edit: null })
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete expense"
        description={deleteTarget ? `${formatTaka(deleteTarget.amount)} · ${deleteTarget.category} on ${formatDate(deleteTarget.expenseDate)}` : undefined}
        submitting={remove.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return
          await remove.mutateAsync(deleteTarget.id)
          setDeleteTarget(null)
        }}
      />
    </LedgerShell>
  )
}

function expenseFormValues(edit: Expense | null, userMemberId?: number | null) {
  return edit
    ? { amount: String(edit.amount), description: edit.description ?? '', category: edit.category as ExpenseCategory, expenseDate: edit.expenseDate, paidById: edit.paidById != null ? String(edit.paidById) : 'none' }
    : { amount: '', description: '', category: 'other' as const, expenseDate: todayISO(), paidById: userMemberId ? String(userMemberId) : 'none' }
}

function ExpenseDialog({
  monthId: _monthId,
  open,
  edit,
  submitting,
  onOpenChange,
  onSubmit,
}: {
  monthId: number
  open: boolean
  edit: Expense | null
  submitting: boolean
  onOpenChange: (v: boolean) => void
  onSubmit: (values: ExpenseForm, existing: Expense | null) => Promise<void>
}) {
  const userMemberId = useAuthStore((s) => s.user?.memberId)
  const form = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    values: expenseFormValues(edit, userMemberId),
  })
  const { data: members } = useMembers()
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={edit ? 'Update expense' : 'Add expense'}
      submitting={submitting}
      onSubmit={form.handleSubmit(async (v) => onSubmit(v, edit))}
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Amount (BDT)" error={form.formState.errors.amount?.message}>
          <Input type="number" step="0.01" min={0} {...form.register('amount')} />
        </Field>
        <Field label="Category" error={form.formState.errors.category?.message}>
          <Select items={EXPENSE_CATEGORIES} value={form.watch('category')} onValueChange={(v) => v !== null && form.setValue('category', v as ExpenseCategory, { shouldValidate: true })}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Description" error={form.formState.errors.description?.message}>
        <Input {...form.register('description')} placeholder="e.g. Electricity bill" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Date" error={form.formState.errors.expenseDate?.message}>
          <Input type="date" {...form.register('expenseDate')} />
        </Field>
        <Field label="Paid by" error={form.formState.errors.paidById?.message}>
          <Select items={[{ value: 'none', label: 'Not set' }, ...(members?.map((m) => ({ value: String(m.id), label: m.name })) ?? [])]} value={form.watch('paidById')} onValueChange={(v) => v !== null && form.setValue('paidById', v, { shouldValidate: true })}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Paid by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not set</SelectItem>
              {members?.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </FormDialog>
  )
}

// ---------- Deposits ----------

const depositSchema = z.object({
  memberId: z.string().min(1, 'Select a member'),
  amount: z.string().refine(amountRule, 'Enter a valid amount'),
  description: z.string().max(255).optional(),
  depositDate: z.string().min(1, 'Date is required'),
})

type DepositForm = z.infer<typeof depositSchema>

export function DepositsLedger({ monthId, closed, managerId }: { monthId: number; closed: boolean; managerId: number | null }) {
  const user = useAuthStore((s) => s.user)
  const isManagerOrAdmin = user?.role === 'ADMIN' || (user?.memberId !== null && user?.memberId === managerId)
  const { data, isLoading } = useDeposits(monthId)
  const create = useCreateDeposit(monthId)
  const update = useUpdateDeposit(monthId)
  const remove = useDeleteDeposit(monthId)
  const [dialog, setDialog] = useState<{ open: boolean; edit: Deposit | null }>({ open: false, edit: null })
  const [deleteTarget, setDeleteTarget] = useState<Deposit | null>(null)

  return (
    <LedgerShell
      title="Rent Deposits"
      description="Rent deposits paid by members for the month."
      addLabel="Add rent deposit"
      onAdd={() => setDialog({ open: true, edit: null })}
      disabled={closed || !isManagerOrAdmin}
      count={data?.length}
    >
      {isLoading ? (
        <LoadingRows />
      ) : !data?.length ? (
        <Empty text="No deposits this month." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Date</TableHead>
              <TableHead className="font-semibold">Member</TableHead>
              <TableHead className="font-semibold">Description</TableHead>
              <TableHead className="text-right font-semibold">Amount</TableHead>
              <TableHead className="text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.id} className="transition-colors hover:bg-muted/30">
                <TableCell>
                  {formatDate(row.depositDate)}
                  <AuditInfo createdAt={row.createdAt} updatedAt={row.updatedAt} />
                </TableCell>
                <TableCell className="font-medium">{row.memberName}</TableCell>
                <TableCell className="text-muted-foreground">{row.description || '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{formatTaka(row.amount)}</TableCell>
                <TableCell>
                  <RowActions disabled={closed || !isManagerOrAdmin} onEdit={() => setDialog({ open: true, edit: row })} onDelete={() => setDeleteTarget(row)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <DepositDialog
        monthId={monthId}
        open={dialog.open}
        edit={dialog.edit}
        submitting={create.isPending || update.isPending}
        onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))}
        onSubmit={async (values, existing) => {
          const payload = {
            member: { id: Number(values.memberId) },
            month: { id: monthId },
            amount: Number(values.amount),
            depositDate: values.depositDate,
            description: values.description || undefined,
          }
          if (existing) await update.mutateAsync({ id: existing.id, data: payload })
          else await create.mutateAsync(payload)
          setDialog({ open: false, edit: null })
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete rent deposit"
        description={deleteTarget ? `${formatTaka(deleteTarget.amount)} on ${formatDate(deleteTarget.depositDate)} will be removed.` : undefined}
        submitting={remove.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return
          await remove.mutateAsync(deleteTarget.id)
          setDeleteTarget(null)
        }}
      />
    </LedgerShell>
  )
}

function depositFormValues(edit: Deposit | null, userMemberId?: number | null) {
  return edit
    ? { memberId: String(edit.memberId), amount: String(edit.amount), description: edit.description ?? '', depositDate: edit.depositDate }
    : { memberId: userMemberId ? String(userMemberId) : '', amount: '', description: '', depositDate: todayISO() }
}

function DepositDialog({
  monthId: _monthId,
  open,
  edit,
  submitting,
  onOpenChange,
  onSubmit,
}: {
  monthId: number
  open: boolean
  edit: Deposit | null
  submitting: boolean
  onOpenChange: (v: boolean) => void
  onSubmit: (values: DepositForm, existing: Deposit | null) => Promise<void>
}) {
  const userMemberId = useAuthStore((s) => s.user?.memberId)
  const form = useForm<DepositForm>({
    resolver: zodResolver(depositSchema),
    values: depositFormValues(edit, userMemberId),
  })
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={edit ? 'Update rent deposit' : 'Add rent deposit'}
      submitting={submitting}
      onSubmit={form.handleSubmit(async (v) => onSubmit(v, edit))}
    >
      <Field label="Member" error={form.formState.errors.memberId?.message}>
        <MemberSelectField value={form.watch('memberId')} onChange={(id) => form.setValue('memberId', id, { shouldValidate: true })} />
      </Field>
      <Field label="Amount (BDT)" error={form.formState.errors.amount?.message}>
        <Input type="number" step="0.01" min={0} {...form.register('amount')} />
      </Field>
      <Field label="Description" error={form.formState.errors.description?.message}>
        <Input {...form.register('description')} placeholder="e.g. Mid-month top-up" />
      </Field>
      <Field label="Date" error={form.formState.errors.depositDate?.message}>
        <Input type="date" {...form.register('depositDate')} />
      </Field>
    </FormDialog>
  )
}

// ---------- Rents ----------

const rentSchema = z.object({
  memberId: z.string().min(1, 'Select a member'),
  amount: z.string().refine(amountRule, 'Enter a valid amount'),
})

type RentForm = z.infer<typeof rentSchema>

export function RentsLedger({ monthId, closed, managerId }: { monthId: number; closed: boolean; managerId: number | null }) {
  const user = useAuthStore((s) => s.user)
  const isManagerOrAdmin = user?.role === 'ADMIN' || (user?.memberId !== null && user?.memberId === managerId)
  const { data, isLoading } = useRents(monthId)
  const create = useCreateRent(monthId)
  const update = useUpdateRent(monthId)
  const remove = useDeleteRent(monthId)
  const [dialog, setDialog] = useState<{ open: boolean; edit: Rent | null }>({ open: false, edit: null })
  const [deleteTarget, setDeleteTarget] = useState<Rent | null>(null)

  return (
    <LedgerShell
      title="Rents"
      description="Monthly rent per member (unique per member + month)."
      addLabel="Add rent"
      onAdd={() => setDialog({ open: true, edit: null })}
      disabled={closed || !isManagerOrAdmin}
      count={data?.length}
    >
      {isLoading ? (
        <LoadingRows />
      ) : !data?.length ? (
        <Empty text="No rents set this month." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Member</TableHead>
              <TableHead className="text-right font-semibold">Rent</TableHead>
              <TableHead className="text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.id} className="transition-colors hover:bg-muted/30">
                <TableCell className="font-medium">{row.memberName}</TableCell>
                <TableCell className="text-right tabular-nums">{formatTaka(row.amount)}</TableCell>
                <TableCell>
                  <RowActions disabled={closed || !isManagerOrAdmin} onEdit={() => setDialog({ open: true, edit: row })} onDelete={() => setDeleteTarget(row)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <RentDialog
        monthId={monthId}
        open={dialog.open}
        edit={dialog.edit}
        submitting={create.isPending || update.isPending}
        onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))}
        onSubmit={async (values, existing) => {
          const payload = { member: { id: Number(values.memberId) }, month: { id: monthId }, amount: Number(values.amount) }
          if (existing) await update.mutateAsync({ id: existing.id, data: payload })
          else await create.mutateAsync(payload)
          setDialog({ open: false, edit: null })
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Remove rent"
        description={deleteTarget ? `${deleteTarget.memberName}'s rent of ${formatTaka(deleteTarget.amount)} will be removed.` : undefined}
        submitting={remove.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return
          await remove.mutateAsync(deleteTarget.id)
          setDeleteTarget(null)
        }}
      />
    </LedgerShell>
  )
}

function RentDialog({
  monthId: _monthId,
  open,
  edit,
  submitting,
  onOpenChange,
  onSubmit,
}: {
  monthId: number
  open: boolean
  edit: Rent | null
  submitting: boolean
  onOpenChange: (v: boolean) => void
  onSubmit: (values: RentForm, existing: Rent | null) => Promise<void>
}) {
  const form = useForm<RentForm>({
    resolver: zodResolver(rentSchema),
    values: edit ? { memberId: String(edit.memberId), amount: String(edit.amount) } : { memberId: '', amount: '' },
  })
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={edit ? 'Update rent' : 'Set rent'}
      submitting={submitting}
      onSubmit={form.handleSubmit(async (v) => onSubmit(v, edit))}
    >
      <Field label="Member" error={form.formState.errors.memberId?.message}>
        <MemberSelectField value={form.watch('memberId')} onChange={(id) => form.setValue('memberId', id, { shouldValidate: true })} />
      </Field>
      <Field label="Rent (BDT)" error={form.formState.errors.amount?.message}>
        <Input type="number" step="0.01" min={0} {...form.register('amount')} />
      </Field>
    </FormDialog>
  )
}