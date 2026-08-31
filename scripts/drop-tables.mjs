import { loadEnv } from 'vite'
import pg from 'pg'

const env = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '')
const { DATABASE_URL } = env

if (!DATABASE_URL) {
  console.error('[drop-tables] DATABASE_URL is not set')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: DATABASE_URL })

async function dropTables() {
  try {
    console.log('[drop-tables] Dropping all tables...')
    await pool.query(`
      DROP TABLE IF EXISTS rent CASCADE;
      DROP TABLE IF EXISTS deposit CASCADE;
      DROP TABLE IF EXISTS expense CASCADE;
      DROP TABLE IF EXISTS bazar CASCADE;
      DROP TABLE IF EXISTS meal CASCADE;
      DROP TABLE IF EXISTS mess_month CASCADE;
      DROP TABLE IF EXISTS member CASCADE;
      DROP TABLE IF EXISTS app_user CASCADE;
      DROP TABLE IF EXISTS session CASCADE;
    `)
    console.log('[drop-tables] All tables dropped.')
  } catch (err) {
    console.error('[drop-tables] Error:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

dropTables()
