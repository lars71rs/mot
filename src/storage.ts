import { monthsWithActivity } from './map'
import { emptyBudget, emptyState, type AppState } from './types'

function inferStartedAt(parsed: Partial<AppState>): string | null {
  if (typeof parsed.startedAt === 'string' && parsed.startedAt) return parsed.startedAt
  const months = monthsWithActivity(Array.isArray(parsed.expenses) ? parsed.expenses : [])
  if (months.length) return `${months[months.length - 1]}-01T12:00:00.000Z`
  if (parsed.onboarded) return new Date().toISOString()
  return null
}

const KEY = 'mot.v1'

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as Partial<AppState>
    const expenses = Array.isArray(parsed.expenses)
      ? parsed.expenses.map((e) => ({
          ...e,
          direction: e.direction === 'in' ? ('in' as const) : ('out' as const),
        }))
      : []
    return {
      ...emptyState(),
      ...parsed,
      startedAt: inferStartedAt(parsed),
      displayName: typeof parsed.displayName === 'string' ? parsed.displayName : '',
      birthYear: typeof parsed.birthYear === 'number' ? parsed.birthYear : null,
      fixed: Array.isArray(parsed.fixed) ? parsed.fixed : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      expenses,
      viewMonth:
        typeof parsed.viewMonth === 'string' && /^\d{4}-\d{2}$/.test(parsed.viewMonth)
          ? parsed.viewMonth
          : null,
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
