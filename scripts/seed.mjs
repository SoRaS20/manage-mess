import { loadEnv } from 'vite'
import pg from 'pg'
import bcrypt from 'bcryptjs'

const env = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '')
const { DATABASE_URL } = env

if (!DATABASE_URL) {
  console.error('[seed] DATABASE_URL is not set')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: DATABASE_URL })

async function seed() {
  try {
    // ── 1. Drop everything ──────────────────────────────
    console.log('[seed] Dropping all data...')
    await pool.query(
      `TRUNCATE TABLE rent, deposit, expense, bazar, meal, mess_month, member, app_user RESTART IDENTITY CASCADE;`
    )

    // ── 2. Push schema (creates tables with new columns) ──
    console.log('[seed] Schema is managed by drizzle-kit push — run that first if needed.')

    // ── 3. Create users ────────────────────────────────
    const hash = await bcrypt.hash('pass123', 10)

    const usersData = [
      { username: 'admin1', password: hash, role: 'ADMIN' },
      { username: 'admin2', password: hash, role: 'ADMIN' },
      { username: 'sohan', password: hash, role: 'MEMBER' },
      { username: 'arifvai', password: hash, role: 'MEMBER' },
      { username: 'arif', password: hash, role: 'MEMBER' },
      { username: 'tanim', password: hash, role: 'MEMBER' },
      { username: 'salman', password: hash, role: 'MEMBER' },
      { username: 'neshat', password: hash, role: 'MEMBER' },
    ]

    const userIds = {}
    for (const u of usersData) {
      const res = await pool.query(
        `INSERT INTO app_user (username, user_password, role, created_at, created_by) VALUES ($1, $2, $3, NOW(), NULL) RETURNING id`,
        [u.username, u.password, u.role],
      )
      userIds[u.username] = res.rows[0].id
    }
    console.log(`[seed] Created ${usersData.length} users`)

    // ── 4. Create members ──────────────────────────────
    const membersData = [
      { name: 'Sohan', phone: '01710000001', joinDate: '2026-01-01', userId: userIds.sohan },
      { name: 'Arif Vai', phone: '01710000002', joinDate: '2026-01-01', userId: userIds.arifvai },
      { name: 'Arif', phone: '01710000003', joinDate: '2026-01-01', userId: userIds.arif },
      { name: 'Tanim', phone: '01710000004', joinDate: '2026-01-01', userId: userIds.tanim },
      { name: 'Salman', phone: '01710000005', joinDate: '2026-01-01', userId: userIds.salman },
      { name: 'Neshat', phone: '01710000006', joinDate: '2026-01-01', userId: userIds.neshat },
    ]

    const memberIds = {}
    for (const m of membersData) {
      const res = await pool.query(
        `INSERT INTO member (name, phone, join_date, active, banned, user_id, created_at, created_by) VALUES ($1, $2, $3, true, false, $4, NOW(), NULL) RETURNING id, name`,
        [m.name, m.phone, m.joinDate, m.userId],
      )
      memberIds[m.name] = res.rows[0].id
    }
    console.log(`[seed] Created ${membersData.length} members`)

    // ── 5. Create current month with manager ───────────
    const now = new Date()
    const year = now.getFullYear()
    const monthNo = now.getMonth() + 1
    const managerName = 'Sohan'
    const managerId = memberIds[managerName]

    const monthRes = await pool.query(
      `INSERT INTO mess_month (year, month_no, closed, manager_id, created_at, created_by) VALUES ($1, $2, false, $3, NOW(), NULL) RETURNING id`,
      [year, monthNo, managerId],
    )
    const monthId = monthRes.rows[0].id
    console.log(`[seed] Created month ${year}-${String(monthNo).padStart(2, '0')} with manager "${managerName}"`)

    // ── 6. Summary ─────────────────────────────────────
    console.log('\n═══════════════════════════════════════════')
    console.log('  SEED COMPLETE')
    console.log('═══════════════════════════════════════════')
    console.log(`  Users:   ${usersData.length} (2 admins + 6 members)`)
    console.log(`  Members: ${membersData.length}`)
    console.log(`  Month:   ${year}-${String(monthNo).padStart(2, '0')}`)
    console.log('───────────────────────────────────────────')
    console.log('  Login credentials:')
    console.log('  Admins:   admin1 / admin2')
    console.log('  Members:  sohan / arifvai / arif / tanim / salman / neshat')
    console.log('  Password: pass123')
    console.log('  Manager:  Sohan')
    console.log('═══════════════════════════════════════════\n')
  } catch (err) {
    console.error('[seed] Error:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

seed()
