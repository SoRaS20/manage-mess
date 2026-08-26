import { db } from '../src/db/index.js'
import { members, users } from '../src/db/schema.js'
import { eq, sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

async function run() {
  try {
    console.log('Testing member insert...')
    const cleanUsername = 'sohan'
    const hash = await bcrypt.hash('123456', 10)
    
    // 1. Check existing
    const existing = await db.select().from(users).where(sql`LOWER(${users.username}) = LOWER(${cleanUsername})`).limit(1)
    console.log('Existing users count:', existing.length)

    let userId = null
    if (existing.length === 0) {
      const [createdUser] = await db.insert(users).values({ username: cleanUsername, password: hash, role: 'MEMBER' }).returning()
      console.log('Created user:', createdUser)
      userId = createdUser.id
    } else {
      userId = existing[0].id
    }

    console.log('Inserting member with userId:', userId)
    const [member] = await db.insert(members).values({
      name: 'Sohan',
      phone: '01879957329',
      joinDate: '2026-09-01',
      userId: userId,
    }).returning()
    console.log('Member created successfully:', member)
  } catch (err) {
    console.error('INSERT FAILED ERROR:', err)
  } finally {
    process.exit(0)
  }
}

run()
