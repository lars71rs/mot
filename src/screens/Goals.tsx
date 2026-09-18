import { monthlySavingFor, planDoesNotFit } from '../engine'
import { formatDuration, formatNok } from '../format'
import { useStore } from '../store'
import { GOAL_TYPES } from '../types'

export function Goals({
  onEdit,
}: {
  onHome?: () => void
  onBudget?: () => void
  onSettings?: () => void
  onEdit: (id: string | 'new') => void
}) {
  const { state, activateGoal, removeGoal } = useStore()
  const fixedTotal = state.fixed.reduce((s, f) => s + f.amount, 0)

  return (
    <div className="shell">
      <main className="screen">
        <p className="kicker">Mål</p>
        <h1>Ett aktivt mål styrer dagsgrensen</h1>
        <p className="lede">
          Trykk på et mål for å endre navn, beløp, allerede spart og tid.
          Allerede spart skriver du selv.
        </p>

        {state.goals.length === 0 ? (
          <p className="empty">Ingen mål ennå. Uten mål er dagsgrensen løsere.</p>
        ) : (
          <ul className="goal-list">
            {state.goals.map((g) => {
              const saving = monthlySavingFor(g)
              const title =
                g.name.trim() ||
                GOAL_TYPES.find((t) => t.id === g.type)?.label ||
                'Mål'
              const impossible = planDoesNotFit(g, state.monthlyIncome, fixedTotal)
              return (
                <li
                  key={g.id}
                  className={`goal-card ${g.active ? 'goal-on' : ''} ${impossible ? 'goal-impossible' : ''}`}
                >
                  <button
                    type="button"
                    className="goal-main"
                    onClick={() => onEdit(g.id)}
                  >
                    <strong>
                      {title}
                      {g.active ? ' · styrer dagsgrensen' : ''}
                    </strong>
                    <span>
                      {formatNok(g.alreadySaved)} av {formatNok(g.targetAmount)} ·{' '}
                      {formatDuration(g.months)}
                    </span>
                    <span>{formatNok(saving)} i måneden</span>
                    {impossible && (
                      <span className="goal-warn">Planen går ikke opp</span>
                    )}
                  </button>
                  <div className="goal-actions">
                    {g.active ? (
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => activateGoal(null)}
                      >
                        Ikke styr dagsgrensen
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => activateGoal(g.id)}
                      >
                        Bruk i motoren
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-btn"
                      onClick={() => {
                        if (confirm('Slette dette målet?')) removeGoal(g.id)
                      }}
                    >
                      Slett
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <div className="stack">
          <button type="button" className="btn-primary" onClick={() => onEdit('new')}>
            Nytt mål
          </button>
        </div>
      </main>
    </div>
  )
}
