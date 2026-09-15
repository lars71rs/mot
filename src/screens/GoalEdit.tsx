import { useMemo, useState } from 'react'
import { AmountField } from '../components/AmountField'
import { calculate, monthlySavingFor, PLAN_DOES_NOT_FIT } from '../engine'
import { amountFromField, formatDuration, formatNok, formatNokPlain } from '../format'
import { useStore } from '../store'
import { GOAL_TYPES, type GoalType } from '../types'

export function GoalEdit({
  id,
  onDone,
  onBack,
}: {
  id: string | 'new'
  onDone: () => void
  onBack: () => void
}) {
  const { state, saveGoal } = useStore()
  const existing = id === 'new' ? null : state.goals.find((g) => g.id === id) ?? null
  const [type, setType] = useState<GoalType>(existing?.type ?? 'egenkapital')
  const [name, setName] = useState(
    existing?.name || GOAL_TYPES.find((t) => t.id === (existing?.type ?? 'egenkapital'))?.label || '',
  )
  const [target, setTarget] = useState(
    existing ? formatNokPlain(existing.targetAmount) : '',
  )
  const [saved, setSaved] = useState(
    existing ? formatNokPlain(existing.alreadySaved) : '0',
  )
  const [years, setYears] = useState(
    existing ? String(Math.floor(existing.months / 12) || '') : '',
  )
  const [monthsPart, setMonthsPart] = useState(
    existing ? String(existing.months % 12 || '') : '',
  )
  const [activate, setActivate] = useState(existing?.active ?? true)

  const months = (Number(years) || 0) * 12 + (Number(monthsPart) || 0)
  const targetAmount = amountFromField(target)
  const alreadySaved = amountFromField(saved)
  const draft = useMemo(
    () => ({
      type,
      name: name.trim() || GOAL_TYPES.find((t) => t.id === type)?.label || 'Mål',
      targetAmount,
      alreadySaved,
      months,
    }),
    [type, name, targetAmount, alreadySaved, months],
  )
  const saving = monthlySavingFor(draft.months >= 1 && draft.targetAmount > 0 ? draft : null)
  const fixedTotal = state.fixed.reduce((s, f) => s + f.amount, 0)
  const preview =
    draft.months >= 1 && draft.targetAmount > 0
      ? calculate({
          monthlyIncome: state.monthlyIncome,
          fixedTotal,
          goal: draft,
          expenses: state.expenses,
          now: new Date(),
        })
      : null

  const canSave = targetAmount > 0 && alreadySaved >= 0 && months >= 1 && draft.name.length > 0

  function pickType(next: GoalType) {
    const prevLabel = GOAL_TYPES.find((t) => t.id === type)?.label
    setType(next)
    if (!name.trim() || name.trim() === prevLabel) {
      setName(GOAL_TYPES.find((t) => t.id === next)?.label ?? '')
    }
  }

  return (
    <main className="screen">
      <button type="button" className="back" onClick={onBack}>
        Tilbake
      </button>
      <p className="kicker">Mål</p>
      <h1>{existing ? 'Rediger mål' : 'Nytt mål'}</h1>
      <p className="lede">
        Navn, beløp, allerede spart og tid. Lagre oppdaterer dagsgrensen med en
        gang.
      </p>

      <p className="field-label">Type</p>
      <div className="chips">
        {GOAL_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`chip ${type === t.id ? 'chip-on' : ''}`}
            onClick={() => pickType(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <label className="field">
        <span>Navn</span>
        <input
          className="text-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Hva sparer du til?"
        />
      </label>

      <label className="field">
        <span>Målbeløp</span>
        <AmountField value={target} onChange={setTarget} />
      </label>

      <label className="field">
        <span>Allerede spart</span>
        <AmountField value={saved} onChange={setSaved} />
      </label>

      <div className="duration">
        <label className="field">
          <span>År</span>
          <input
            className="text-input"
            inputMode="numeric"
            value={years}
            onChange={(e) => setYears(e.target.value.replace(/\D/g, ''))}
            placeholder="f.eks. 4"
          />
        </label>
        <label className="field">
          <span>Måneder</span>
          <input
            className="text-input"
            inputMode="numeric"
            value={monthsPart}
            onChange={(e) => setMonthsPart(e.target.value.replace(/\D/g, ''))}
            placeholder="0"
          />
        </label>
      </div>

      {preview?.planImpossible && <p className="warn">{PLAN_DOES_NOT_FIT}</p>}
      {preview && !preview.planImpossible && (
        <p className="hint">
          {formatNok(saving)} i måneden i {formatDuration(months)}. Dagsgrense{' '}
          {formatNok(preview.dailyPlan)}.
        </p>
      )}

      <label className="check">
        <input
          type="checkbox"
          checked={activate}
          onChange={(e) => setActivate(e.target.checked)}
        />
        Styr dagsgrensen med dette målet
      </label>

      <div className="stack">
        <button
          type="button"
          className="btn-primary"
          disabled={!canSave}
          onClick={() => {
            saveGoal({
              id: existing?.id,
              type,
              name: draft.name,
              targetAmount,
              alreadySaved,
              months,
              activate,
            })
            onDone()
          }}
        >
          Lagre mål
        </button>
      </div>
    </main>
  )
}
