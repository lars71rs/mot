import { categoryLabel, EXPENSE_CATEGORIES, type Expense, type ExpenseCategory } from './types'
import { toISODate } from './format'

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

/**
 * Months you can open on the map.
 * Floor = the month you joined, except the previous calendar month
 * (the dump Mot asks for). Older rows in a CSV cannot unlock June
 * if you downloaded in August.
 */
export function visibleMonths(
  expenses: Pick<Expense, 'date'>[],
  now: Date,
  startedAt?: string | Date | null,
): string[] {
  const activity = monthsWithActivity(expenses)
  const current = monthKey(now)
  const firstData = activity.length ? activity[activity.length - 1] : current
  const joined = startedAt ? monthFromStamp(startedAt, now) : firstData
  const dumpMonth = startedAt ? shiftMonthKey(joined, -1) : firstData
  const first = firstData < dumpMonth ? dumpMonth : firstData
  const newest = activity[0] ?? current
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
