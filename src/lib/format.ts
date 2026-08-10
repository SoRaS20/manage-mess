const takaFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const numberFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

export function formatTaka(amount: number): string {
  return `${takaFmt.format(amount)} BDT`
}

export function formatNumber(value: number): string {
  return numberFmt.format(value)
}

export function monthLabel(year: number, monthNo: number): string {
  return new Date(year, monthNo - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function monthShort(year: number, monthNo: number): string {
  return new Date(year, monthNo - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function todayISO(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}