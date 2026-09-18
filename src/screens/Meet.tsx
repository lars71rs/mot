import { useEffect, useRef, useState } from 'react'
import { formatNok, formatNokPlain, monthName } from '../format'
import { inPocket, spentByCategory, spentThisMonth } from '../map'
import { useStore } from '../store'

type ChatMsg = { role: 'user' | 'assistant'; content: string }

const CHAT_KEY = 'mot.chat.v1'

function localDay(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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

export function Meet() {
  const { state, replaceState } = useStore()
  const [messages, setMessages] = useState<ChatMsg[]>(() => loadChat())
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef(state)
  const messagesRef = useRef(messages)
  const runningRef = useRef(false)
  const queueRef = useRef<{ text: string; csv?: string }[]>([])
  stateRef.current = state
  messagesRef.current = messages
  const now = new Date()
  const spentMonth = spentThisMonth(state.expenses, now)
  const fixedTotal = state.fixed.reduce((s, f) => s + f.amount, 0)
  const pocket = inPocket(state.monthlyIncome, fixedTotal, spentMonth)
  const categories = spentByCategory(state.expenses, now)
  const month = monthName(now)

  useEffect(() => {
    localStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-40)))
  }, [messages])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [messages, busy])

  async function runTurn(text: string, csv?: string) {
    const userMsg: ChatMsg = {
      role: 'user',
      content: csv ? `${text || 'Jeg dumper måneden.'} [bankfil vedlagt]` : text,
    }
    const next = [...messagesRef.current, userMsg]
    messagesRef.current = next
    setMessages(next)
    setError(null)
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 90_000)
    try {
      const res = await fetch('/api/minister', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ac.signal,
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
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
      }
      const reply: ChatMsg = {
        role: 'assistant',
        content: data.text || 'Tavlen er oppdatert.',
      }
      const withReply = [...messagesRef.current, reply]
      messagesRef.current = withReply
      setMessages(withReply)
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError'
      const msg = aborted
        ? 'Det tok for lang tid. Prøv igjen — kortere spørsmål, eller dump filen på nytt.'
        : err instanceof Error
          ? err.message
          : 'Noe gikk galt'
      setError(msg)
      const fail: ChatMsg = { role: 'assistant', content: msg }
      const withFail = [...messagesRef.current, fail]
      messagesRef.current = withFail
      setMessages(withFail)
    } finally {
      clearTimeout(timer)
    }
  }

  async function drain() {
    if (runningRef.current) return
    runningRef.current = true
    setBusy(true)
    while (queueRef.current.length > 0) {
      const job = queueRef.current.shift()
      if (job) await runTurn(job.text, job.csv)
    }
    runningRef.current = false
    setBusy(false)
  }

  function send(text: string, csv?: string) {
    const trimmed = text.trim()
    if (!trimmed && !csv) return
    queueRef.current.push({ text: trimmed, csv })
    setDraft('')
    void drain()
  }

  async function onDropFile(file: File) {
    const name = file.name.toLowerCase()
    if (name.endsWith('.pdf') || name.endsWith('.xlsx') || name.endsWith('.xls')) {
      setError('Bruk CSV eller TXT fra nettbanken.')
      return
    }
    const text = await file.text()
    await send('Jeg dumper måneden fra nettbanken.', text)
  }

  return (
    <div className="meet">
      <section className="meet-chat">
        <h1>Finansminister</h1>
        <div
          className={`meet-log ${drag ? 'dropzone-on' : ''}`}
          ref={logRef}
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            const file = e.dataTransfer.files[0]
            if (file) void onDropFile(file)
          }}
        >
          {messages.length === 0 && (
            <p className="lede">
              Dump måneden her, eller si hva du lurer på. Jeg leser tavlen og kan flytte på
              den.
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`bubble bubble-${m.role}`}>
              {m.content}
            </div>
          ))}
          {busy && <p className="hint">Ministeren leser…</p>}
        </div>
        {error && <p className="warn">{error}</p>}
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
              accept=".csv,.txt,text/csv,text/plain"
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
            placeholder="Si noe, eller slipp en bankfil"
            disabled={busy}
          />
          <button type="submit" className="btn-primary" disabled={busy || !draft.trim()}>
            Send
          </button>
        </form>
      </section>

      <aside className="meet-board">
        <p className="kicker">Tavlen · {month}</p>
        <p className="meet-spent">
          {formatNokPlain(spentMonth)}
          <span> kr brukt</span>
        </p>
        <dl className="meta">
          <div>
            <dt>Inntekt</dt>
            <dd>{formatNok(state.monthlyIncome)}</dd>
          </div>
          <div>
            <dt>Faste</dt>
            <dd>{formatNok(fixedTotal)}</dd>
          </div>
          <div>
            <dt>Forbruk</dt>
            <dd>{formatNok(spentMonth)}</dd>
          </div>
          <div className={pocket < 0 ? 'pocket-over' : ''}>
            <dt>I lomma</dt>
            <dd>{formatNok(pocket)}</dd>
          </div>
        </dl>
        <ul className="rows">
          {categories.map((row) => (
            <li key={row.key} className="row">
              <span>
                <strong>{row.label}</strong>
              </span>
              <em>{formatNok(row.amount)}</em>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
