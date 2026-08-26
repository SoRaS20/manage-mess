import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AuthUser {
  id: number
  username: string
  role: 'ADMIN' | 'MEMBER'
  memberId: number | null
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  setAuth: (token: string, user: AuthUser) => void
  logout: () => void
}

export function setAuthCookies(token: string | null, user: AuthUser | null) {
  if (typeof document === 'undefined') return
  if (token && user) {
    const maxAge = 30 * 24 * 60 * 60 // 30 days in seconds
    document.cookie = `mess_auth_token=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax`
    document.cookie = `mess_auth_user=${encodeURIComponent(JSON.stringify(user))}; path=/; max-age=${maxAge}; SameSite=Lax`
  } else {
    document.cookie = `mess_auth_token=; path=/; max-age=0; SameSite=Lax`
    document.cookie = `mess_auth_user=; path=/; max-age=0; SameSite=Lax`
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => {
        setAuthCookies(token, user)
        set({ token, user })
      },
      logout: () => {
        setAuthCookies(null, null)
        set({ token: null, user: null })
      },
    }),
    {
      name: 'mess-auth-storage',
      onRehydrateStorage: () => (state) => {
        if (state?.token && state?.user) {
          setAuthCookies(state.token, state.user)
        }
      },
    }
  )
)
