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
    // ── Idempotent seed: never deletes existing data ────
    // This script is safe to run via `pnpm dev` — it will only INSERT missing rows
    // using ON CONFLICT DO NOTHING and SELECT checks. Re-running will not modify
    // existing rows (passwords, members, months remain untouched).
    console.log('[seed] Running idempotent seed (no data will be deleted)...')
    console.log('[seed] Schema is managed by drizzle-kit push — run that first if needed.')

    // ── 1. Create users (ON CONFLICT DO NOTHING) ──────
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
    let usersCreated = 0
    let usersSkipped = 0
    for (const u of usersData) {
      // Try to insert, ignore if username already exists
      const res = await pool.query(
        `INSERT INTO app_user (username, user_password, role, created_at, created_by)
         VALUES ($1, $2, $3, NOW(), NULL)
         ON CONFLICT (username) DO NOTHING
         RETURNING id`,
        [u.username, u.password, u.role],
      )
      if (res.rows.length > 0) {
        userIds[u.username] = res.rows[0].id
        usersCreated++
      } else {
        const existing = await pool.query(`SELECT id FROM app_user WHERE username = $1`, [u.username])
        userIds[u.username] = existing.rows[0].id
        usersSkipped++
      }
    }
    console.log(`[seed] Users: ${usersCreated} created, ${usersSkipped} already existed (skipped)`)

    // ── 2. Create members (check by name, then INSERT) ─
    const membersData = [
      { name: 'Sohan', phone: '01710000001', joinDate: '2026-01-01', userId: userIds.sohan },
      { name: 'Arif Vai', phone: '01710000002', joinDate: '2026-01-01', userId: userIds.arifvai },
      { name: 'Arif', phone: '01710000003', joinDate: '2026-01-01', userId: userIds.arif },
      { name: 'Tanim', phone: '01710000004', joinDate: '2026-01-01', userId: userIds.tanim },
      { name: 'Salman', phone: '01710000005', joinDate: '2026-01-01', userId: userIds.salman },
      { name: 'Neshat', phone: '01710000006', joinDate: '2026-01-01', userId: userIds.neshat },
    ]

    const memberIds = {}
    let membersCreated = 0
    let membersSkipped = 0
    for (const m of membersData) {
      const existing = await pool.query(`SELECT id FROM member WHERE name = $1 LIMIT 1`, [m.name])
      if (existing.rows.length > 0) {
        memberIds[m.name] = existing.rows[0].id
        membersSkipped++
        continue
      }
      // Also guard against duplicate phone where unique not enforced but we still avoid duplicates
      const phoneExists = await pool.query(`SELECT id FROM member WHERE phone = $1 LIMIT 1`, [m.phone])
      if (phoneExists.rows.length > 0) {
        memberIds[m.name] = phoneExists.rows[0].id
        membersSkipped++
        continue
      }
      const res = await pool.query(
        `INSERT INTO member (name, phone, join_date, active, banned, user_id, created_at, created_by)
         VALUES ($1, $2, $3, true, false, $4, NOW(), NULL) RETURNING id`,
        [m.name, m.phone, m.joinDate, m.userId],
      )
      memberIds[m.name] = res.rows[0].id
      membersCreated++
    }
    console.log(`[seed] Members: ${membersCreated} created, ${membersSkipped} already existed (skipped)`)

    // ── 3. Create current month with manager (ON CONFLICT DO NOTHING) ──
    const now = new Date()
    const year = now.getFullYear()
    const monthNo = now.getMonth() + 1
    const managerName = 'Sohan'
    const managerId = memberIds[managerName]

    let monthId
    let monthCreated = false
    const monthExisting = await pool.query(`SELECT id, manager_id FROM mess_month WHERE year = $1 AND month_no = $2 LIMIT 1`, [year, monthNo])
    if (monthExisting.rows.length > 0) {
      monthId = monthExisting.rows[0].id
      console.log(`[seed] Month ${year}-${String(monthNo).padStart(2, '0')} already exists (id=${monthId}), skipped`)
    } else {
      if (!managerId) {
        console.warn(`[seed] Manager "${managerName}" not found, creating month without manager`)
      }
      const monthRes = await pool.query(
        `INSERT INTO mess_month (year, month_no, closed, manager_id, created_at, created_by)
         VALUES ($1, $2, false, $3, NOW(), NULL)
         ON CONFLICT (year, month_no) DO NOTHING
         RETURNING id`,
        [year, monthNo, managerId ?? null],
      )
      if (monthRes.rows.length > 0) {
        monthId = monthRes.rows[0].id
        monthCreated = true
        console.log(`[seed] Created month ${year}-${String(monthNo).padStart(2, '0')} with manager "${managerName}" (id=${monthId})`)
      } else {
        // Race condition: another process created it
        const retry = await pool.query(`SELECT id FROM mess_month WHERE year = $1 AND month_no = $2 LIMIT 1`, [year, monthNo])
        monthId = retry.rows[0].id
        console.log(`[seed] Month ${year}-${String(monthNo).padStart(2, '0')} already exists after conflict (id=${monthId})`)
      }
    }

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
