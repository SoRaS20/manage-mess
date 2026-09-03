import { loadEnv } from 'vite'
import pg from 'pg'

const env = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '')
const { DATABASE_URL } = env

if (!DATABASE_URL) {
  console.error('[migrate] DATABASE_URL is not set')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: DATABASE_URL })

async function migrate() {
  console.log('[migrate] Converting unique indexes to partial (WHERE deleted_at IS NULL)...')
  console.log('[migrate] This allows soft-deleted rows to be re-created without unique violation.')
  const statements = [
    // Meals - drop old full unique indexes (including legacy Hibernate constraints)
    `DROP INDEX IF EXISTS meal_member_date_idx;`,
    `ALTER TABLE meal DROP CONSTRAINT IF EXISTS uk932d7ed908b45973861eab01609e;`,
    `DROP INDEX IF EXISTS uk932d7ed908b45973861eab01609e;`,
    `CREATE UNIQUE INDEX meal_member_date_idx ON meal (member_id, record_date) WHERE deleted_at IS NULL;`,

    // Rents
    `DROP INDEX IF EXISTS rent_member_month_idx;`,
    `ALTER TABLE rent DROP CONSTRAINT IF EXISTS uk28017acf72613de9b976833d75df;`,
    `DROP INDEX IF EXISTS uk28017acf72613de9b976833d75df;`,
    `CREATE UNIQUE INDEX rent_member_month_idx ON rent (member_id, month_id) WHERE deleted_at IS NULL;`,

    // Previous Balances (no duplicate uk* found, but drop safely)
    `DROP INDEX IF EXISTS previous_balance_member_month_idx;`,
    `CREATE UNIQUE INDEX previous_balance_member_month_idx ON previous_balance (member_id, month_id) WHERE deleted_at IS NULL;`,

    // Months
    `DROP INDEX IF EXISTS mess_month_year_month_no_idx;`,
    `ALTER TABLE mess_month DROP CONSTRAINT IF EXISTS uk52691e142bc101bca2cccd8c22fe;`,
    `DROP INDEX IF EXISTS uk52691e142bc101bca2cccd8c22fe;`,
    `CREATE UNIQUE INDEX mess_month_year_month_no_idx ON mess_month (year, month_no) WHERE deleted_at IS NULL;`,
  ]

  for (const sql of statements) {
    console.log(`> ${sql}`)
    try {
      await pool.query(sql)
      console.log('  ✓ ok')
    } catch (e) {
      console.error('  ✗ failed:', e.message)
      // Continue to next, but log
    }
  }

  console.log('\n[migrate] Done. Current indexes:')
  for (const t of ['meal','rent','previous_balance','mess_month']) {
    const res = await pool.query(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename='${t}' ORDER BY indexname`)
    console.log(`\n ${t}:`)
    res.rows.forEach(r => console.log(`  ${r.indexname}: ${r.indexdef}`))
  }

  await pool.end()
}

migrate().catch(e => { console.error(e); process.exit(1) })
