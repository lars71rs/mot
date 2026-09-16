import { useState, type KeyboardEvent } from 'react'
import {
  buildBudgetView,
  freePotKr,
  resolvedPlans,
  suggestBudget,
  type BudgetPlans,
  type BudgetPost,
} from '../budget'
import { TabBar } from '../components/TabBar'
import { activeGoal, calculate } from '../engine'
import { amountFromField, formatNok, formatNokPlain } from '../format'
import { useStore } from '../store'

export function Budget({
  onHome,
  onGoals: _onGoals,
  onSettings,
  onOpenPost,
}: {
  onHome: () => void
  onGoals: () => void
  onSettings: () => void
  onOpenPost: (post: BudgetPost) => void
}) {
  const { state, saveBudgetPlans, resetBudget } = useStore()
  const now = new Date()
  const goal = activeGoal(state.goals)
  const fixedTotal = state.fixed.reduce((s, f) => s + f.amount, 0)
  const engine = calculate({
    monthlyIncome: state.monthlyIncome,
    fixedTotal,
    goal,
    expenses: state.expenses,
    now,
  })
  const freePot = freePotKr(state.monthlyIncome, fixedTotal, goal)
  const saved = resolvedPlans(freePot, state.budget.customized, state.budget.plans)
  const [draft, setDraft] = useState<BudgetPlans>(saved)
  const view = buildBudgetView({
    freePot,
    plans: draft,
    expenses: state.expenses,
    now,
    remainingToday: engine.remainingToday,
  })

  function commit(post: BudgetPost, amount: number) {
    const next = { ...draft, [post]: amount }
    setDraft(next)
    saveBudgetPlans(next)
  }

  function reset() {
    const suggested = suggestBudget(freePot)
    setDraft(suggested)
    resetBudget()
  }

  return (
    <div className="shell">
      <main className="screen">
        <p className="kicker">Budsjett</p>
        <h1>
          Fri pott {formatNok(view.freePot)} · {formatNok(engine.dailyPlan)}/dag
        </h1>
        <p className="lede">
          Endre de fire postene fritt. Ufordelt er det som er igjen av potten.
          Dagsgrensen på Hjem er sjefen.
        </p>

        <div className="budget-table">
          {view.rows.map((row) => (
            <BudgetRow
              key={row.id}
              label={row.label}
              plan={row.plan}
              used={row.used}
              remaining={row.remaining}
              onOpen={() => onOpenPost(row.id)}
              onPlan={(n) => commit(row.id, n)}
            />
          ))}
          <div className="budget-unallocated">
            <div>
              <span>Ufordelt</span>
              {view.unallocated < 0 && (
                <p className="budget-unallocated-note budget-over">{view.sumNote}</p>
              )}
              {view.unallocated > 0 && (
                <p className="budget-unallocated-note">
                  {formatNok(view.unallocated)} er ikke satt ennå.
                </p>
              )}
            </div>
            <strong className={view.unallocated < 0 ? 'budget-over' : ''}>
              {formatNok(view.unallocated)}
            </strong>
          </div>
        </div>

        {view.paceNote && <p className="budget-note">{view.paceNote}</p>}

        <div className="stack">
          <button type="button" className="text-btn" onClick={reset}>
            Tilbakestill fordeling
          </button>
        </div>
      </main>
      <TabBar active="home" onHome={onHome} onSettings={onSettings} />
    </div>
  )
}

function BudgetRow({
  label,
  plan,
  used,
  remaining,
  onOpen,
  onPlan,
}: {
  label: string
  plan: number
  used: number
  remaining: number
  onOpen: () => void
  onPlan: (n: number) => void
}) {
  const [raw, setRaw] = useState(String(plan))
  const [focused, setFocused] = useState(false)

  function apply(nextRaw: string) {
    setRaw(nextRaw)
    onPlan(amountFromField(nextRaw))
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') e.currentTarget.blur()
  }

  return (
    <div className="budget-row">
      <button type="button" className="budget-name" onClick={onOpen}>
        {label}
      </button>
      <div className="budget-figs">
        <label className="budget-plan">
          <span>Plan</span>
          <span className="budget-plan-field">
            <input
              inputMode="numeric"
              enterKeyHint="done"
              aria-label={`Plan ${label}`}
              value={focused ? raw : formatNokPlain(plan)}
              onFocus={() => {
                setRaw(String(plan))
                setFocused(true)
              }}
              onChange={(e) => apply(e.target.value.replace(/\D/g, ''))}
              onBlur={() => {
                setFocused(false)
                onPlan(amountFromField(raw))
              }}
              onKeyDown={onKeyDown}
            />
          </span>
        </label>
        <button type="button" className="budget-num" onClick={onOpen}>
          <span>Brukt</span>
          <strong>{formatNokPlain(used)}</strong>
        </button>
        <button type="button" className="budget-num" onClick={onOpen}>
          <span>Igjen</span>
          <strong>{formatNokPlain(remaining)}</strong>
        </button>
      </div>
    </div>
  )
}
