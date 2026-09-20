import { useState } from 'react'
import { guessCategory, parseBankStatement, type BankRow } from '../bankCsv'
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
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      setError('Excel støttes ikke ennå. Bruk PDF eller CSV fra nettbanken.')
      return
    }
    let parsed
    if (name.endsWith('.pdf') || file.type === 'application/pdf') {
      const pdfBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const s = String(reader.result || '')
          const i = s.indexOf(',')
          resolve(i >= 0 ? s.slice(i + 1) : s)
        }
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      const res = await fetch('/api/parse-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64 }),
      })
      parsed = (await res.json()) as { rows?: BankRow[]; skipped?: number; error?: string }
      if (!res.ok || parsed.error) {
        setError(parsed.error || 'Klarte ikke å lese PDF-en.')
        return
      }
    } else {
      const text = await file.text()
      parsed = parseBankStatement(text)
    }
    if (parsed.error) {
      setError(parsed.error)
      return
    }
    const rows = parsed.rows ?? []
    const out = rows.filter((r) => r.direction === 'out')
    const inn = rows.filter((r) => r.direction === 'in')
    if (out.length === 0) {
      setError('Filen har ingen utgående beløp å legge i forbruk.')
      return
    }
    setOutgoing(out)
    setIncoming(inn.length)
    setSkipped(parsed.skipped ?? 0)
  }

  function commit() {
    if (!outgoing) return
    const r = importExpenses(
      outgoing.map((row) => ({
        amount: row.amount,
        date: row.date,
        category: guessCategory(row.text),
        note: row.text,
        direction: 'out' as const,
      })),
    )
    setResult(r)
  }

  return (
    <main className="screen">
      <p className="kicker">Bank</p>
      <h1>Dump en fil fra nettbanken</h1>
      <p className="lede">
        Slipp kontoutskrift som PDF, eller CSV/TXT fra nettbanken. Mot leser utgående
        beløp. Inn på konto (lønn) er ikke forbruk. Vi logger ikke inn i banken.
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
          accept=".csv,.txt,.pdf,text/csv,text/plain,application/pdf"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void readFile(file)
            e.target.value = ''
          }}
        />
        Slipp PDF, CSV eller TXT her, eller klikk for å velge fil
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
