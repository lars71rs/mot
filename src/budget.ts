import {
  daysInCalendarMonth,
  monthlySavingFor,
  planDoesNotFit,
  type EngineGoal,
} from './engine'
import { formatNok } from './format'
import type { BudgetPlans, BudgetPost, Expense, ExpenseCategory } from './types'

export type { BudgetPlans, BudgetPost }

export const BUDGET_POSTS: { id: BudgetPost; label: string }[] = [
  { id: 'mat', label: 'Mat' },
  { id: 'fritid', label: 'Fritid' },
  { id: 'transport', label: 'Transport' },
  { id: 'annet', label: 'Annet' },
]

export const emptyPlans = (): BudgetPlans => ({
  mat: 0,
  fritid: 0,
  transport: 0,
  annet: 0,
})

export function freePotKr(
  monthlyIncome: number,
  fixedTotal: number,
  goal: EngineGoal | null,
): number {
  if (monthlyIncome - fixedTotal <= 0) return 0
  if (goal && planDoesNotFit(goal, monthlyIncome, fixedTotal)) return 0
  return Math.max(0, monthlyIncome - fixedTotal - monthlySavingFor(goal))
}

export function suggestBudget(freePot: number): BudgetPlans {
  if (freePot <= 0) return emptyPlans()
  const mat = Math.round(freePot * 0.5)
  const fritid = Math.round(freePot * 0.25)
  const transport = Math.round(freePot * 0.1)
  const annet = freePot - mat - fritid - transport
  return { mat, fritid, transport, annet }
}

export function expenseToBudgetPost(category: ExpenseCategory | string | null): BudgetPost {
  if (category === 'mat') return 'mat'
  if (category === 'fritid' || category === 'uteliv') return 'fritid'
  if (category === 'transport') return 'transport'
  return 'annet'
}

export function resolvedPlans(freePot: number, customized: boolean, stored: BudgetPlans): BudgetPlans {
  return customized ? stored : suggestBudget(freePot)
}

export function unallocatedKr(freePot: number, plans: BudgetPlans): number {
  return freePot - plans.mat - plans.fritid - plans.transport - plans.annet
}

export function distributionNote(unallocated: number): string | null {
  if (unallocated < 0) return `${formatNok(-unallocated)} for mye fordelt.`
  return null
}

export type BudgetRow = {
  id: BudgetPost
  label: string
  plan: number
  used: number
  remaining: number
  expectedSoFar: number
}

export type BudgetView = {
  freePot: number
  planSum: number
  unallocated: number
  sumNote: string | null
  paceNote: string | null
  rows: BudgetRow[]
}

export function buildBudgetView(args: {
  freePot: number
  plans: BudgetPlans
  expenses: Pick<Expense, 'amount' | 'date' | 'category'>[]
  now: Date
  remainingToday: number
}): BudgetView {
  const { freePot, plans, expenses, now, remainingToday } = args
  const days = daysInCalendarMonth(now)
  const dayOfMonth = now.getDate()
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-`

  const used: BudgetPlans = emptyPlans()
  for (const e of expenses) {
    if (!e.date.startsWith(monthPrefix)) continue
    used[expenseToBudgetPost(e.category)] += e.amount
  }

  const rows: BudgetRow[] = BUDGET_POSTS.map((post) => {
    const plan = Math.max(0, plans[post.id])
    const spent = used[post.id]
    const expectedSoFar = days > 0 ? Math.round((plan * dayOfMonth) / days) : 0
    return {
      id: post.id,
      label: post.label,
      plan,
      used: spent,
      remaining: plan - spent,
      expectedSoFar,
    }
  })

  const planSum = rows.reduce((s, r) => s + r.plan, 0)
  const unallocated = freePot - planSum

  return {
    freePot,
    planSum,
    unallocated,
    sumNote: distributionNote(unallocated),
    paceNote: paceNote(rows, remainingToday),
    rows,
  }
}

export function expensesForPost(
  expenses: Expense[],
  post: BudgetPost,
  now: Date,
): Expense[] {
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-`
  return expenses
    .filter((e) => e.date.startsWith(monthPrefix) && expenseToBudgetPost(e.category) === post)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
}

function paceNote(rows: BudgetRow[], remainingToday: number): string | null {
  const empty = rows.filter((r) => r.used > 0 && r.remaining <= 0)
  if (empty.length > 0) {
    const worst = [...empty].sort((a, b) => a.remaining - b.remaining)[0]
    if (remainingToday >= 0) {
      return `${worst.label} er tom, dagen er fortsatt ok.`
    }
    return `${worst.label} er tom.`
  }

  const fast = rows.filter(
    (r) => r.plan > 0 && r.remaining > 0 && r.used > r.expectedSoFar,
  )
  if (fast.length > 0) {
    const worst = [...fast].sort((a, b) => b.used - b.expectedSoFar - (a.used - a.expectedSoFar))[0]
    return `${worst.label} går for fort.`
  }

  return null
}
