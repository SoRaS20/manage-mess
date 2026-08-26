import { eq } from 'drizzle-orm'
import { db } from '../db'
import { months } from '../db/schema'

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function dailyCount(meal: { breakfastOn: boolean; lunchOn: boolean; dinnerOn: boolean }): number {
  return (meal.breakfastOn ? 0.5 : 0) + (meal.lunchOn ? 1 : 0) + (meal.dinnerOn ? 1 : 0)
}

export async function assertMonthOpen(monthId: number): Promise<void> {
  const [row] = await db.select().from(months).where(eq(months.id, monthId)).limit(1)
  if (!row) throw new Error('Month not found')
  if (row.closed) throw new Error('Cannot modify records for a closed month.')
}

export async function getMonthById(monthId: number) {
  const [row] = await db.select().from(months).where(eq(months.id, monthId)).limit(1)
  return row ?? null
}

export function eachDayOfMonth(year: number, monthNo: number): string[] {
  const days: string[] = []
  const cursor = new Date(year, monthNo - 1, 1)
  const end = new Date(year, monthNo, 1)
  while (cursor < end) {
    const y = cursor.getFullYear()
    const m = String(cursor.getMonth() + 1).padStart(2, '0')
    const d = String(cursor.getDate()).padStart(2, '0')
    days.push(`${y}-${m}-${d}`)
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

export const SLOTS = ['breakfast', 'lunch', 'dinner'] as const
