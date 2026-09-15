import { activeGoal, calculate, PLAN_DOES_NOT_FIT } from '../engine'
import { categoryLabel } from '../types'
import {
  formatDays,
  formatDuration,
  formatNok,
  formatNokPlain,
  formatShortDate,
  toISODate,
} from '../format'
import { TabBar } from '../components/TabBar'
import { todayExpenses, useStore } from '../store'

const STATUS_LABEL = {
  ok: 'I rute',
  behind: 'Bak',
  over: 'Over i dag',
} as const

export function Home({
  onAdd,
  onBudget,
  onGoals,
  onSettings,
}: {
  onAdd: () => void
  onBudget: () => void
  onGoals: () => void
  onSettings: () => void
}) {
  const { state, removeExpense } = useStore()
  const now = new Date()
  const today = toISODate(now)
  const goal = activeGoal(state.goals)
  const fixedTotal = state.fixed.reduce((s, f) => s + f.amount, 0)
  const result = calculate({
    monthlyIncome: state.monthlyIncome,
    fixedTotal,
    goal,
    expenses: state.expenses,
    now,
  })
  const todays = todayExpenses(state.expenses, today)
  const blocked = result.noRoom

  return (
    <div className="shell">
      <main className="screen home">
        <header className="home-top">
          <p className="wordmark">Mot</p>
          <p className="date">{formatShortDate(now)}</p>
        </header>

        {blocked ? (
          <section className="blocked">
            <p className="kicker">Dagsgrense</p>
            <h1>{result.noRoom ? 'Ikke rom' : 'Går ikke opp'}</h1>
            <p className="lede">{result.planLine}</p>
            <button type="button" className="btn-secondary" onClick={onSettings}>
              Endre inntekt eller faste
            </button>
          </section>
        ) : (
          <>
            <section className={`hero ${result.overToday ? 'hero-over' : ''}`}>
              <p className="kicker">I dag</p>
              <p className="hero-number">
                {formatNokPlain(result.remainingToday)}
                <span> kr</span>
              </p>
            </section>

            <section className="tomorrow">
              <p className="kicker">I morgen</p>
              <p className="tomorrow-number">{formatNok(result.dailyTomorrow)}</p>
            </section>

            <dl className="meta">
              <div>
                <dt>Denne måneden</dt>
                <dd>
                  {formatNok(result.spentThisMonth)} / {formatNok(result.plannedSoFar)}
                </dd>
              </div>
              {goal && (
                <div>
                  <dt>Mot målet</dt>
                  <dd>
                    {formatNok(goal.alreadySaved)} av {formatNok(goal.targetAmount)} ·{' '}
                    {formatDuration(goal.months)}
                  </dd>
                </div>
              )}
              <div>
                <dt>Status</dt>
                <dd className={`status-${result.status}`}>{STATUS_LABEL[result.status]}</dd>
              </div>
            </dl>

            {result.planImpossible && (
              <section className="consequence" aria-live="polite">
                <p>{PLAN_DOES_NOT_FIT}</p>
                <div className="consequence-actions">
                  <button type="button" className="text-btn" onClick={onGoals}>
                    Endre målet
                  </button>
                  <button type="button" className="text-btn" onClick={onSettings}>
                    Kutt faste
                  </button>
                </div>
              </section>
            )}

            {result.consequence && (
              <section className="consequence" aria-live="polite">
                <p>{result.consequence.headline}</p>
                {result.consequence.thisExpenseDays !== null && (
                  <p>Denne utgiften: målet +{formatDays(result.consequence.thisExpenseDays)}.</p>
                )}
                {result.consequence.ifContinueDays !== null && (
                  <p>
                    Hvis alle dager blir som i dag: +
                    {formatDays(result.consequence.ifContinueDays)}.
                  </p>
                )}
              </section>
            )}
          </>
        )}

        <section className="today-list">
          <div className="today-head">
            <h2>Utgifter i dag</h2>
            <button type="button" className="btn-primary btn-small" onClick={onAdd}>
              Legg inn utgift
            </button>
          </div>
          {todays.length === 0 ? (
            <p className="empty">Ingen utgifter registrert i dag.</p>
          ) : (
            <ul className="rows">
              {todays.map((e) => (
                <li key={e.id} className="row">
                  <span>
                    <strong>{categoryLabel(e.category)}</strong>
                    <em>{formatNok(e.amount)}</em>
                  </span>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => removeExpense(e.id)}
                  >
                    Slett
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <TabBar
        active="home"
        onHome={() => {}}
        onBudget={onBudget}
        onGoals={onGoals}
        onSettings={onSettings}
      />
    </div>
  )
}
