import { createServerFn } from '@tanstack/react-start'
import { eq, isNull } from 'drizzle-orm'
import { db } from '../db'

export const getLedgerByMonth = createServerFn({ method: 'GET' as const })
  .validator((data: { monthId: number }) => data)
  .handler(async ({ data }) => {
    const bazarRows = await db.query.bazar.findMany({
      where: (t, { and }) => and(eq(t.monthId, data.monthId), isNull(t.deletedAt)),
      with: { member: { columns: { name: true } } },
    })
    const expenseRows = await db.query.expenses.findMany({
      where: (t, { and }) => and(eq(t.monthId, data.monthId), isNull(t.deletedAt)),
      with: { paidBy: { columns: { name: true } } },
    })
    const depositRows = await db.query.deposits.findMany({
      where: (t, { and }) => and(eq(t.monthId, data.monthId), isNull(t.deletedAt)),
      with: { member: { columns: { name: true } } },
    })
    const rentRows = await db.query.rents.findMany({
      where: (t, { and }) => and(eq(t.monthId, data.monthId), isNull(t.deletedAt)),
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
        status: r.status as 'pending' | 'approved' | 'rejected',
        createdAt: r.createdAt?.toISOString() ?? null,
        updatedAt: r.updatedAt?.toISOString() ?? null,
        createdBy: r.createdBy,
        updatedBy: r.updatedBy,
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
        status: r.status as 'pending' | 'approved' | 'rejected',
        createdAt: r.createdAt?.toISOString() ?? null,
        updatedAt: r.updatedAt?.toISOString() ?? null,
        createdBy: r.createdBy,
        updatedBy: r.updatedBy,
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
        status: 'approved' as const,
        createdAt: r.createdAt?.toISOString() ?? null,
        updatedAt: r.updatedAt?.toISOString() ?? null,
        createdBy: r.createdBy,
        updatedBy: r.updatedBy,
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
        status: 'approved' as const,
        createdAt: r.createdAt?.toISOString() ?? null,
        updatedAt: r.updatedAt?.toISOString() ?? null,
        createdBy: r.createdBy,
        updatedBy: r.updatedBy,
      })),
    ]

    entries.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0
      return b.createdAt.localeCompare(a.createdAt)
    })

    return entries
  })
