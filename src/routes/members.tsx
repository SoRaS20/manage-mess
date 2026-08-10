import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  useCreateMember,
  useDeleteMember,
  useMembers,
  useToggleMemberActive,
  useUpdateMember,
} from '@/api/hooks'
import type { Member } from '@/api/types'
import { useAuthStore } from '@/store/auth'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Field, FormDialog } from '@/components/form-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate, todayISO } from '@/lib/format'

export const Route = createFileRoute('/members')({
  component: MembersPage,
})

const memberSchema = z.object({
  name: z.string().min(2, 'Name must be 2–100 characters').max(100),
  phone: z
    .string()
    .optional()
    .refine((v) => !v || /^[0-9+\-\s]{6,20}$/.test(v), 'Phone must be 6–20 characters (digits, +, -)'),
  joinDate: z.string().min(1, 'Join date is required'),
})

type MemberForm = z.infer<typeof memberSchema>

function MemberDialog({
  open,
  edit,
  submitting,
  onOpenChange,
  onSave,
}: {
  open: boolean
  edit: Member | null
  submitting: boolean
  onOpenChange: (v: boolean) => void
  onSave: (values: MemberForm, existing: Member | null) => Promise<void>
}) {
  const form = useForm<MemberForm>({
    resolver: zodResolver(memberSchema),
    values: edit
      ? { name: edit.name, phone: edit.phone ?? '', joinDate: edit.joinDate }
      : { name: '', phone: '', joinDate: todayISO() },
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={edit ? `Edit ${edit.name}` : 'Add member'}
      submitLabel={edit ? 'Save changes' : 'Add member'}
      submitting={submitting}
      onSubmit={form.handleSubmit(async (v) => {
        await onSave(v, edit)
        form.reset()
      })}
    >
      <Field label="Name" error={form.formState.errors.name?.message}>
        <Input {...form.register('name')} placeholder="e.g. Rahman" autoFocus />
      </Field>
      <Field label="Phone" error={form.formState.errors.phone?.message}>
        <Input {...form.register('phone')} placeholder="e.g. +8801712345678" />
      </Field>
      <Field label="Join date" error={form.formState.errors.joinDate?.message}>
        <Input type="date" {...form.register('joinDate')} />
      </Field>
    </FormDialog>
  )
}

function MembersPage() {
  const { data: members, isLoading } = useMembers()
  const create = useCreateMember()
  const update = useUpdateMember()
  const toggleActive = useToggleMemberActive()
  const remove = useDeleteMember()

  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'ADMIN'

  const [dialog, setDialog] = useState<{ open: boolean; edit: Member | null }>({ open: false, edit: null })
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null)

  const sorted = [...(members ?? [])].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Members</h1>
          <p className="text-sm text-muted-foreground">
            {members?.length ?? 0} total · {members?.filter((m) => m.active).length ?? 0} active
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setDialog({ open: true, edit: null })}>
            <Plus /> Add member
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All members</CardTitle>
          <CardDescription>Toggle the status switch to deactivate a member — meals stop generating for them.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No members yet. Add the first one.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-muted-foreground">{m.phone || '—'}</TableCell>
                    <TableCell>{formatDate(m.joinDate)}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => toggleActive.mutate(m.id)}
                        disabled={toggleActive.isPending || !isAdmin}
                        title={m.active ? 'Deactivate' : 'Activate'}
                        className="flex items-center gap-1.5 text-xs font-medium disabled:opacity-50"
                      >
                        <span
                          className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${m.active ? 'bg-primary' : 'bg-input'}`}
                        >
                          <span
                            className={`inline-block size-3 rounded-full bg-white transition-transform ${m.active ? 'translate-x-3.5' : 'translate-x-0.5'}`}
                          />
                        </span>
                        {m.active ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>}
                      </button>
                    </TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setDialog({ open: true, edit: m })}>
                            <Pencil />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(m)}>
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

      <MemberDialog
        open={dialog.open}
        edit={dialog.edit}
        submitting={create.isPending || update.isPending}
        onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))}
        onSave={async (values, existing) => {
          const payload = { name: values.name, phone: values.phone || undefined, joinDate: values.joinDate }
          if (existing) await update.mutateAsync({ id: existing.id, data: payload })
          else await create.mutateAsync(payload)
          setDialog({ open: false, edit: null })
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete member"
        description={deleteTarget ? `"${deleteTarget.name}" will be permanently removed.` : undefined}
        submitting={remove.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return
          await remove.mutateAsync(deleteTarget.id)
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}