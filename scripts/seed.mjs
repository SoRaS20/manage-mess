import { loadEnv } from 'vite'
import pg from 'pg'
import bcrypt from 'bcryptjs'

const env = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '')

const { DATABASE_URL, SEED_ADMIN_USERNAME, SEED_ADMIN_PASSWORD } = env

if (!DATABASE_URL) throw new Error('DATABASE_URL is not set')
if (!SEED_ADMIN_USERNAME || !SEED_ADMIN_PASSWORD) {
  console.log('[seed] SEED_ADMIN_USERNAME/SEED_ADMIN_PASSWORD not set, skipping')
  process.exit(0)
}

const pool = new pg.Pool({ connectionString: DATABASE_URL })

try {
  const hash = await bcrypt.hash(SEED_ADMIN_PASSWORD, 10)

  const cols = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'app_user'`,
  )
  const names = cols.rows.map((r) => r.column_name)
  const columns = ['username', 'user_password', 'role']
  if (names.includes('version')) columns.push('version')
  const values = [SEED_ADMIN_USERNAME, hash, 'ADMIN']
  if (names.includes('version')) values.push(0)

  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ')
  const result = await pool.query(
    `INSERT INTO app_user (${columns.join(', ')})
     VALUES (${placeholders})
     ON CONFLICT (username)
     DO UPDATE SET user_password = EXCLUDED.user_password, role = 'ADMIN'`,
    values,
  )

  const action = result.rowCount > 0 ? 'seeded/updated' : 'unchanged'
  console.log(`[seed] Admin user "${SEED_ADMIN_USERNAME}" ${action}`)
} finally {
  await pool.end()
}
