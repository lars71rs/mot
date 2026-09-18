import type { ExpenseCategory } from './types'

export type BankRow = {
  date: string
  amount: number
  text: string
  direction: 'out' | 'in'
}

export type ParseResult = {
  rows: BankRow[]
  skipped: number
  error: string | null
}

const DATE_KEYS = ['dato', 'bokført', 'bokfort', 'booked', 'date', 'rentedato', 'valuedate']
const TEXT_KEYS = ['forklaring', 'beskrivelse', 'tekst', 'text', 'melding', 'beskrivning']
const OUT_KEYS = ['ut av konto', 'utavkonto', 'ut', 'debit', 'withdrawals']
const IN_KEYS = ['inn på konto', 'innpakonto', 'inn', 'kredit', 'deposits']
const AMOUNT_KEYS = ['beløp', 'belop', 'amount', 'sum']

function stripBom(s: string): string {
  return s.replace(/^\uFEFF/, '')
}

function detectDelim(header: string): string {
  const semi = (header.match(/;/g) ?? []).length
  const comma = (header.match(/,/g) ?? []).length
  const tab = (header.match(/\t/g) ?? []).length
  if (tab > semi && tab > comma) return '\t'
  return semi >= comma ? ';' : ','
}

function splitLine(line: string, delim: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQ = !inQ
      continue
    }
    if (ch === delim && !inQ) {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur.trim())
  return out
}

function normKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function findCol(headers: string[], keys: string[]): number {
  const n = headers.map(normKey)
  for (const k of keys) {
    const i = n.findIndex((h) => h === k || h.replace(/ /g, '') === k.replace(/ /g, ''))
    if (i >= 0) return i
  }
  for (const k of keys) {
    const i = n.findIndex((h) => h.includes(k))
    if (i >= 0) return i
  }
  return -1
}

export function parseNokAmount(raw: string): number | null {
  const t = raw.replace(/\s/g, '').replace(/kr/gi, '')
  if (!t) return null
  const neg = t.startsWith('-') || t.startsWith('−')
  const unsigned = t.replace(/^[-−]/, '')
  let n: number
  if (unsigned.includes(',') && unsigned.includes('.')) {
    n = Number(unsigned.replace(/\./g, '').replace(',', '.'))
  } else if (unsigned.includes(',')) {
    n = Number(unsigned.replace(',', '.'))
  } else {
    n = Number(unsigned)
  }
  if (!Number.isFinite(n)) return null
  const v = Math.round(Math.abs(n))
  return neg ? -v : v
}

export function parseBankDate(raw: string): string | null {
  const t = raw.trim()
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const dot = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/)
  if (dot) {
    const d = dot[1].padStart(2, '0')
    const m = dot[2].padStart(2, '0')
    let y = dot[3]
    if (y.length === 2) y = Number(y) > 50 ? `19${y}` : `20${y}`
    return `${y}-${m}-${d}`
  }
  const slash = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (slash) {
    const d = slash[1].padStart(2, '0')
    const m = slash[2].padStart(2, '0')
    let y = slash[3]
    if (y.length === 2) y = `20${y}`
    return `${y}-${m}-${d}`
  }
  return null
}

export function guessCategory(text: string): ExpenseCategory | null {
  const t = text.toLowerCase()
  if (
    /rema|kiwi|coop|meny|spar |bunnpris|matkroken|joker|extra|ica |holdbart|oda /.test(t)
  ) {
    return 'mat'
  }
  if (
    /\bvy\b|ruter|atb|kollektiv|nsb|flytoget|circle k|shell|esso|uno-x|biltur|parkering|bolt|uber/.test(
      t,
    )
  ) {
    return 'transport'
  }
  if (/h&m|zara|cubus|dressmann|bikbok|ginatricot|kappahl|weekday/.test(t)) return 'klaer'
  if (
    /vinmonopolet|starbucks|espresso|mcdonald|burger|kafé|kafe|barista|utested|night|polet|spotify|netflix|hbo|iskrem|\bis\b|kiosk/.test(
      t,
    )
  ) {
    return 'fritid'
  }
  return null
}

export function parseBankCsv(raw: string): ParseResult {
  const text = stripBom(raw).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = text.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length < 2) {
    return { rows: [], skipped: 0, error: 'Filen er tom, eller mangler rader.' }
  }
  const delim = detectDelim(lines[0])
  const headers = splitLine(lines[0], delim)
  const dateI = findCol(headers, DATE_KEYS)
  const textI = findCol(headers, TEXT_KEYS)
  const outI = findCol(headers, OUT_KEYS)
  const inI = findCol(headers, IN_KEYS)
  const amountI = findCol(headers, AMOUNT_KEYS)
  if (dateI < 0 || (outI < 0 && inI < 0 && amountI < 0)) {
    return {
      rows: [],
      skipped: 0,
      error: 'Fant ikke dato og beløp. Eksporter CSV fra nettbanken (ikke PDF).',
    }
  }

  const rows: BankRow[] = []
  let skipped = 0
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i], delim)
    const date = parseBankDate(cols[dateI] ?? '')
    const label = textI >= 0 ? cols[textI] ?? '' : ''
    if (!date) {
      skipped++
      continue
    }
    let amount = 0
    let direction: 'out' | 'in' | null = null
    if (outI >= 0 || inI >= 0) {
      const out = outI >= 0 ? parseNokAmount(cols[outI] ?? '') : null
      const inn = inI >= 0 ? parseNokAmount(cols[inI] ?? '') : null
      if (out && out !== 0) {
        amount = Math.abs(out)
        direction = 'out'
      } else if (inn && inn !== 0) {
        amount = Math.abs(inn)
        direction = 'in'
      }
    } else if (amountI >= 0) {
      const a = parseNokAmount(cols[amountI] ?? '')
      if (a !== null && a !== 0) {
        amount = Math.abs(a)
        direction = a < 0 ? 'out' : 'in'
      }
    }
    if (!direction || amount <= 0) {
      skipped++
      continue
    }
    rows.push({ date, amount, text: label, direction })
  }

  if (rows.length === 0) {
    return { rows: [], skipped, error: 'Ingen transaksjoner å lese i filen.' }
  }
  return { rows, skipped, error: null }
}

export function expenseKey(date: string, amount: number, text: string): string {
  return `${date}|${amount}|${text.slice(0, 48).toLowerCase()}`
}
