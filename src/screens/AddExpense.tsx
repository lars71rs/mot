import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AmountField } from '../components/AmountField'
import { amountFromField, toISODate } from '../format'
import { useStore } from '../store'
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '../types'

export function AddExpense({
  onDone,
  onBack,
}: {
  onDone: () => void
  onBack: () => void
}) {
  const { addExpense } = useStore()
  const [raw, setRaw] = useState('')
  const [category, setCategory] = useState<ExpenseCategory | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const amount = amountFromField(raw)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function save() {
    if (amount <= 0) return
    addExpense(amount, toISODate(new Date()), category)
    onDone()
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save()
  }

  return (
    <main className="screen">
      <button type="button" className="back" onClick={onBack}>
        Tilbake
      </button>
      <p className="kicker">Forbruk</p>
      <h1>Legg inn utgift</h1>
      <form onSubmit={onSubmit}>
        <AmountField
          value={raw}
          onChange={setRaw}
          large
          autoFocus
          inputRef={inputRef}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              save()
            }
          }}
        />

        <p className="field-label">Kategori · valgfritt</p>
        <div className="chips">
          {EXPENSE_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`chip ${category === c.id ? 'chip-on' : ''}`}
              onClick={() => setCategory((prev) => (prev === c.id ? null : c.id))}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="stack">
          <button type="submit" className="btn-primary" disabled={amount <= 0}>
            Lagre
          </button>
        </div>
      </form>
    </main>
  )
}
