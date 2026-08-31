import { createServerFn } from '@tanstack/react-start'
import { eq, asc, sql, isNull } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '../db'
import { members, users } from '../db/schema'

export const listMembers = createServerFn({ method: 'GET' as const })
  .validator(() => ({}))
  .handler(async () => {
    return db.query.members.findMany({
      where: isNull(members.deletedAt),
      orderBy: [asc(members.name)],
      with: { user: { columns: { id: true, username: true, role: true } } },
    })
  })

export const createMember = createServerFn({ method: 'POST' as const })
  .validator(
    (data: {
      name: string
      phone?: string
      joinDate: string
      createAppUser?: boolean
      username?: string
      password?: string
      userId?: number
    }) => data,
  )
  .handler(async ({ data }) => {
    let userId: number | undefined

    if (data.createAppUser && data.username && data.password) {
      const cleanUsername = data.username.trim()
      if (cleanUsername.length < 3) throw new Error('Username must be at least 3 characters')
      if (data.password.length < 6) throw new Error('Password must be at least 6 characters')

      const existing = await db
        .select()
        .from(users)
        .where(sql`LOWER(${users.username}) = LOWER(${cleanUsername})`)
        .limit(1)
      if (existing.length > 0) throw new Error(`Username "${cleanUsername}" is already taken`)

      const hash = await bcrypt.hash(data.password, 10)
      try {
        const [createdUser] = await db
          .insert(users)
          .values({ username: cleanUsername, password: hash, role: 'MEMBER', createdBy: data.userId ?? null })
          .returning()
        userId = createdUser.id
      } catch (err: any) {
        if (err?.code === '23505' || err?.message?.includes('unique') || err?.message?.includes('duplicate')) {
          throw new Error(`Username "${cleanUsername}" is already taken`)
        }
        throw new Error(err?.message || 'Failed to create user login')
      }
    }

    const [member] = await db
      .insert(members)
      .values({
        name: data.name.trim(),
        phone: data.phone?.trim() || null,
        joinDate: data.joinDate,
        userId: userId ?? null,
        createdBy: data.userId ?? null,
      })
      .returning()

    return member
  })

export const updateMember = createServerFn({ method: 'POST' as const })
  .validator(
    (data: {
      id: number
      name?: string
      phone?: string
      joinDate?: string
      active?: boolean
      banned?: boolean
      createAppUser?: boolean
      username?: string
      password?: string
      userId?: number
    }) => data,
  )
  .handler(async ({ data }) => {
    const { id, createAppUser, username, password, userId, ...fields } = data

    if (createAppUser && username && password) {
      const cleanUsername = username.trim()
      if (cleanUsername.length < 3) throw new Error('Username must be at least 3 characters')
      if (password.length < 6) throw new Error('Password must be at least 6 characters')

      const existing = await db
        .select()
        .from(users)
        .where(sql`LOWER(${users.username}) = LOWER(${cleanUsername})`)
        .limit(1)
      if (existing.length > 0) throw new Error(`Username "${cleanUsername}" is already taken`)

      const hash = await bcrypt.hash(password, 10)
      try {
        const [createdUser] = await db
          .insert(users)
          .values({ username: cleanUsername, password: hash, role: 'MEMBER', createdBy: userId ?? null })
          .returning()
        ;(fields as any).userId = createdUser.id
      } catch (err: any) {
        if (err?.code === '23505' || err?.message?.includes('unique') || err?.message?.includes('duplicate')) {
          throw new Error(`Username "${cleanUsername}" is already taken`)
        }
        throw new Error(err?.message || 'Failed to create user login')
      }
    }

    const [updated] = await db.update(members).set({ ...fields, updatedBy: userId ?? null }).where(eq(members.id, id)).returning()
    if (!updated) throw new Error('Member not found')
    return updated
  })

export const toggleMemberActive = createServerFn({ method: 'POST' as const })
  .validator((data: { id: number; userId?: number }) => data)
  .handler(async ({ data }) => {
    const [member] = await db.select().from(members).where(eq(members.id, data.id)).limit(1)
    if (!member) throw new Error('Member not found')
    const [updated] = await db.update(members).set({ active: !member.active, updatedBy: data.userId ?? null }).where(eq(members.id, data.id)).returning()
    return updated
  })

export const deleteMember = createServerFn({ method: 'POST' as const })
  .validator((data: { id: number; userId?: number }) => data)
  .handler(async ({ data }) => {
    await db.update(members).set({ deletedAt: new Date(), deletedBy: data.userId ?? null }).where(eq(members.id, data.id))
    return { success: true }
  })
