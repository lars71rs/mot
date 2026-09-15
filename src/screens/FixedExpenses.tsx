import { useState } from 'react'
import { AmountField } from '../components/AmountField'
import { amountFromField, formatNok } from '../format'
import { useStore } from '../store'
import { newId } from '../storage'
import type { FixedExpense } from '../types'

const SUGGESTIONS = ['Husleie', 'Studielån', 'Mobil', 'Kollektiv']

export function FixedExpenses({
  fromOnboarding,
  onNext,
  onBack,
}: {
  fromOnboarding: boolean
  onNext: () => void
  onBack: () => void
}) {
  const { state, setFixed, completeOnboarding } = useStore()
  const [rows, setRows] = useState<FixedExpense[]>(
    state.fixed.length > 0 ? state.fixed : [],
  )
  const [draftName, setDraftName] = useState('')
  const [draftAmount, setDraftAmount] = useState('')

  const total = rows.reduce((s, r) => s + r.amount, 0)

  function addRow(name: string, amount: number) {
    if (!name.trim() || amount <= 0) return
    setRows((prev) => [...prev, { id: newId(), name: name.trim(), amount }])
    setDraftName('')
    setDraftAmount('')
  }

  return (
    <main className="screen">
      <button type="button" className="back" onClick={onBack}>
        Tilbake
      </button>
      <p className="kicker">{fromOnboarding ? 'Steg 2 av 2' : 'Oppsett'}</p>
      <h1>Faste utgifter</h1>
      <p className="lede">
        Det som går ut hver måned, før du kan bruke noe. Tom liste går fint —
        da er alt dagsforbruk.
      </p>

      <ul className="rows">
        {rows.map((row) => (
          <li key={row.id} className="row">
            <span>
              <strong>{row.name}</strong>
              <em>{formatNok(row.amount)}</em>
            </span>
            <button
              type="button"
              className="text-btn"
              onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
            >
              Fjern
            </button>
          </li>
        ))}
      </ul>

      {rows.length === 0 && (
        <div className="chips">
          {SUGGESTIONS.map((name) => (
            <button
              key={name}
              type="button"
              className="chip"
              onClick={() => setDraftName(name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <div className="add-fixed">
        <input
          className="text-input"
          placeholder="Navn, f.eks. husleie"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
        />
        <AmountField value={draftAmount} onChange={setDraftAmount} />
        <button
          type="button"
          className="btn-secondary"
          disabled={!draftName.trim() || amountFromField(draftAmount) <= 0}
          onClick={() => addRow(draftName, amountFromField(draftAmount))}
        >
          Legg til
        </button>
      </div>

      <p className="sum">Faste til sammen {formatNok(total)}</p>

      <div className="stack">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setFixed(rows)
            if (fromOnboarding) completeOnboarding()
            onNext()
          }}
        >
          {fromOnboarding ? 'Vis dagsgrensen' : 'Lagre'}
        </button>
      </div>
    </main>
  )
}

