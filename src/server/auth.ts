import { createServerFn } from '@tanstack/react-start'
import { eq, and, gt, lt, desc, ne, isNull } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '../db'
import { users, members, sessions } from '../db/schema'

const JWT_SECRET = process.env.JWT_SECRET || 'mess_management_dev_secret'
const SESSION_EXPIRY_DAYS = 7
const SESSION_UPDATE_AGE_DAYS = 1

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
  const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 // 30 days
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

    const [user] = await db.select().from(users).where(and(eq(users.username, data.username), isNull(users.deletedAt))).limit(1)
    if (!user) throw new Error('Invalid credentials')

    const valid = await bcrypt.compare(data.password, user.password)
    if (!valid) throw new Error('Invalid credentials')

    const [member] = await db
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.userId, user.id), isNull(members.deletedAt)))
      .limit(1)

    const memberId = member?.id ?? null

    const userPayload: AuthUser = { id: user.id, username: user.username, role: user.role as 'ADMIN' | 'MEMBER', memberId }
    const token = await createJwtToken(userPayload)

    // Create session record
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS)

    await db.insert(sessions).values({
      token,
      userId: user.id,
      expiresAt,
      createdAt: new Date(),
      lastActiveAt: new Date(),
    })

    return {
      token,
      user: userPayload,
    }
  })

export const changePasswordServerFn = createServerFn({ method: 'POST' as const })
  .validator((data: { currentPassword: string; newPassword: string; token: string }) => data)
  .handler(async ({ data }) => {
    const authUser = await verifyToken(data.token)
    if (!authUser) throw new Error('Not authenticated')

    const [user] = await db.select().from(users).where(eq(users.id, authUser.id)).limit(1)
    if (!user) throw new Error('User not found')

    const valid = await bcrypt.compare(data.currentPassword, user.password)
    if (!valid) throw new Error('Current password is incorrect')

    const hash = await bcrypt.hash(data.newPassword, 10)
    await db.update(users).set({ password: hash, updatedBy: authUser.id }).where(eq(users.id, authUser.id))

    // Revoke all other sessions (keep current one)
    const currentSession = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.token, data.token))
      .limit(1)

    if (currentSession[0]) {
      await db
        .delete(sessions)
        .where(
          and(
            eq(sessions.userId, authUser.id),
            ne(sessions.id, currentSession[0].id)
          )
        )
    }

    return { message: 'Password changed successfully' }
  })

export const listSessionsServerFn = createServerFn({ method: 'GET' as const })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const authUser = await verifyToken(data.token)
    if (!authUser) throw new Error('Not authenticated')

    const now = new Date()
    const userSessions = await db
      .select({
        id: sessions.id,
        token: sessions.token,
        expiresAt: sessions.expiresAt,
        ipAddress: sessions.ipAddress,
        userAgent: sessions.userAgent,
        createdAt: sessions.createdAt,
        lastActiveAt: sessions.lastActiveAt,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, authUser.id),
          gt(sessions.expiresAt, now)
        )
      )
      .orderBy(desc(sessions.lastActiveAt))

    return userSessions.map((s) => ({
      ...s,
      isCurrent: s.token === data.token,
      expiresAt: s.expiresAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
      lastActiveAt: s.lastActiveAt.toISOString(),
    }))
  })

export const revokeSessionServerFn = createServerFn({ method: 'POST' as const })
  .validator((data: { token: string; sessionId: number }) => data)
  .handler(async ({ data }) => {
    const authUser = await verifyToken(data.token)
    if (!authUser) throw new Error('Not authenticated')

    await db
      .delete(sessions)
      .where(
        and(
          eq(sessions.id, data.sessionId),
          eq(sessions.userId, authUser.id)
        )
      )

    return { message: 'Session revoked' }
  })

export const revokeOtherSessionsServerFn = createServerFn({ method: 'POST' as const })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const authUser = await verifyToken(data.token)
    if (!authUser) throw new Error('Not authenticated')

    await db
      .delete(sessions)
      .where(
        and(
          eq(sessions.userId, authUser.id),
          ne(sessions.token, data.token)
        )
      )

    return { message: 'Other sessions revoked' }
  })

export const cleanupExpiredSessionsFn = createServerFn({ method: 'POST' as const })
  .handler(async () => {
    const now = new Date()
    await db.delete(sessions).where(lt(sessions.expiresAt, now))
    return { message: 'Expired sessions cleaned up' }
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
