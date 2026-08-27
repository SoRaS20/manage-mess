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

function dateKey(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

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
      { username: 'admin', password: hash, role: 'ADMIN' },
      { username: 'rahim', password: hash, role: 'MEMBER' },
      { username: 'karim', password: hash, role: 'MEMBER' },
      { username: 'jabir', password: hash, role: 'MEMBER' },
    ]

    const userIds = {}
    for (const u of usersData) {
      const res = await pool.query(
        `INSERT INTO app_user (username, user_password, role) VALUES ($1, $2, $3) RETURNING id`,
        [u.username, u.password, u.role],
      )
      userIds[u.username] = res.rows[0].id
    }
    console.log(`[seed] Created ${usersData.length} users`)

    // ── 4. Create members ──────────────────────────────
    const membersData = [
      { name: 'Rahim Uddin', phone: '01710000001', joinDate: '2026-01-01', userId: userIds.rahim },
      { name: 'Karim Sheikh', phone: '01710000002', joinDate: '2026-01-01', userId: userIds.karim },
      { name: 'Jabir Hossain', phone: '01710000003', joinDate: '2026-02-01', userId: userIds.jabir },
    ]

    const memberIds = {}
    for (const m of membersData) {
      const res = await pool.query(
        `INSERT INTO member (name, phone, join_date, active, banned, user_id) VALUES ($1, $2, $3, true, false, $4) RETURNING id, name`,
        [m.name, m.phone, m.joinDate, m.userId],
      )
      memberIds[m.name] = res.rows[0].id
    }
    console.log(`[seed] Created ${membersData.length} members`)

    // ── 5. Create current month (July 2026) with manager ─
    const now = new Date()
    const year = now.getFullYear()
    const monthNo = now.getMonth() + 1
    const managerName = 'Rahim Uddin'
    const managerId = memberIds[managerName]

    const monthRes = await pool.query(
      `INSERT INTO mess_month (year, month_no, closed, manager_id) VALUES ($1, $2, false, $3) RETURNING id`,
      [year, monthNo, managerId],
    )
    const monthId = monthRes.rows[0].id
    console.log(`[seed] Created month ${year}-${String(monthNo).padStart(2, '0')} with manager "${managerName}"`)

    // ── 6. Generate meals for all members (every day this month) ──
    const daysInMonth = new Date(year, monthNo, 0).getDate()
    const today = now.getDate()
    const memberNames = Object.keys(memberIds)
    let mealCount = 0

    for (const name of memberNames) {
      const memberId = memberIds[name]
      for (let d = 1; d <= today; d++) {
        const dateStr = dateKey(year, monthNo, d)
        // Vary meals slightly: jabir skips some breakfasts
        const isJabir = name === 'Jabir Hossain'
        const breakfastCount = isJabir && d % 5 === 0 ? 0 : 1
        const lunchCount = 1
        const dinnerCount = d % 7 === 0 ? 0 : 1 // everyone skips dinner on weekends

        await pool.query(
          `INSERT INTO meal (member_id, month_id, record_date, breakfast_count, lunch_count, dinner_count, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'approved')`,
          [memberId, monthId, dateStr, breakfastCount, lunchCount, dinnerCount],
        )
        mealCount++
      }
    }
    console.log(`[seed] Created ${mealCount} meal records`)

    // ── 7. Bazar entries (2-3 per member) ───────────────
    const bazarEntries = [
      { memberName: 'Rahim Uddin', amount: 2500, description: 'Weekly grocery', bazarDate: dateKey(year, monthNo, 3) },
      { memberName: 'Rahim Uddin', amount: 1800, description: 'Rice and dal', bazarDate: dateKey(year, monthNo, 10) },
      { memberName: 'Karim Sheikh', amount: 3200, description: 'Fish and meat', bazarDate: dateKey(year, monthNo, 7) },
      { memberName: 'Karim Sheikh', amount: 950, description: 'Vegetables', bazarDate: dateKey(year, monthNo, 14) },
      { memberName: 'Jabir Hossain', amount: 2100, description: 'Oil, spices, groceries', bazarDate: dateKey(year, monthNo, 5) },
      { memberName: 'Jabir Hossain', amount: 1400, description: 'Fruits and snacks', bazarDate: dateKey(year, monthNo, 12) },
    ]

    for (const b of bazarEntries) {
      await pool.query(
        `INSERT INTO bazar (member_id, month_id, amount, description, bazar_date, status) VALUES ($1, $2, $3, $4, $5, 'approved')`,
        [memberIds[b.memberName], monthId, b.amount, b.description, b.bazarDate],
      )
    }
    console.log(`[seed] Created ${bazarEntries.length} bazar entries`)

    // ── 8. Expenses ─────────────────────────────────────
    const expenseEntries = [
      { amount: 3500, description: 'Gas bill', category: 'gas', paidByName: 'Rahim Uddin', expenseDate: dateKey(year, monthNo, 2) },
      { amount: 2200, description: 'Electricity bill', category: 'electricity', paidByName: 'Karim Sheikh', expenseDate: dateKey(year, monthNo, 8) },
      { amount: 800, description: 'Internet bill', category: 'internet', paidByName: 'Jabir Hossain', expenseDate: dateKey(year, monthNo, 1) },
      { amount: 500, description: 'Water filter service', category: 'water', paidByName: 'Rahim Uddin', expenseDate: dateKey(year, monthNo, 15) },
    ]

    for (const e of expenseEntries) {
      await pool.query(
        `INSERT INTO expense (month_id, amount, description, category, paid_by_id, expense_date, status) VALUES ($1, $2, $3, $4, $5, $6, 'approved')`,
        [monthId, e.amount, e.description, e.category, memberIds[e.paidByName], e.expenseDate],
      )
    }
    console.log(`[seed] Created ${expenseEntries.length} expense entries`)

    // ── 9. Deposits ─────────────────────────────────────
    const depositEntries = [
      { memberName: 'Rahim Uddin', amount: 5000, depositDate: dateKey(year, monthNo, 1) },
      { memberName: 'Karim Sheikh', amount: 5000, depositDate: dateKey(year, monthNo, 1) },
      { memberName: 'Jabir Hossain', amount: 4500, depositDate: dateKey(year, monthNo, 3) },
    ]

    for (const d of depositEntries) {
      await pool.query(
        `INSERT INTO deposit (member_id, month_id, amount, deposit_date) VALUES ($1, $2, $3, $4)`,
        [memberIds[d.memberName], monthId, d.amount, d.depositDate],
      )
    }
    console.log(`[seed] Created ${depositEntries.length} deposit entries`)

    // ── 10. Rents ───────────────────────────────────────
    const rentEntries = [
      { memberName: 'Rahim Uddin', amount: 4000 },
      { memberName: 'Karim Sheikh', amount: 4000 },
      { memberName: 'Jabir Hossain', amount: 3500 },
    ]

    for (const r of rentEntries) {
      await pool.query(
        `INSERT INTO rent (member_id, month_id, amount) VALUES ($1, $2, $3)`,
        [memberIds[r.memberName], monthId, r.amount],
      )
    }
    console.log(`[seed] Created ${rentEntries.length} rent entries`)

    // ── 11. Summary ─────────────────────────────────────
    const totalBazar = bazarEntries.reduce((s, b) => s + b.amount, 0)
    const totalExpenses = expenseEntries.reduce((s, e) => s + e.amount, 0)
    const totalDeposits = depositEntries.reduce((s, d) => s + d.amount, 0)
    const totalRents = rentEntries.reduce((s, r) => s + r.amount, 0)

    console.log('\n═══════════════════════════════════════════')
    console.log('  SEED COMPLETE')
    console.log('═══════════════════════════════════════════')
    console.log(`  Users:   ${usersData.length} (1 admin + 3 members)`)
    console.log(`  Members: ${membersData.length}`)
    console.log(`  Month:   ${year}-${String(monthNo).padStart(2, '0')}`)
    console.log(`  Meals:   ${mealCount} records (${today} days × ${memberNames.length} members)`)
    console.log(`  Bazar:   ${bazarEntries.length} entries (৳${totalBazar.toLocaleString()})`)
    console.log(`  Expenses: ${expenseEntries.length} entries (৳${totalExpenses.toLocaleString()})`)
    console.log(`  Deposits: ${depositEntries.length} entries (৳${totalDeposits.toLocaleString()})`)
    console.log(`  Rents:    ${rentEntries.length} entries (৳${totalRents.toLocaleString()})`)
    console.log('───────────────────────────────────────────')
    console.log('  Login credentials (all users):')
    console.log('  Username: admin / rahim / karim / jabir')
    console.log('  Password: pass123')
    console.log('  Manager:  Rahim Uddin')
    console.log('═══════════════════════════════════════════\n')
  } catch (err) {
    console.error('[seed] Error:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

seed()
