import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Pencil, Plus, Ban, Undo2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  useCreateMember,
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
import { cn } from '@/lib/utils'

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
  createAppUser: z.boolean().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
}).refine(data => !data.createAppUser || (data.username && data.username.length >= 3), {
  message: "Username is required (min 3 chars)",
  path: ["username"]
}).refine(data => !data.createAppUser || (data.password && data.password.length >= 6), {
  message: "Password is required (min 6 chars)",
  path: ["password"]
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
      ? { name: edit.name, phone: edit.phone ?? '', joinDate: edit.joinDate, createAppUser: false, username: '', password: '' }
      : { name: '', phone: '', joinDate: todayISO(), createAppUser: false, username: '', password: '' },
  })
  
  const createAppUser = form.watch('createAppUser')

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

      {(!edit || !edit.userId) && (
        <div className="flex items-center gap-2 pt-2 pb-2">
          <input
            type="checkbox"
            id="createAppUser"
            {...form.register('createAppUser')}
            className="size-4 rounded border-gray-300 text-primary"
          />
          <label htmlFor="createAppUser" className="text-sm font-medium leading-none cursor-pointer">
            Grant App Access (Create User Login)
          </label>
        </div>
      )}

      {createAppUser && (!edit || !edit.userId) && (
        <div className="space-y-4 rounded-md border p-4 bg-muted/50">
          <Field label="Username" error={form.formState.errors.username?.message}>
            <Input {...form.register('username')} placeholder="e.g. rahman123" />
          </Field>
          <Field label="Password" error={form.formState.errors.password?.message}>
            <Input type="password" {...form.register('password')} placeholder="••••••••" />
          </Field>
        </div>
      )}

      {edit?.userId && edit.user && (
        <div className="pt-2">
          <Badge variant="outline" className="text-xs font-normal">
            App login enabled (@{edit.user.username})
          </Badge>
        </div>
      )}
    </FormDialog>
  )
}

function MembersPage() {
  const { data: members, isLoading } = useMembers()
  const create = useCreateMember()
  const update = useUpdateMember()
  const toggleActive = useToggleMemberActive()

  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'ADMIN'

  const [dialog, setDialog] = useState<{ open: boolean; edit: Member | null }>({ open: false, edit: null })
  const [banTarget, setBanTarget] = useState<{ member: Member; action: 'ban' | 'unban' } | null>(null)

  const sorted = [...(members ?? [])].sort((a, b) => {
    if (a.banned && !b.banned) return 1
    if (!a.banned && b.banned) return -1
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Members</h1>
          <p className="text-sm text-muted-foreground">
            {members?.length ?? 0} total · {members?.filter((m) => m.active && !m.banned).length ?? 0} active
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setDialog({ open: true, edit: null })}>
            <Plus /> Add member
          </Button>
        )}
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">All members</CardTitle>
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
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((m) => (
                  <TableRow key={m.id} className={cn('transition-colors', m.banned ? 'opacity-50 bg-muted/30' : 'hover:bg-muted/50')}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className={cn('flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold', m.active && !m.banned ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">{m.name}</div>
                          {m.banned && <span className="text-xs text-destructive">Banned</span>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.phone || '—'}</TableCell>
                    <TableCell className="text-sm">{formatDate(m.joinDate)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleActive.mutate(m.id)}
                          disabled={toggleActive.isPending || !isAdmin || m.banned}
                          title={m.active ? 'Deactivate' : 'Activate'}
                          className="flex-shrink-0 disabled:opacity-50"
                        >
                          <span
                            className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors', m.active ? 'bg-primary' : 'bg-input')}
                          >
                            <span
                              className={cn('inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform', m.active ? 'translate-x-4' : 'translate-x-0.5')}
                            />
                          </span>
                        </button>
                        {m.active ? (
                          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setDialog({ open: true, edit: m })} disabled={m.banned} className="h-8 w-8">
                            <Pencil className="size-4" />
                          </Button>
                          {m.banned ? (
                            <Button variant="ghost" size="icon" onClick={() => setBanTarget({ member: m, action: 'unban' })} className="h-8 w-8">
                              <Undo2 className="size-4 text-primary" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" onClick={() => setBanTarget({ member: m, action: 'ban' })} className="h-8 w-8">
                              <Ban className="size-4 text-destructive" />
                            </Button>
                          )}
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
          const payload = { 
            name: values.name, 
            phone: values.phone || undefined, 
            joinDate: values.joinDate,
            createAppUser: values.createAppUser,
            username: values.username,
            password: values.password
          }
          if (existing) await update.mutateAsync({ id: existing.id, data: payload })
          else await create.mutateAsync(payload)
          setDialog({ open: false, edit: null })
        }}
      />

      <ConfirmDialog
        open={banTarget !== null}
        onOpenChange={(v) => !v && setBanTarget(null)}
        title={banTarget?.action === 'ban' ? 'Ban member' : 'Unban member'}
        description={
          banTarget?.action === 'ban'
            ? `"${banTarget.member.name}" will be banned. They will be deactivated and unable to generate meals, but their past records will be preserved.`
            : `"${banTarget?.member.name}" will be unbanned and can be reactivated.`
        }
        submitting={update.isPending}
        onConfirm={async () => {
          if (!banTarget) return
          await update.mutateAsync({ 
            id: banTarget.member.id, 
            data: { 
              name: banTarget.member.name, 
              joinDate: banTarget.member.joinDate,
              banned: banTarget.action === 'ban', 
              active: banTarget.action === 'ban' ? false : banTarget.member.active 
            } 
          })
          setBanTarget(null)
        }}
      />
    </div>
  )
}