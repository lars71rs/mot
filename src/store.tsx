import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { demoState } from './demo'
import { newId, saveState, loadState } from './storage'
import type {
  AppState,
  BudgetPlans,
  Expense,
  ExpenseCategory,
  FixedExpense,
  Goal,
  GoalType,
} from './types'
import { emptyBudget, emptyState } from './types'

type Store = {
  state: AppState
  setIncome: (amount: number) => void
  setFixed: (fixed: FixedExpense[]) => void
  addFixed: (name: string, amount: number) => void
  updateFixed: (id: string, patch: Partial<Pick<FixedExpense, 'name' | 'amount'>>) => void
  removeFixed: (id: string) => void
  saveGoal: (input: {
    id?: string
    type: GoalType
    name: string
    targetAmount: number
    alreadySaved: number
    months: number
    activate: boolean
  }) => string
  activateGoal: (id: string | null) => void
  removeGoal: (id: string) => void
  addExpense: (amount: number, date: string, category: ExpenseCategory | null) => void
  removeExpense: (id: string) => void
  saveBudgetPlans: (plans: BudgetPlans) => void
  resetBudget: () => void
  completeOnboarding: () => void
  loadDemo: () => void
  resetAll: () => void
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState())

  const commit = useCallback((updater: (s: AppState) => AppState) => {
    setState((prev) => {
      const next = updater(prev)
      saveState(next)
      return next
    })
  }, [])

  const store = useMemo<Store>(
    () => ({
      state,
      setIncome: (amount) => commit((s) => ({ ...s, monthlyIncome: amount })),
      setFixed: (fixed) => commit((s) => ({ ...s, fixed })),
      addFixed: (name, amount) =>
        commit((s) => ({
          ...s,
          fixed: [...s.fixed, { id: newId(), name, amount }],
        })),
      updateFixed: (id, patch) =>
        commit((s) => ({
          ...s,
          fixed: s.fixed.map((f) => (f.id === id ? { ...f, ...patch } : f)),
        })),
      removeFixed: (id) =>
        commit((s) => ({ ...s, fixed: s.fixed.filter((f) => f.id !== id) })),
      saveGoal: (input) => {
        const id = input.id ?? newId()
        commit((s) => {
          const nextGoal: Goal = {
            id,
            type: input.type,
            name: input.name,
            targetAmount: input.targetAmount,
            alreadySaved: input.alreadySaved,
            months: input.months,
            createdAt: s.goals.find((g) => g.id === id)?.createdAt ?? new Date().toISOString(),
            active: input.activate,
          }
          let goals = s.goals.some((g) => g.id === id)
            ? s.goals.map((g) => (g.id === id ? nextGoal : g))
            : [...s.goals, nextGoal]
          if (input.activate) {
            goals = goals.map((g) => ({ ...g, active: g.id === id }))
          }
          return { ...s, goals }
        })
        return id
      },
      activateGoal: (id) =>
        commit((s) => ({
          ...s,
          goals: s.goals.map((g) => ({ ...g, active: id !== null && g.id === id })),
        })),
      removeGoal: (id) =>
        commit((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) })),
      addExpense: (amount, date, category) =>
        commit((s) => ({
          ...s,
          expenses: [
            ...s.expenses,
            {
              id: newId(),
              amount,
              date,
              category,
              createdAt: new Date().toISOString(),
            },
          ],
        })),
      removeExpense: (id) =>
        commit((s) => ({
          ...s,
          expenses: s.expenses.filter((e) => e.id !== id),
        })),
      saveBudgetPlans: (plans) =>
        commit((s) => ({
          ...s,
          budget: {
            customized: true,
            plans: {
              mat: Math.max(0, Math.round(plans.mat)),
              fritid: Math.max(0, Math.round(plans.fritid)),
              transport: Math.max(0, Math.round(plans.transport)),
              annet: Math.max(0, Math.round(plans.annet)),
            },
          },
        })),
      resetBudget: () => commit((s) => ({ ...s, budget: emptyBudget() })),
      completeOnboarding: () => commit((s) => ({ ...s, onboarded: true })),
      loadDemo: () => commit(() => demoState()),
      resetAll: () => commit(() => emptyState()),
    }),
    [state, commit],
  )

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore uten provider')
  return ctx
}

export function todayExpenses(expenses: Expense[], iso: string): Expense[] {
  return expenses.filter((e) => e.date === iso).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}
