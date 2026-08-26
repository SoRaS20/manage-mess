import { loadEnv } from 'vite'
import pg from 'pg'
import bcrypt from 'bcryptjs'

const env = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '')
const { DATABASE_URL, SEED_ADMIN_USERNAME = 'admin', SEED_ADMIN_PASSWORD = 'admin123' } = env

if (!DATABASE_URL) {
  console.error('[reset-db] DATABASE_URL is not set')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: DATABASE_URL })

async function resetDb() {
  try {
    console.log('[reset-db] Truncating all database tables...')
    await pool.query(
      `TRUNCATE TABLE rent, deposit, expense, bazar, meal, mess_month, member, app_user RESTART IDENTITY CASCADE;`
    )
    console.log('[reset-db] Tables truncated.')

    console.log(`[reset-db] Creating fresh admin user: "${SEED_ADMIN_USERNAME}"...`)
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
    await pool.query(
      `INSERT INTO app_user (${columns.join(', ')})
       VALUES (${placeholders})
       ON CONFLICT (username)
       DO UPDATE SET user_password = EXCLUDED.user_password, role = 'ADMIN'`,
      values,
    )

    console.log(`[reset-db] Fresh database initialized with admin user "${SEED_ADMIN_USERNAME}"!`)
  } catch (err) {
    console.error('[reset-db] Error resetting database:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

resetDb()
