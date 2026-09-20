import { useState, type FormEvent } from 'react'

export function Profile({ onNext }: { onNext: (name: string, birthYear: number) => void }) {
  const [name, setName] = useState('')
  const [year, setYear] = useState('')
  const y = Number(year)
  const ok = name.trim().length > 0 && y >= 1940 && y <= 2015

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!ok) return
    onNext(name.trim(), y)
  }

  return (
    <main className="screen welcome">
      <p className="wordmark">Mot</p>
      <h1>Hvem er du?</h1>
      <p className="lede">Bare fornavn og hvilket år du er født. Ikke dato.</p>
      <form onSubmit={submit}>
        <label className="field-label" htmlFor="mot-name">
          Navn
        </label>
        <input
          id="mot-name"
          className="text-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="given-name"
          autoFocus
        />
        <label className="field-label" htmlFor="mot-year">
          Fødselsår
        </label>
        <input
          id="mot-year"
          className="text-input"
          inputMode="numeric"
          placeholder="2002"
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
        />
        <div className="stack">
          <button type="submit" className="btn-primary" disabled={!ok}>
            Videre til ministeren
          </button>
        </div>
      </form>
    </main>
  )
}
