import { useState } from 'react'
import { formatNok } from '../format'
import { fixedFacts } from '../recurring'
import { useStore } from '../store'

export function Settings({ onReset }: { onReset: () => void }) {
  const { state, setProfile, setSavingsGoal, resetAll } = useStore()
  const [name, setName] = useState(state.displayName)
  const [year, setYear] = useState(state.birthYear ? String(state.birthYear) : '')
  const goal = state.goals.find((g) => g.active) ?? null
  const facts = fixedFacts(state.expenses)
  const [goalName, setGoalName] = useState(goal?.name ?? '')
  const [goalAmount, setGoalAmount] = useState(goal ? String(goal.targetAmount) : '')

  return (
    <main className="screen">
      <p className="kicker">Oppsett</p>
      <h1>Deg og målet</h1>
      <p className="lede">
        Faste og inntekt kommer fra utskriften og ministeren. Her retter du navn, år og
        sparemål.
      </p>

      <label className="field-label" htmlFor="set-name">
        Navn
      </label>
      <input
        id="set-name"
        className="text-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          const y = Number(year)
          if (name.trim()) setProfile(name.trim(), y >= 1940 ? y : state.birthYear ?? 2000)
        }}
      />

      <label className="field-label" htmlFor="set-year">
        Fødselsår
      </label>
      <input
        id="set-year"
        className="text-input"
        inputMode="numeric"
        value={year}
        onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
        onBlur={() => {
          const y = Number(year)
          if (y >= 1940 && y <= 2015) setProfile(name.trim() || state.displayName, y)
        }}
      />

      <label className="field-label" htmlFor="set-goal-name">
        Sparemål
      </label>
      <input
        id="set-goal-name"
        className="text-input"
        placeholder="Egenkapital"
        value={goalName}
        onChange={(e) => setGoalName(e.target.value)}
      />
      <input
        className="text-input"
        inputMode="numeric"
        placeholder="Beløp"
        value={goalAmount}
        onChange={(e) => setGoalAmount(e.target.value)}
        onBlur={() => {
          const amount = Math.round(Number(goalAmount.replace(/\s/g, '')))
          if (amount > 0) setSavingsGoal(goalName.trim() || 'Sparing', amount)
        }}
      />
      {goal ? <p className="hint">Mål: {formatNok(goal.targetAmount)}</p> : null}

      {facts.length > 0 && (
        <p className="hint">
          Faste fra tre treff:{' '}
          {facts.map((f) => `${f.name} ${formatNok(f.amount)}`).join(', ')}
        </p>
      )}
      {state.fixed.length > 0 && (
        <p className="hint">
          Faste ministeren har lagt inn:{' '}
          {state.fixed.map((f) => `${f.name} ${formatNok(f.amount)}`).join(', ')}
        </p>
      )}

      <button
        type="button"
        className="text-btn danger"
        onClick={() => {
          if (confirm('Nullstille appen på denne enheten?')) {
            resetAll()
            onReset()
          }
        }}
      >
        Nullstill appen
      </button>
    </main>
  )
}
