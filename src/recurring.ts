import { guessCategory } from './bankCsv'
import { isOut, PATTERN_MONTHS_NEEDED } from './map'
import type { Expense, ExpenseCategory } from './types'

export type FixedFact = {
  name: string
  amount: number
  months: number
  category: ExpenseCategory | null
}

const MONTH_WORD =
  /\b(?:januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|aug|sep|okt|nov|des)\b/gi
const MAX_TX_PER_MONTH = 2

export function merchantKey(note: string): string {
  return note
    .toLowerCase()
    .replace(MONTH_WORD, ' ')
    .replace(/\bnr\.?:?\s*[\d\s.]*/g, ' ')
    .replace(/\bkid:?\s*[\d\s]*/gi, ' ')
    .replace(/\b\d{4,}\b/g, ' ')
    .replace(/[^a-zæøå0-9* ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

function amountClose(a: number, typical: number): boolean {
  const slack = Math.max(100, Math.round(typical * 0.15))
  return Math.abs(a - typical) <= slack
}

function displayName(notes: string[]): string {
  const counts = new Map<string, number>()
  for (const n of notes) {
    const t = n.replace(/\s+/g, ' ').trim()
    if (!t) continue
    counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  let best = notes[0]?.trim() || 'Fast utgift'
  let n = 0
  for (const [k, c] of counts) {
    if (c > n || (c === n && k.length < best.length)) {
      best = k
      n = c
    }
  }
  return best.replace(/\bnr\.?:?\s*[\d\s.]+/gi, ' ').replace(/\s+/g, ' ').trim() || best
}

/** Posts that hit at least 3 months, ~once a month, similar amount. Not groceries. */
export function fixedFacts(expenses: Pick<Expense, 'amount' | 'date' | 'direction' | 'note'>[]): FixedFact[] {
  const groups = new Map<string, { note: string; amount: number; month: string }[]>()
  for (const e of expenses) {
    if (!isOut(e)) continue
    const month = e.date.slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(month)) continue
    const key = merchantKey(e.note ?? '')
    if (key.length < 3) continue
    const list = groups.get(key) ?? []
    list.push({ note: e.note ?? key, amount: e.amount, month })
    groups.set(key, list)
  }

  const facts: FixedFact[] = []
  for (const hits of groups.values()) {
    const byMonth = new Map<string, { amount: number; n: number; notes: string[] }>()
    for (const h of hits) {
      const cur = byMonth.get(h.month) ?? { amount: 0, n: 0, notes: [] }
      cur.amount += h.amount
      cur.n += 1
      cur.notes.push(h.note)
      byMonth.set(h.month, cur)
    }
    const months = [...byMonth.values()]
    if (months.length < PATTERN_MONTHS_NEEDED) continue
    if (median(months.map((m) => m.n)) > MAX_TX_PER_MONTH) continue
    const typical = median(months.map((m) => m.amount))
    if (typical <= 0) continue
    const stable = months.filter((m) => amountClose(m.amount, typical))
    if (stable.length < PATTERN_MONTHS_NEEDED) continue
    const name = displayName(stable.flatMap((m) => m.notes))
    facts.push({
      name,
      amount: typical,
      months: stable.length,
      category: guessCategory(name),
    })
  }

  return facts.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'nb'))
}
