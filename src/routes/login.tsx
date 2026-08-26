import { createFileRoute, redirect, useLocation, useNavigate } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { useState } from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { ShieldUser, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { loginServerFn } from '@/server/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/form-dialog'
import { Separator } from '@/components/ui/separator'

const loginSearchSchema = z.object({
  redirect: z.string().catch('/'),
})

export const Route = createFileRoute('/login')({
  validateSearch: zodValidator(loginSearchSchema),
  beforeLoad: () => {
    if (typeof window !== 'undefined') {
      const { token } = useAuthStore.getState()
      if (token || document.cookie.includes('mess_auth_token=')) {
        throw redirect({ to: '/' })
      }
    }
  },
  component: LoginPage,
})

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const searchRedirect = (location.search as { redirect?: string })?.redirect
  const setAuth = useAuthStore((s) => s.setAuth)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  })

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    setError('')
    setLoading(true)
    try {
      const res = await loginServerFn({ data: values })
      setAuth(res.token, res.user)
      const targetPath = !searchRedirect || searchRedirect === '/login' ? '/' : searchRedirect
      navigate({ to: targetPath as any })
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-svh w-full max-w-xl mx-auto items-center justify-center p-6 md:p-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ShieldUser className="size-4" />
            </div>
            Login
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="w-full min-w-xs md:min-w-sm space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>
            )}

            <Field label="Username" error={form.formState.errors.username?.message}>
              <Input {...form.register('username')} placeholder="admin" disabled={loading} />
            </Field>

            <Field label="Password" error={form.formState.errors.password?.message}>
              <Input type="password" {...form.register('password')} placeholder="••••••••" disabled={loading} />
            </Field>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
