import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { bazar, expenses, deposits, rents } from '../db/schema'

export const getLedgerByMonth = createServerFn({ method: 'GET' as const })
  .validator((data: { monthId: number }) => data)
  .handler(async ({ data }) => {
    const bazarRows = await db.query.bazar.findMany({
      where: eq(bazar.monthId, data.monthId),
      with: { member: { columns: { name: true } } },
    })
    const expenseRows = await db.query.expenses.findMany({
      where: eq(expenses.monthId, data.monthId),
      with: { paidBy: { columns: { name: true } } },
    })
    const depositRows = await db.query.deposits.findMany({
      where: eq(deposits.monthId, data.monthId),
      with: { member: { columns: { name: true } } },
    })
    const rentRows = await db.query.rents.findMany({
      where: eq(rents.monthId, data.monthId),
      with: { member: { columns: { name: true } } },
    })

    const entries = [
      ...bazarRows.map((r) => ({
        type: 'bazar' as const,
        id: r.id,
        memberId: r.memberId,
        memberName: r.member.name,
        amount: Number(r.amount),
        description: r.description,
        category: undefined as string | undefined,
        entryDate: r.bazarDate,
        createdAt: r.createdAt?.toISOString() ?? null,
      })),
      ...expenseRows.map((r) => ({
        type: 'expense' as const,
        id: r.id,
        memberId: r.paidById,
        memberName: r.paidBy?.name ?? null,
        amount: Number(r.amount),
        description: r.description,
        category: r.category,
        entryDate: r.expenseDate,
        createdAt: r.createdAt?.toISOString() ?? null,
      })),
      ...depositRows.map((r) => ({
        type: 'deposit' as const,
        id: r.id,
        memberId: r.memberId,
        memberName: r.member.name,
        amount: Number(r.amount),
        description: r.description,
        category: undefined as string | undefined,
        entryDate: r.depositDate,
        createdAt: r.createdAt?.toISOString() ?? null,
      })),
      ...rentRows.map((r) => ({
        type: 'rent' as const,
        id: r.id,
        memberId: r.memberId,
        memberName: r.member.name,
        amount: Number(r.amount),
        description: null as string | null,
        category: undefined as string | undefined,
        entryDate: null as string | null,
        createdAt: r.createdAt?.toISOString() ?? null,
      })),
    ]

    entries.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0
      return b.createdAt.localeCompare(a.createdAt)
    })

    return entries
  })
