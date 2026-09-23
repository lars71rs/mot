import { categoryLabel, EXPENSE_CATEGORIES, type Expense, type ExpenseCategory } from './types'
import { monthTitleFromKey, toISODate } from './format'

export type CategorySpend = {
  key: string
  category: ExpenseCategory | null
  label: string
  amount: number
}

export function monthKey(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function monthPrefix(now: Date): string {
  return `${monthKey(now)}-`
}

export function dateFromMonthKey(key: string): Date {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, (m || 1) - 1, 1, 12, 0, 0)
}

export function shiftMonthKey(key: string, delta: number): string {
  const d = dateFromMonthKey(key)
  d.setMonth(d.getMonth() + delta)
  return monthKey(d)
}

export function startOfIsoWeek(now: Date): Date {
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff)
}

export function inMonth(isoDate: string, now: Date): boolean {
  return isoDate.startsWith(monthPrefix(now))
}

export function isOut(e: Pick<Expense, 'direction'>): boolean {
  return e.direction !== 'in'
}

export function isIn(e: Pick<Expense, 'direction'>): boolean {
  return e.direction === 'in'
}

export function spentThisMonth(
  expenses: Pick<Expense, 'amount' | 'date' | 'direction'>[],
  now: Date,
): number {
  return expenses.filter((e) => inMonth(e.date, now) && isOut(e)).reduce((s, e) => s + e.amount, 0)
}

export function incomeThisMonth(
  expenses: Pick<Expense, 'amount' | 'date' | 'direction'>[],
  now: Date,
): number {
  return expenses.filter((e) => inMonth(e.date, now) && isIn(e)).reduce((s, e) => s + e.amount, 0)
}

export function leftoverThisMonth(
  expenses: Pick<Expense, 'amount' | 'date' | 'direction'>[],
  now: Date,
): number {
  return incomeThisMonth(expenses, now) - spentThisMonth(expenses, now)
}

export function spentByMonth(
  expenses: Pick<Expense, 'amount' | 'date' | 'direction'>[],
): { month: string; amount: number }[] {
  const totals = new Map<string, number>()
  for (const e of expenses) {
    if (!isOut(e)) continue
    const key = e.date.slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(key)) continue
    totals.set(key, (totals.get(key) ?? 0) + e.amount)
  }
  return [...totals.entries()]
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => b.month.localeCompare(a.month))
}

export function dominantMonthKey(dates: string[]): string | null {
  const counts = new Map<string, number>()
  for (const d of dates) {
    const key = d.slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(key)) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let best: string | null = null
  let n = 0
  for (const [key, c] of counts) {
    if (c > n || (c === n && best !== null && key > best)) {
      best = key
      n = c
    }
  }
  return best
}

export function monthsWithActivity(expenses: Pick<Expense, 'date'>[]): string[] {
  const keys = new Set<string>()
  for (const e of expenses) {
    const key = e.date.slice(0, 7)
    if (/^\d{4}-\d{2}$/.test(key)) keys.add(key)
  }
  return [...keys].sort((a, b) => b.localeCompare(a))
}

function monthFromStamp(value: string | Date | null | undefined, fallback: Date): string {
  if (!value) return monthKey(fallback)
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return monthKey(fallback)
  return monthKey(d)
}

export const PATTERN_MONTHS_NEEDED = 3

export type DataCoverage = {
  months: string[]
  monthCount: number
  txCount: number
  enoughForPatterns: boolean
  monthsNeeded: number
  missing: number
}

export function dataCoverage(
  expenses: Pick<Expense, 'date'>[],
): DataCoverage {
  const months = monthsWithActivity(expenses).slice().reverse()
  const monthCount = months.length
  const enoughForPatterns = monthCount >= PATTERN_MONTHS_NEEDED
  return {
    months,
    monthCount,
    txCount: expenses.length,
    enoughForPatterns,
    monthsNeeded: PATTERN_MONTHS_NEEDED,
    missing: enoughForPatterns ? 0 : PATTERN_MONTHS_NEEDED - monthCount,
  }
}

