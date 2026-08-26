import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '../db'
import { users, members } from '../db/schema'

const JWT_SECRET = process.env.JWT_SECRET || 'mess_management_dev_secret'

export interface AuthUser {
  id: number
  username: string
  role: 'ADMIN' | 'MEMBER'
  memberId: number | null
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser
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

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, memberId } satisfies AuthUser,
      JWT_SECRET,
      { expiresIn: '7d' },
    )

    return {
      token,
      user: { id: user.id, username: user.username, role: user.role as 'ADMIN' | 'MEMBER', memberId },
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
