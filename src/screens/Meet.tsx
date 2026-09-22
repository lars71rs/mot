import { useEffect, useRef, useState, type DragEvent } from 'react'
import { decodeBankBytes, guessCategory, type BankRow } from '../bankCsv'
import { monthName } from '../format'
import { useStore } from '../store'

type ChatMsg = { role: 'user' | 'assistant'; content: string }

const CHAT_KEY = 'mot.chat.v1'
const PATH_RE = /^(?:~|\/|[A-Za-z]:[\\/]|file:\/\/).+\.(pdf|csv|txt)$/i
const MAX_FILE = 8 * 1024 * 1024

function localDay(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function looksLikeFilePath(s: string): boolean {
  return PATH_RE.test(s.trim())
}

function loadChat(): ChatMsg[] {
  try {
    const raw = localStorage.getItem(CHAT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ChatMsg[]
    return Array.isArray(parsed) ? parsed.filter((m) => m.role && m.content) : []
  } catch {
    return []
  }
}

function lastMonthLabel(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return monthName(d)
}

function persist(msgs: ChatMsg[]) {
  const trimmed = msgs.slice(-40)
  localStorage.setItem(CHAT_KEY, JSON.stringify(trimmed))
  return trimmed
}

export function Meet({ onMap }: { onMap: () => void }) {
  const { state, replaceState, importExpenses } = useStore()
  const [messages, setMessages] = useState<ChatMsg[]>(() => loadChat())
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyLabel, setBusyLabel] = useState('Ministeren leser…')
  const [error, setError] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef(state)
  const messagesRef = useRef(messages)
  const runningRef = useRef(false)
  const queueRef = useRef<{ text: string; csv?: string; logged?: boolean }[]>([])
  stateRef.current = state
  messagesRef.current = messages
  const hello = state.displayName ? `Hei ${state.displayName}.` : 'Hei.'

  useEffect(() => {
    persist(messages)
  }, [messages])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [messages, busy])

  function commitMsgs(next: ChatMsg[]) {
    const saved = persist(next)
    messagesRef.current = saved
    setMessages(saved)
  }

  function pushLocal(user: string, assistant: string) {
    commitMsgs([
      ...messagesRef.current,
      { role: 'user', content: user },
      { role: 'assistant', content: assistant },
    ])
  }

  async function runTurn(text: string, csv?: string, logged?: boolean) {
    if (!logged) {
      const userMsg: ChatMsg = { role: 'user', content: text }
      commitMsgs([...messagesRef.current, userMsg])
    }
    setError(null)
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 180_000)
    try {
      const res = await fetch('/api/minister', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ac.signal,
        body: JSON.stringify({
          messages: messagesRef.current.map((m) => ({ role: m.role, content: m.content })),
          snapshot: stateRef.current,
          csv,
          now: localDay(),
        }),
      })
      const data = (await res.json()) as {
        text?: string
        snapshot?: typeof state
        error?: string
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      if (data.snapshot) {
        const snap = { ...data.snapshot, onboarded: true }
        stateRef.current = snap
        replaceState(snap)
        if (snap.expenses.length > 0) setMapReady(true)
      }
      commitMsgs([
        ...messagesRef.current,
        { role: 'assistant', content: data.text || 'Kartet er oppdatert.' },
      ])
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError'
      const msg = aborted
        ? 'Det tok for lang tid. Prøv igjen — kortere spørsmål, eller dump filen på nytt.'
        : err instanceof Error
          ? err.message
          : 'Noe gikk galt'
      setError(msg)
      commitMsgs([...messagesRef.current, { role: 'assistant', content: msg }])
    } finally {
      clearTimeout(timer)
    }
  }

  async function drain() {
    if (runningRef.current) return
    runningRef.current = true
    setBusy(true)
    setBusyLabel('Ministeren leser…')
    while (queueRef.current.length > 0) {
      const job = queueRef.current.shift()
      if (job) await runTurn(job.text, job.csv, job.logged)
    }
    runningRef.current = false
    setBusy(false)
  }

  function send(text: string, csv?: string, logged?: boolean) {
    const trimmed = text.trim()
    if (!trimmed && !csv) return
    if (looksLikeFilePath(trimmed) && !csv) {
      setDraft('')
      setError(null)
      pushLocal(
        trimmed,
        'Det er bare en filsti — jeg får ikke åpnet den. Bruk Fil, eller slipp PDF-en på chatten.',
      )
      return
    }
    queueRef.current.push({ text: trimmed, csv, logged })
    setDraft('')
    void drain()
  }

  async function onDropFile(file: File) {
    const lower = file.name.toLowerCase()
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      setError('Excel støttes ikke ennå. Bruk PDF eller CSV fra nettbanken.')
      return
    }
    if (file.size > MAX_FILE) {
      pushLocal(file.name, 'Filen er for stor (maks 8 MB). Eksporter en kortere periode.')
      return
    }

    await ingestFile(file)
  }

  async function ingestFile(file: File) {
    const lower = file.name.toLowerCase()
    const isPdf = lower.endsWith('.pdf') || file.type === 'application/pdf'
    commitMsgs([...messagesRef.current, { role: 'user', content: `Dumper ${file.name}` }])
    setBusy(true)
    setBusyLabel(`Leser ${file.name}…`)
    setError(null)
    try {
      const payload = isPdf
        ? { pdfBase64: await fileToBase64(file) }
        : { text: decodeBankBytes(await file.arrayBuffer()) }
      const res = await fetch('/api/parse-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as {
        rows?: BankRow[]
        error?: string
        text?: string
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      const rows = data.rows ?? []
      const text = data.text?.trim() || ''
      if (rows.length > 0) {
        const result = importExpenses(
          rows.map((row) => ({
            amount: row.amount,
            date: row.date,
            category: row.direction === 'in' ? null : guessCategory(row.text),
            note: row.text,
            direction: row.direction,
          })),
        )
        setMapReady(true)
        const inn = rows.filter((r) => r.direction === 'in').length
        const ut = rows.filter((r) => r.direction === 'out').length
        const summary = `Leste ${file.name}: ${result.added} nye poster (${ut} ut, ${inn} inn)${
          result.duplicates ? `, ${result.duplicates} duplikater hoppet over` : ''
        }. Kartet er oppdatert.`
        commitMsgs([...messagesRef.current, { role: 'assistant', content: summary }])
        send(
          `Jeg dumpet ${file.name}. ${result.added} poster er på kartet (${ut} ut, ${inn} inn). Si hva du ser, og hva som ser fast ut.`,
          undefined,
          true,
        )
        return
      }
      if (!text) {
        commitMsgs([
          ...messagesRef.current,
          {
            role: 'assistant',
            content: isPdf
              ? 'PDF-en har ikke lesbar tekst (sannsynligvis et bilde/skann). Eksporter CSV fra nettbanken.'
              : 'Fant ingen transaksjoner i filen.',
          },
        ])
        setBusy(false)
        return
      }
      send(
        `Jeg dumpet ${file.name}, men den automatiske lesingen fant ingen rader. Her er teksten.`,
        text,
        true,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Klarte ikke å lese filen.'
      setError(msg)
      commitMsgs([...messagesRef.current, { role: 'assistant', content: msg }])
      setBusy(false)
    }
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

  function onFileDragOver(e: DragEvent) {
    if ([...e.dataTransfer.types].includes('Files')) {
      e.preventDefault()
      e.stopPropagation()
      setDrag(true)
    }
  }

  function onFileDrop(e: DragEvent) {
    if (![...e.dataTransfer.types].includes('Files')) return
    e.preventDefault()
    e.stopPropagation()
    setDrag(false)
    const file = e.dataTransfer.files[0]
    if (file) void onDropFile(file)
  }

  return (
    <div className="meet meet-solo">
      <section
        className={`meet-chat ${drag ? 'dropzone-on' : ''}`}
        onDragOver={onFileDragOver}
        onDragEnter={onFileDragOver}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return
          setDrag(false)
        }}
        onDrop={onFileDrop}
      >
        <h1>Finansminister</h1>
        <div className="meet-log" ref={logRef}>
          {messages.length === 0 && (
            <>
              <p className="lede">
                {hello} Kan du legge inn kontoutskriften for {lastMonthLabel()}? PDF eller CSV —
                slipp den her, eller bruk Fil. Ikke lim inn filstien. Jeg tegner kartet etterpå.
              </p>
              <p className="hint">
                Har du ikke en ekte fil ennå? Last ned en{' '}
                <a href={`${import.meta.env.BASE_URL}test-kontoutskrift-august-2026.pdf`} download>
                  test-PDF for august
                </a>{' '}
                eller{' '}
                <a href={`${import.meta.env.BASE_URL}test-kontoutskrift-august-2026.csv`} download>
                  CSV
                </a>
                .
              </p>
            </>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`bubble bubble-${m.role}`}>
              {m.content}
            </div>
          ))}
          {busy && <p className="hint">{busyLabel}</p>}
        </div>
        {error && <p className="warn">{error}</p>}
        {mapReady && (
          <button type="button" className="btn-secondary" onClick={onMap}>
            Se kartet
          </button>
        )}
        <form
          className="meet-compose"
          onSubmit={(e) => {
            e.preventDefault()
            void send(draft)
          }}
        >
          <label className="meet-attach">
            Fil
            <input
              type="file"
              accept=".csv,.txt,.pdf,text/csv,text/plain,application/pdf"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void onDropFile(file)
                e.target.value = ''
              }}
            />
          </label>
          <input
            className="text-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onPaste={(e) => {
              const file = e.clipboardData.files[0]
              if (file) {
                e.preventDefault()
                void onDropFile(file)
              }
            }}
            placeholder="Si noe, eller slipp PDF/CSV"
            disabled={busy}
          />
          <button type="submit" className="btn-primary" disabled={busy || !draft.trim()}>
            Send
          </button>
        </form>
      </section>
    </div>
  )
}
