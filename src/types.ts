export type GoalType = 'egenkapital' | 'bolig' | 'bil' | 'buffer' | 'annet'

export type ExpenseCategory = 'mat' | 'fritid' | 'transport' | 'klaer' | 'annet'

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
  category: ExpenseCategory | null
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
  monthlyIncome: number
  fixed: FixedExpense[]
  goals: Goal[]
  expenses: Expense[]
  budget: BudgetState
}

export type Route =
  | { name: 'welcome' }
  | { name: 'income'; fromOnboarding: boolean }
  | { name: 'fixed'; fromOnboarding: boolean }
  | { name: 'home' }
  | { name: 'add-expense'; date?: string }
  | { name: 'budget' }
  | { name: 'budget-category'; post: BudgetPost }
  | { name: 'goals' }
  | { name: 'goal-edit'; id: string | 'new' }
  | { name: 'settings' }

export const GOAL_TYPES: { id: GoalType; label: string }[] = [
  { id: 'egenkapital', label: 'Egenkapital' },
  { id: 'bolig', label: 'Bolig' },
  { id: 'bil', label: 'Bil' },
  { id: 'buffer', label: 'Buffer' },
  { id: 'annet', label: 'Annet' },
]

export const EXPENSE_CATEGORIES: { id: ExpenseCategory; label: string }[] = [
  { id: 'mat', label: 'Mat' },
  { id: 'fritid', label: 'Fritid' },
  { id: 'transport', label: 'Transport' },
  { id: 'klaer', label: 'Klær' },
  { id: 'annet', label: 'Annet' },
]

export function categoryLabel(id: string | null): string {
  if (!id) return 'Utgift'
  if (id === 'uteliv') return 'Fritid'
  if (id === 'shopping') return 'Klær'
  return EXPENSE_CATEGORIES.find((c) => c.id === id)?.label ?? 'Utgift'
}

export const emptyBudget = (): BudgetState => ({
  customized: false,
  plans: { mat: 0, fritid: 0, transport: 0, annet: 0 },
})

export const emptyState = (): AppState => ({
  onboarded: false,
  monthlyIncome: 0,
  fixed: [],
  goals: [],
  expenses: [],
  budget: emptyBudget(),
})
