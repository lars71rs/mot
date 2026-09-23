import { useState } from 'react'
import { decodeBankBytes, guessCategory, parseBankStatement, type BankRow } from '../bankCsv'
import { formatNok } from '../format'
import { coverageCopy, dataCoverage } from '../map'
import { armDumpKick } from '../dumpKick'
import { useStore } from '../store'

const MAX_FILE = 8 * 1024 * 1024

export function ImportBank({
  onDone,
  onTalk,
  onAfterDump,
}: {
  onDone: () => void
  onTalk?: () => void
  onAfterDump?: () => void
}) {
  const { state, importExpenses } = useStore()
  const cover = dataCoverage(state.expenses)
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<BankRow[] | null>(null)
  const [skipped, setSkipped] = useState(0)
  const [result, setResult] = useState<{ added: number; duplicates: number } | null>(null)

  async function readFile(file: File) {
    setError(null)
    setResult(null)
    setRows(null)
    setFileName(file.name)
    const name = file.name.toLowerCase()
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      setError('Excel støttes ikke ennå. Eksporter PDF eller CSV fra nettbanken.')
      return
    }
    if (file.size > MAX_FILE) {
      setError('Filen er for stor (maks 8 MB). Eksporter en kortere periode.')
      return
    }
    setBusy(true)
    try {
      let parsed
      if (name.endsWith('.pdf') || file.type === 'application/pdf') {
        const pdfBase64 = await fileToBase64(file)
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
        const text = decodeBankBytes(await file.arrayBuffer())
        parsed = parseBankStatement(text)
      }
      if (parsed.error) {
        setError(parsed.error)
        return
      }
      const next = parsed.rows ?? []
      if (next.length === 0) {
        setError('Fant ingen transaksjoner i filen.')
        return
      }
      setRows(next)
      setSkipped(parsed.skipped ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Klarte ikke å lese filen.')
    } finally {
      setBusy(false)
    }
  }

  function commit() {
    if (!rows) return
    const r = importExpenses(
      rows.map((row) => ({
        amount: row.amount,
        date: row.date,
        category: row.direction === 'in' ? null : guessCategory(row.text),
        note: row.text,
        direction: row.direction,
      })),
    )
    setResult(r)
    if (onAfterDump && (r.added > 0 || r.duplicates > 0)) {
      armDumpKick()
      onAfterDump()
    }
  }

  const incoming = rows?.filter((r) => r.direction === 'in').length ?? 0
  const outgoing = rows?.filter((r) => r.direction === 'out').length ?? 0

  return (
    <main className="screen dump">
      <p className="kicker">Kontoutskrift</p>
      <h1>Legg inn bankfilen</h1>
      <p className="lede">
        Slipp PDF eller CSV fra nettbanken. Én måned er et bilde. Tre måneder er et mønster.
        Du kan legge inn flere filer etter hverandre. Vi logger ikke inn i banken.
      </p>
      {cover.monthCount > 0 && <p className="hint">{coverageCopy(cover)}</p>}

      <label
        className={`dropzone dump-drop ${drag ? 'dropzone-on' : ''} ${busy ? 'is-busy' : ''}`}
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
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void readFile(file)
            e.target.value = ''
          }}
        />
        {busy
          ? `Leser ${fileName ?? 'filen'}…`
          : fileName
            ? `Valgt: ${fileName}. Slipp en ny fil for å bytte.`
            : 'Slipp PDF eller CSV her, eller klikk for å velge'}
      </label>

      <p className="hint">
        Test uten ekte bank?{' '}
        <a href={`${import.meta.env.BASE_URL}test-kontoutskrift-august-2026.pdf`} download>
          PDF
        </a>
        {' · '}
        <a href={`${import.meta.env.BASE_URL}test-kontoutskrift-august-2026.csv`} download>
          CSV
        </a>
      </p>

      {error && <p className="warn">{error}</p>}

      {rows && !result && (
        <>
          <p className="hint">
            {rows.length} poster klare
            {outgoing ? ` · ${outgoing} ut` : ''}
            {incoming ? ` · ${incoming} inn` : ''}
            {skipped > 0 ? ` · ${skipped} rader uten dato/beløp` : ''}
          </p>
          <ul className="rows">
            {rows.slice(0, 12).map((row, i) => (
              <li key={`${row.date}-${i}`} className="row">
                <span>
                  <strong>{row.text || (row.direction === 'in' ? 'Inn' : 'Utgift')}</strong>
                  <em>{row.date}</em>
                </span>
                <em className={row.direction === 'in' ? 'is-in' : 'is-out'}>
                  {row.direction === 'in' ? '+' : '−'} {formatNok(row.amount)}
                </em>
              </li>
            ))}
          </ul>
          {rows.length > 12 && <p className="hint">…og {rows.length - 12} til</p>}
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
            {result.added} poster lagt inn
            {result.duplicates > 0 ? ` · ${result.duplicates} var der fra før` : ''}.{' '}
            {coverageCopy(cover)}
          </p>
          <div className="stack">
            <button type="button" className="btn-primary" onClick={onDone}>
              Til kartet
            </button>
            {onTalk && (
              <button type="button" className="btn-ghost" onClick={onTalk}>
                Snakk med ministeren
              </button>
            )}
          </div>
        </>
      )}
    </main>
  )
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const s = String(reader.result || '')
      const i = s.indexOf(',')
      resolve(i >= 0 ? s.slice(i + 1) : s)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
