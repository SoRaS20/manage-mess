import { useAuthStore } from '@/store/auth'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type RequestOptions = RequestInit & { params?: Record<string, string | number | undefined> }

async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
  const { params, headers, ...rest } = init
  let url = `${API_BASE}${path}`
  if (params) {
    const qs = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') qs.set(key, String(value))
    }
    const query = qs.toString()
    if (query) url += `?${query}`
  }

  const state = useAuthStore.getState()
  const authHeaders: Record<string, string> = {}
  if (state.token) {
    authHeaders['Authorization'] = `Bearer ${state.token}`
  }

  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...authHeaders, ...headers },
    ...rest,
  })

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`
    try {
      const body = await res.json()
      if (body && typeof body.message === 'string') message = body.message
    } catch {
      // non-JSON error body, keep default message
    }
    if (res.status === 401) {
      useAuthStore.getState().logout()
    }
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string, params?: RequestOptions['params']) =>
    request<T>(path, { params }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),
  del: <T = void>(path: string) => request<T>(path, { method: 'DELETE' }),
}