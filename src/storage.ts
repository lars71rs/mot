import { emptyBudget, emptyState, type AppState } from './types'

const KEY = 'mot.v1'

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as Partial<AppState>
    return {
      ...emptyState(),
      ...parsed,
      fixed: Array.isArray(parsed.fixed) ? parsed.fixed : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      budget: parsed.budget
        ? {
            customized: Boolean(parsed.budget.customized),
            plans: { ...emptyBudget().plans, ...parsed.budget.plans },
          }
        : emptyBudget(),
    }
  } catch {
    return emptyState()
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function clearState(): void {
  localStorage.removeItem(KEY)
}

export function newId(): string {
  return crypto.randomUUID()
}
