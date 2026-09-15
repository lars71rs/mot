import { useRef, useState, type KeyboardEvent } from 'react'
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
  onGoals,
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
    if (draft[post] === amount && state.budget.customized) return
    if (draft[post] === amount && !state.budget.customized) return
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
          Trykk på et planbeløp for å endre det i kroner. Dagsgrensen på Hjem
          er sjefen.
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
        </div>

        {view.sumNote && <p className="warn">{view.sumNote}</p>}
        {view.paceNote && <p className="budget-note">{view.paceNote}</p>}

        <div className="stack">
          <button type="button" className="text-btn" onClick={reset}>
            Tilbakestill fordeling
          </button>
        </div>
      </main>
      <TabBar
        active="budget"
        onHome={onHome}
        onBudget={() => {}}
        onGoals={onGoals}
        onSettings={onSettings}
      />
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
  const inputRef = useRef<HTMLInputElement>(null)
  const [raw, setRaw] = useState(String(plan))
  const [editing, setEditing] = useState(false)

  function startEdit() {
    setRaw(String(plan))
    setEditing(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function finish() {
    setEditing(false)
    onPlan(amountFromField(raw))
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      inputRef.current?.blur()
    }
  }

  return (
    <div className="budget-row">
      <button type="button" className="budget-name" onClick={onOpen}>
        {label}
      </button>
      <div className="budget-figs">
        <div className="budget-plan">
          <span>Plan</span>
          {editing ? (
            <label className="budget-plan-field">
              <input
                ref={inputRef}
                inputMode="numeric"
                enterKeyHint="done"
                aria-label={`Plan ${label}`}
                value={raw}
                onChange={(e) => setRaw(e.target.value.replace(/\D/g, ''))}
                onBlur={finish}
                onKeyDown={onKeyDown}
              />
              <em>kr</em>
            </label>
          ) : (
            <button
              type="button"
              className="budget-plan-field"
              onClick={startEdit}
              aria-label={`Endre plan ${label}`}
            >
              {formatNokPlain(plan)}
              <em>kr</em>
            </button>
          )}
        </div>
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
