import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '../db'
import { users, members } from '../db/schema'

const JWT_SECRET = process.env.JWT_SECRET || 'mess_management_dev_secret'

export interface AuthUser {
  id: number
  username: string
  role: 'ADMIN' | 'MEMBER'
  memberId: number | null
}

function base64urlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i])
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlDecode(str: string): string {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4 !== 0) b64 += '='
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes)
}

export async function createJwtToken(payload: AuthUser): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const encodedHeader = base64urlEncode(JSON.stringify(header))
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
  const encodedPayload = base64urlEncode(JSON.stringify({ ...payload, exp }))
  const dataToSign = `${encodedHeader}.${encodedPayload}`

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(dataToSign))
  let bin = ''
  const sigBytes = new Uint8Array(signature)
  for (let i = 0; i < sigBytes.length; i++) {
    bin += String.fromCharCode(sigBytes[i])
  }
  const encodedSignature = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${dataToSign}.${encodedSignature}`
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [encodedHeader, encodedPayload, signature] = parts
    const dataToSign = `${encodedHeader}.${encodedPayload}`

    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    let b64 = signature.replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4 !== 0) b64 += '='
    const sigBin = atob(b64)
    const sigBytes = new Uint8Array(sigBin.length)
    for (let i = 0; i < sigBin.length; i++) {
      sigBytes[i] = sigBin.charCodeAt(i)
    }

    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(dataToSign))
    if (!valid) return null

    const payload = JSON.parse(base64urlDecode(encodedPayload))
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null
    return { id: payload.id, username: payload.username, role: payload.role, memberId: payload.memberId }
  } catch {
    return null
  }
}

export const loginServerFn = createServerFn({ method: 'POST' as const })
  .validator((data: { username: string; password: string }) => data)
  .handler(async ({ data }) => {
    if (!data.username || !data.password) {
      throw new Error('Username and password required')
    }

    const [user] = await db.select().from(users).where(eq(users.username, data.username)).limit(1)
    if (!user) throw new Error('Invalid credentials')

    const valid = await bcrypt.compare(data.password, user.password)
    if (!valid) throw new Error('Invalid credentials')

    const [member] = await db
      .select({ id: members.id })
      .from(members)
      .where(eq(members.userId, user.id))
      .limit(1)

    const memberId = member?.id ?? null

    const userPayload: AuthUser = { id: user.id, username: user.username, role: user.role as 'ADMIN' | 'MEMBER', memberId }
    const token = await createJwtToken(userPayload)

    return {
      token,
      user: userPayload,
    }
  })

export const createSeedAdminFn = createServerFn({ method: 'POST' as const })
  .validator((data: { username: string; password: string }) => data)
  .handler(async ({ data }) => {
    const existing = await db.select().from(users).where(eq(users.username, data.username)).limit(1)
    if (existing.length > 0) return { message: 'Admin already exists' }

    const hash = await bcrypt.hash(data.password, 10)
    await db.insert(users).values({ username: data.username, password: hash, role: 'ADMIN' })
    return { message: 'Admin created' }
  })
