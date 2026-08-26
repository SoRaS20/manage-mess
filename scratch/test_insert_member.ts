process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_eU2pMogcKxL5@ep-proud-grass-azbeuo5x-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'

async function run() {
  const { db } = await import('../src/db/index.ts')
  const { members, users } = await import('../src/db/schema.ts')
  const { sql } = await import('drizzle-orm')
  const bcrypt = (await import('bcryptjs')).default

  try {
    console.log('Fixing version column defaults across all tables...')
    const tables = ['app_user', 'member', 'mess_month', 'meal', 'bazar', 'expense', 'deposit', 'rent']
    for (const table of tables) {
      await db.execute(sql.raw(`ALTER TABLE "${table}" ALTER COLUMN version SET DEFAULT 1;`))
      await db.execute(sql.raw(`UPDATE "${table}" SET version = 1 WHERE version IS NULL;`))
    }
    console.log('Version column defaults set!')

    console.log('Testing member insert...')
    const cleanUsername = 'sohan_test'
    const hash = await bcrypt.hash('123456', 10)

    const [createdUser] = await db.insert(users).values({ username: cleanUsername, password: hash, role: 'MEMBER' }).returning()
    console.log('User created:', createdUser)

    const [member] = await db.insert(members).values({
      name: 'Sohan Test',
      phone: '01879957329',
      joinDate: '2026-09-01',
      userId: createdUser.id,
    }).returning()
    console.log('Member created successfully:', member)
  } catch (err) {
    console.error('ERROR:', err)
  } finally {
    process.exit(0)
  }
}

run()
