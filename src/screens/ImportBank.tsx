import { useState } from 'react'
import { guessCategory, parseBankCsv, type BankRow } from '../bankCsv'
import { formatNok } from '../format'
import { useStore } from '../store'

export function ImportBank({ onDone }: { onDone: () => void }) {
  const { importExpenses } = useStore()
  const [drag, setDrag] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outgoing, setOutgoing] = useState<BankRow[] | null>(null)
  const [incoming, setIncoming] = useState(0)
  const [skipped, setSkipped] = useState(0)
  const [result, setResult] = useState<{ added: number; duplicates: number } | null>(null)

  async function readFile(file: File) {
    setError(null)
    setResult(null)
    setOutgoing(null)
    const name = file.name.toLowerCase()
    if (name.endsWith('.pdf') || name.endsWith('.xlsx') || name.endsWith('.xls')) {
      setError('Bruk CSV eller TXT fra nettbanken. PDF og Excel leser vi ikke ennå.')
      return
    }
    const text = await file.text()
    const parsed = parseBankCsv(text)
    if (parsed.error) {
      setError(parsed.error)
      return
    }
    const out = parsed.rows.filter((r) => r.direction === 'out')
    const inn = parsed.rows.filter((r) => r.direction === 'in')
    if (out.length === 0) {
      setError('Filen har ingen utgående beløp å legge i forbruk.')
      return
    }
    setOutgoing(out)
    setIncoming(inn.length)
    setSkipped(parsed.skipped)
  }

  function commit() {
    if (!outgoing) return
    const r = importExpenses(
      outgoing.map((row) => ({
        amount: row.amount,
        date: row.date,
        category: guessCategory(row.text),
        note: row.text,
      })),
    )
    setResult(r)
  }

  return (
    <main className="screen">
      <p className="kicker">Bank</p>
      <h1>Dump en fil fra nettbanken</h1>
      <p className="lede">
        I nettbanken: konto → transaksjoner → eksporter CSV (DNB kaller det ofte «til CSV» og
        laster ned en .txt). Mot leser utgående beløp. Inn på konto, for eksempel lønn, går
        ikke inn som forbruk — og vi logger ikke inn i banken.
      </p>

      <label
        className={`dropzone ${drag ? 'dropzone-on' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          const file = e.dataTransfer.files[0]
          if (file) void readFile(file)
        }}
      >
        <input
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void readFile(file)
            e.target.value = ''
          }}
        />
        Slipp CSV eller TXT her, eller klikk for å velge fil
      </label>

      {error && <p className="warn">{error}</p>}

      {outgoing && !result && (
        <>
          <p className="hint">
            {outgoing.length} utgifter klare
            {incoming > 0 ? ` · ${incoming} innbetalinger hoppes over` : ''}
            {skipped > 0 ? ` · ${skipped} rader uten dato/beløp` : ''}
          </p>
          <ul className="rows">
            {outgoing.slice(0, 8).map((row, i) => (
              <li key={`${row.date}-${i}`} className="row">
                <span>
                  <strong>{row.text || 'Utgift'}</strong>
                  <em>{row.date}</em>
                </span>
                <em>{formatNok(row.amount)}</em>
              </li>
            ))}
          </ul>
          {outgoing.length > 8 && (
            <p className="hint">…og {outgoing.length - 8} til</p>
          )}
          <div className="stack">
            <button type="button" className="btn-primary" onClick={commit}>
              Legg inn i kartet
            </button>
          </div>
        </>
      )}

      {result && (
        <>
          <p className="lede">
            {result.added} utgifter lagt inn
            {result.duplicates > 0 ? ` · ${result.duplicates} var der fra før` : ''}.
          </p>
          <div className="stack">
            <button type="button" className="btn-primary" onClick={onDone}>
              Til oversikten
            </button>
          </div>
        </>
      )}
    </main>
  )
}
