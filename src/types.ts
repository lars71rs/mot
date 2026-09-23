export type GoalType = 'egenkapital' | 'bolig' | 'bil' | 'buffer' | 'annet'

export type ExpenseCategory =
  | 'bolig'
  | 'mat'
  | 'fritid'
  | 'transport'
  | 'klaer'
  | 'helse'
  | 'abonnement'
  | 'annet'

export type TxDirection = 'in' | 'out'

export type FixedExpense = {
  id: string
  name: string
  amount: number
}

export type Goal = {
  id: string
  type: GoalType
  name: string
  targetAmount: number
  alreadySaved: number
  months: number
  createdAt: string
  active: boolean
}

export type Expense = {
  id: string
  amount: number
  date: string
  direction: TxDirection
  category: ExpenseCategory | null
  note?: string
  createdAt: string
}

export type BudgetPost = 'mat' | 'fritid' | 'transport' | 'annet'

export type BudgetPlans = Record<BudgetPost, number>

export type BudgetState = {
  customized: boolean
  plans: BudgetPlans
}

export type AppState = {
  onboarded: boolean
  /** When they first used Mot. Month wheel cannot go earlier than this (minus the dump month). */
  startedAt: string | null
  displayName: string
  birthYear: number | null
  monthlyIncome: number
  fixed: FixedExpense[]
  goals: Goal[]
  expenses: Expense[]
  budget: BudgetState
  /** YYYY-MM currently open on the map. Minister talks about this month first. */
  viewMonth: string | null
}

export type Route =
  | { name: 'welcome' }
  | { name: 'profile' }
  | { name: 'income'; fromOnboarding: boolean }
  | { name: 'fixed'; fromOnboarding: boolean }
  | { name: 'home' }
  | { name: 'meet'; afterDump?: boolean }
  | { name: 'add-expense'; date?: string }
  | { name: 'category'; category: ExpenseCategory | null; month?: string }
  | { name: 'import' }
  | { name: 'settings' }

export const GOAL_TYPES: { id: GoalType; label: string }[] = [
  { id: 'egenkapital', label: 'Egenkapital' },
  { id: 'bolig', label: 'Bolig' },
  { id: 'bil', label: 'Bil' },
  { id: 'buffer', label: 'Buffer' },
  { id: 'annet', label: 'Annet' },
]

export const EXPENSE_CATEGORIES: { id: ExpenseCategory; label: string }[] = [
  { id: 'bolig', label: 'Bolig' },
  { id: 'mat', label: 'Mat' },
  { id: 'fritid', label: 'Underholdning' },
  { id: 'transport', label: 'Transport' },
  { id: 'klaer', label: 'Klær' },
  { id: 'helse', label: 'Helse' },
  { id: 'abonnement', label: 'Abonnement' },
  { id: 'annet', label: 'Annet' },
]

export function categoryLabel(id: string | null): string {
  if (!id) return 'Utgift'
  if (id === 'uteliv') return 'Underholdning'
  if (id === 'shopping') return 'Klær'
  return EXPENSE_CATEGORIES.find((c) => c.id === id)?.label ?? 'Utgift'
}

export const emptyBudget = (): BudgetState => ({
  customized: false,
  plans: { mat: 0, fritid: 0, transport: 0, annet: 0 },
})

export const emptyState = (): AppState => ({
  onboarded: false,
  startedAt: null,
  displayName: '',
  birthYear: null,
  monthlyIncome: 0,
  fixed: [],
  goals: [],
  expenses: [],
  budget: emptyBudget(),
  viewMonth: null,
})
