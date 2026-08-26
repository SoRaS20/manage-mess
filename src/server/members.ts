import { createServerFn } from '@tanstack/react-start'
import { eq, asc } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '../db'
import { members, users } from '../db/schema'

export const listMembers = createServerFn({ method: 'GET' as const })
  .validator(() => ({}))
  .handler(async () => {
    return db.query.members.findMany({
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
    }) => data,
  )
  .handler(async ({ data }) => {
    let userId: number | undefined

    if (data.createAppUser && data.username && data.password) {
      if (data.username.length < 3) throw new Error('Username must be at least 3 characters')
      if (data.password.length < 6) throw new Error('Password must be at least 6 characters')

      const existing = await db.select().from(users).where(eq(users.username, data.username)).limit(1)
      if (existing.length > 0) throw new Error('Username already taken')

      const hash = await bcrypt.hash(data.password, 10)
      const [createdUser] = await db.insert(users).values({ username: data.username, password: hash, role: 'MEMBER' }).returning()
      userId = createdUser.id
    }

    const [member] = await db
      .insert(members)
      .values({
        name: data.name,
        phone: data.phone || null,
        joinDate: data.joinDate,
        userId: userId ?? null,
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
    }) => data,
  )
  .handler(async ({ data }) => {
    const { id, ...fields } = data
    const [updated] = await db.update(members).set(fields).where(eq(members.id, id)).returning()
    if (!updated) throw new Error('Member not found')
    return updated
  })

export const toggleMemberActive = createServerFn({ method: 'POST' as const })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const [member] = await db.select().from(members).where(eq(members.id, data.id)).limit(1)
    if (!member) throw new Error('Member not found')
    const [updated] = await db.update(members).set({ active: !member.active }).where(eq(members.id, data.id)).returning()
    return updated
  })

export const deleteMember = createServerFn({ method: 'POST' as const })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await db.delete(members).where(eq(members.id, data.id))
    return { success: true }
  })