export function dumpKickMessage(viewMonth: string | null, c: DataCoverage): string {
  const label = viewMonth ? monthTitleFromKey(viewMonth) : 'den åpne måneden'
  const pattern = c.enoughForPatterns
    ? 'Du har nok måneder til mønster. Pek på det som gjentar seg.'
    : `Du har ${c.monthCount} av ${c.monthsNeeded} måneder. Be om mer fil under Kontoutskrift. Ikke late som mønster.`
  return `Jeg la nettopp inn kontoutskrift. Kartet viser ${label}. Si hva du ser i den måneden: inn, ut, igjen. Hva ser fast ut? ${pattern}`
}

export function coverageCopy(c: DataCoverage): string {
  if (c.monthCount === 0) {
    return 'Ingen måneder inne. Legg inn kontoutskrift.'
  }
  if (!c.enoughForPatterns) {
    const more = c.missing === 1 ? 'én måned til' : `${c.missing} måneder til`
    return `${c.monthCount} av ${c.monthsNeeded} måneder inne. Ett bilde er ikke et mønster — dump ${more}.`
  }
  return `${c.monthCount} måneder inne. Nå kan vi snakke om det som gjentar seg.`
}

/**
 * Wheel: first month with data → now.
 * Empty months before the first dump stay closed.
 * Dumped history (even before signup) is visible.
 */
export function visibleMonths(
  expenses: Pick<Expense, 'date'>[],
  now: Date,
  startedAt?: string | Date | null,
): string[] {
  const activity = monthsWithActivity(expenses)
  const current = monthKey(now)
  if (activity.length === 0) {
    return [startedAt ? monthFromStamp(startedAt, now) : current]
  }
  const first = activity[activity.length - 1]
  const newest = activity[0]
  const last = newest > current ? newest : current
  const start = first < last ? first : last
  const end = first < last ? last : first
  const out: string[] = []
  let key = start
  while (key <= end) {
    out.push(key)
    key = shiftMonthKey(key, 1)
    if (out.length > 120) break
  }
  return out
}

export function inPocket(
  monthlyIncome: number,
  fixedTotal: number,
  spentMonth: number,
): number {
  return monthlyIncome - fixedTotal - spentMonth
}

export function spentThisWeek(expenses: Pick<Expense, 'amount' | 'date' | 'direction'>[], now: Date): number {
  const from = toISODate(startOfIsoWeek(now))
  const to = toISODate(now)
  return expenses
    .filter((e) => isOut(e) && e.date >= from && e.date <= to)
    .reduce((s, e) => s + e.amount, 0)
}

export function monthExpenses(expenses: Expense[], now: Date): Expense[] {
  return expenses
    .filter((e) => inMonth(e.date, now))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
}

export function spentByCategory(
  expenses: Pick<Expense, 'amount' | 'date' | 'category' | 'direction'>[],
  now: Date,
): CategorySpend[] {
  const totals = new Map<string, number>()
  for (const e of expenses) {
    if (!inMonth(e.date, now) || !isOut(e)) continue
    const key = e.category ?? 'ukjent'
    totals.set(key, (totals.get(key) ?? 0) + e.amount)
  }
  const rows: CategorySpend[] = []
  for (const [key, amount] of totals) {
    const known = EXPENSE_CATEGORIES.find((c) => c.id === key)
    rows.push({
      key,
      category: known?.id ?? null,
      label: known ? known.label : categoryLabel(key === 'ukjent' ? null : key),
      amount,
    })
  }
  return rows.sort((a, b) => b.amount - a.amount)
}

export function expensesForCategory(
  expenses: Expense[],
  category: ExpenseCategory | null,
  now: Date,
): Expense[] {
  return monthExpenses(expenses, now).filter(
    (e) =>
      isOut(e) && (category === null ? e.category === null : e.category === category),
  )
}
