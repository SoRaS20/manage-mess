import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { User, Shield, Utensils, Coins, Receipt, TrendingUp, TrendingDown, Monitor, Smartphone, Globe, Trash2, Key, LogOut, Loader2 } from 'lucide-react'
import { useMonths, useMonthlyReport, useMembers } from '@/api/hooks'
import { useAuthStore } from '@/store/auth'
import { changePasswordServerFn, listSessionsServerFn, revokeSessionServerFn, revokeOtherSessionsServerFn } from '@/server/auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Field, FormDialog } from '@/components/form-dialog'
import { StatCard } from '@/components/stat-card'
import { monthLabel, formatTaka, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
})

type Session = {
  id: number
  token: string
  expiresAt: string
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  lastActiveAt: string
  isCurrent: boolean
}

function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const { data: months, isLoading: monthsLoading } = useMonths()
  const { data: members } = useMembers()
  const logout = useAuthStore((s) => s.logout)

  const member = members?.find((m) => m.id === user?.memberId)

  if (monthsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">Your account information and monthly summaries.</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Account Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
              {user?.username?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">{user?.username}</span>
                <Badge variant={user?.role === 'ADMIN' ? 'default' : 'secondary'}>
                  <Shield className="mr-1 size-3" />
                  {user?.role}
                </Badge>
              </div>
              {member && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="size-3.5" />
                  <span>Member: <span className="font-medium text-foreground">{member.name}</span></span>
                  {member.phone && <span>· {member.phone}</span>}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChangePasswordCard />
        <SessionsCard />
      </div>

      <MyMonthReports />
    </div>
  )
}

function ChangePasswordCard() {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const logout = useAuthStore((s) => s.logout)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setError('')
    if (!token) return
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      await changePasswordServerFn({ data: { currentPassword, newPassword, token } })
      toast.success('Password changed. Other sessions have been revoked.')
      setOpen(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to change password'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Key className="size-4" />
          Change Password
        </CardTitle>
        <CardDescription>Update your password. Other sessions will be revoked.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Key className="mr-2 size-4" />
          Change Password
        </Button>

        <FormDialog
          open={open}
          onOpenChange={setOpen}
          title="Change Password"
          submitLabel="Update Password"
          submitting={loading}
          onSubmit={handleSubmit}
        >
          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
          )}
          <Field label="Current Password">
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" />
          </Field>
          <Field label="New Password">
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
          </Field>
          <Field label="Confirm New Password">
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
          </Field>
        </FormDialog>
      </CardContent>
    </Card>
  )
}

