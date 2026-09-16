import { categoryLabel, EXPENSE_CATEGORIES, type Expense, type ExpenseCategory } from './types'
import { toISODate } from './format'

export type CategorySpend = {
  key: string
  category: ExpenseCategory | null
  label: string
  amount: number
}

export function monthPrefix(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-`
}

export function startOfIsoWeek(now: Date): Date {
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff)
}

export function inMonth(isoDate: string, now: Date): boolean {
  return isoDate.startsWith(monthPrefix(now))
}

export function spentThisMonth(expenses: Pick<Expense, 'amount' | 'date'>[], now: Date): number {
  return expenses.filter((e) => inMonth(e.date, now)).reduce((s, e) => s + e.amount, 0)
}

export function spentThisWeek(expenses: Pick<Expense, 'amount' | 'date'>[], now: Date): number {
  const from = toISODate(startOfIsoWeek(now))
  const to = toISODate(now)
  return expenses
    .filter((e) => e.date >= from && e.date <= to)
    .reduce((s, e) => s + e.amount, 0)
}

export function monthExpenses(expenses: Expense[], now: Date): Expense[] {
  return expenses
    .filter((e) => inMonth(e.date, now))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
}

export function spentByCategory(
  expenses: Pick<Expense, 'amount' | 'date' | 'category'>[],
  now: Date,
): CategorySpend[] {
  const totals = new Map<string, number>()
  for (const e of expenses) {
    if (!inMonth(e.date, now)) continue
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
  return monthExpenses(expenses, now).filter((e) =>
    category === null ? e.category === null : e.category === category,
  )
}