function SessionsCard() {
  const token = useAuthStore((s) => s.token)
  const logout = useAuthStore((s) => s.logout)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [revokeTarget, setRevokeTarget] = useState<{ id: number; label: string } | null>(null)
  const [revokeAllTarget, setRevokeAllTarget] = useState(false)

  const fetchSessions = async () => {
    if (!token) return
    setLoading(true)
    try {
      const data = await listSessionsServerFn({ data: { token } })
      setSessions(data as Session[])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useState(() => {
    fetchSessions()
  })

  const handleRevoke = async (sessionId: number) => {
    if (!token) return
    try {
      await revokeSessionServerFn({ data: { token, sessionId } })
      toast.success('Session revoked')
      await fetchSessions()
    } catch {
      toast.error('Failed to revoke session')
    }
    setRevokeTarget(null)
  }

  const handleRevokeAll = async () => {
    if (!token) return
    try {
      await revokeOtherSessionsServerFn({ data: { token } })
      toast.success('Other sessions revoked')
      await fetchSessions()
    } catch {
      toast.error('Failed to revoke sessions')
    }
    setRevokeAllTarget(false)
  }

  const getDeviceIcon = (userAgent: string | null) => {
    if (!userAgent) return <Globe className="size-4" />
    if (/mobile|android|iphone/i.test(userAgent)) return <Smartphone className="size-4" />
    return <Monitor className="size-4" />
  }

  const formatUserAgent = (ua: string | null) => {
    if (!ua) return 'Unknown device'
    if (/mobile|android/i.test(ua)) return 'Mobile device'
    if (/chrome/i.test(ua)) return 'Chrome'
    if (/firefox/i.test(ua)) return 'Firefox'
    if (/safari/i.test(ua)) return 'Safari'
    return 'Browser'
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Monitor className="size-4" />
              Active Sessions
            </CardTitle>
            <CardDescription>Manage your active login sessions.</CardDescription>
          </div>
          {sessions.length > 1 && (
            <Button variant="outline" size="sm" onClick={() => setRevokeAllTarget(true)}>
              <LogOut className="mr-1 size-3" />
              Revoke others
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No active sessions.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={cn(
                  'flex items-center justify-between rounded-lg border p-3 transition-colors',
                  s.isCurrent ? 'border-primary/30 bg-primary/5' : 'hover:bg-muted/50'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', s.isCurrent ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                    {getDeviceIcon(s.userAgent)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{formatUserAgent(s.userAgent)}</span>
                      {s.isCurrent && <Badge variant="default" className="text-[10px]">Current</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(s.createdAt)} · Last active {formatDate(s.lastActiveAt)}
                    </div>
                  </div>
                </div>
                {!s.isCurrent && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:bg-destructive/10"
                    onClick={() => setRevokeTarget({ id: s.id, label: formatUserAgent(s.userAgent) })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(v) => !v && setRevokeTarget(null)}
        title="Revoke session"
        description={`Revoke the ${revokeTarget?.label ?? 'selected'} session?`}
        confirmLabel="Revoke"
        onConfirm={() => revokeTarget && handleRevoke(revokeTarget.id)}
      />

      <ConfirmDialog
        open={revokeAllTarget}
        onOpenChange={setRevokeAllTarget}
        title="Revoke other sessions"
        description="This will sign you out from all other devices. Your current session will remain active."
        confirmLabel="Revoke all others"
        onConfirm={handleRevokeAll}
      />
    </Card>
  )
}

function MyMonthReports() {
  const user = useAuthStore((s) => s.user)
  const { data: months, isLoading: monthsLoading } = useMonths()

  const sorted = [...(months ?? [])].sort((a, b) => b.year - a.year || b.monthNo - a.monthNo)

  if (monthsLoading) {
    return <Skeleton className="h-64 w-full" />
  }

  if (!sorted.length) {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No months found yet.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Monthly Reports</h2>
      <div className="space-y-3">
        {sorted.map((m) => (
          <MonthRow key={m.id} monthId={m.id} year={m.year} monthNo={m.monthNo} memberId={user?.memberId ?? null} />
        ))}
      </div>
    </div>
  )
}

function MonthRow({ monthId, year, monthNo, memberId }: { monthId: number; year: number; monthNo: number; memberId: number | null }) {
  const { data: report, isLoading } = useMonthlyReport(monthId)

  if (isLoading) {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-4">
          <Skeleton className="h-8 w-48" />
        </CardContent>
      </Card>
    )
  }

  if (!report || !memberId) return null

  const me = report.members.find((m) => m.memberId === memberId)
  if (!me) return null

  return (
    <Card className="shadow-sm">
      <CardContent className="py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
              {monthNo}
            </div>
            <div>
              <div className="font-medium">{monthLabel(year, monthNo)}</div>
              <div className="text-xs text-muted-foreground">{formatNumber(me.meals)} meals · rate {formatTaka(me.mealRate)}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Utensils className="size-3.5 text-muted-foreground" />
              <span className="tabular-nums">{formatNumber(me.meals)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Receipt className="size-3.5 text-muted-foreground" />
              <span className="tabular-nums">{formatTaka(me.mealCost)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Coins className="size-3.5 text-emerald-500" />
              <span className="tabular-nums">{formatTaka(me.deposit)}</span>
            </div>
            <div className={cn('flex items-center gap-1.5 font-semibold', me.balance >= 0 ? 'text-emerald-600' : 'text-destructive')}>
              {me.balance >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
              <span className="tabular-nums">{formatTaka(me.balance)}</span>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
          <div>Meal cost: <span className="tabular-nums text-foreground">{formatTaka(me.mealCost)}</span></div>
          <div>Exp share: <span className="tabular-nums text-foreground">{formatTaka(me.expenseShare)}</span></div>
          <div>Bazar contrib: <span className="tabular-nums text-blue-600">{formatTaka(me.bazarContribution)}</span></div>
          <div>Exp contrib: <span className="tabular-nums text-blue-600">{formatTaka(me.expenseContribution)}</span></div>
          <div>Food balance: <span className={cn('tabular-nums font-medium', me.foodBalance >= 0 ? 'text-emerald-600' : 'text-destructive')}>{formatTaka(me.foodBalance)}</span></div>
          <div>Rent: <span className="tabular-nums text-foreground">{formatTaka(me.rent)}</span></div>
          <div>Deposit: <span className="tabular-nums text-purple-600">{formatTaka(me.deposit)}</span></div>
          <div>Rent balance: <span className={cn('tabular-nums font-medium', me.rentBalance >= 0 ? 'text-emerald-600' : 'text-destructive')}>{formatTaka(me.rentBalance)}</span></div>
        </div>
      </CardContent>
    </Card>
  )
}
