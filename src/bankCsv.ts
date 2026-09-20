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
  const neg = t.startsWith('-') || t.startsWith('−') || t.endsWith('-') || t.endsWith('−')
  const unsigned = t.replace(/^[-−]/, '').replace(/[-−]$/, '')
  let n: number
  if (unsigned.includes(',') && unsigned.includes('.')) {
    n = Number(unsigned.replace(/\./g, '').replace(',', '.'))
  } else if (unsigned.includes(',')) {
    n = Number(unsigned.replace(/\./g, '').replace(',', '.'))
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(unsigned)) {
    n = Number(unsigned.replace(/\./g, ''))
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
    /husleie|leie\b|depositum|kommunale|strøm|strom|fjernvarme|hafslund|elvia|fyring|bolig/.test(t)
  ) {
    return 'bolig'
  }
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
  if (/apotek|lege|tannlege|fysio|boots|vitus|helse/.test(t)) return 'helse'
  if (
    /spotify|netflix|hbo|viaplay|telenor|telia|\bice\b|talkmore|abonnement|tv 2 play|disney\+/.test(
      t,
    )
  ) {
    return 'abonnement'
  }
  if (
    /vinmonopolet|starbucks|espresso|mcdonald|burger|kafé|kafe|barista|utested|night|polet|iskrem|\bis\b|kiosk|kino|restaurant/.test(
      t,
    )
  ) {
    return 'fritid'
  }
  return null
}

const IN_HINT =
  /lønn|\blonn\b|salary|innbetaling|innskudd|refusjon|tilbake|overføring fra|overforing fra|from |vipps fra|utbetaling fra|oppdrag|freelance|honorar/i
const SKIP_LINE =
  /kontonr|kontonummer|iban|bic\b|side\s+\d|kontoutskrift|org\.?\s*nr|fødsels|periode:|saldo fra|inngående saldo|utgående saldo$/i

function parseStatementLine(line: string): BankRow | null {
  const trimmed = line.replace(/\s+/g, ' ').trim()
  if (trimmed.length < 8 || SKIP_LINE.test(trimmed)) return null
  const dateHit = trimmed.match(/(\d{1,2}\.\d{1,2}\.\d{2,4})/)
  if (!dateHit || dateHit.index === undefined) return null
  const date = parseBankDate(dateHit[1])
  if (!date) return null
  const afterDate = trimmed
    .slice(dateHit.index + dateHit[0].length)
    .replace(/^\s*\d{1,2}\.\d{1,2}\.\d{2,4}\s*/, '')
  const amountRe = /-?\s*\d{1,3}(?:[.\s]\d{3})*,\d{2}-?|-?\s*\d+,\d{2}-?/g
  const amounts: { raw: string; value: number; index: number }[] = []
  let am: RegExpExecArray | null
  while ((am = amountRe.exec(afterDate)) !== null) {
    const value = parseNokAmount(am[0])
    if (value === null || value === 0) continue
    amounts.push({ raw: am[0], value, index: am.index })
  }
  if (amounts.length === 0) return null
  const tx = amounts[0]
  const text =
    afterDate
      .slice(0, tx.index)
      .replace(/\s+/g, ' ')
      .replace(/\bsaldo\b.*$/i, '')
      .trim() || 'Utgift'
  let direction: 'out' | 'in'
  if (tx.value < 0 || /-$/.test(tx.raw.replace(/\s/g, ''))) direction = 'out'
  else if (IN_HINT.test(text)) direction = 'in'
  else direction = 'out'
  return { date, amount: Math.abs(tx.value), text, direction }
}

export function parseBankText(text: string): ParseResult {
  const rows: BankRow[] = []
  let skipped = 0
  const seen = new Set<string>()
  const lines = text
    .split(/\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  let i = 0
  while (i < lines.length) {
    let joined = lines[i]
    let row = parseStatementLine(joined)
    let used = 1
    if (!row && /\d{1,2}\.\d{1,2}\.\d{2,4}/.test(joined)) {
      for (let extra = 1; extra <= 4 && i + extra < lines.length; extra++) {
        const next = lines[i + extra]
        if (extra > 1 && /^\d{1,2}\.\d{1,2}\.\d{2,4}/.test(next)) break
        joined = `${joined} ${next}`
        row = parseStatementLine(joined)
        used = extra + 1
        if (row) break
      }
    }
    if (!row) {
      if (/\d{1,2}\.\d{1,2}\.\d{2,4}/.test(lines[i]) && /,/.test(lines[i])) skipped++
      i += 1
      continue
    }
    const key = `${row.date}|${row.amount}|${row.text.slice(0, 40)}|${row.direction}`
    if (!seen.has(key)) {
      seen.add(key)
      rows.push(row)
    }
    i += used
  }
  if (rows.length === 0) {
    return { rows: [], skipped, error: 'Fant ingen transaksjoner i teksten.' }
  }
  return { rows, skipped, error: null }
}

function looksLikeCsv(raw: string): boolean {
  const first = (raw.trim().split('\n', 1)[0] || '').toLowerCase()
  if (!first.includes(';') && !first.includes(',')) return false
  return DATE_KEYS.some((k) => first.includes(k))
}

export function parseBankStatement(raw: string): ParseResult {
  const csv = parseBankCsv(raw)
  const text = parseBankText(raw)
  if (!csv.error && csv.rows.length > 0 && csv.rows.length >= text.rows.length) return csv
  if (text.rows.length > 0) return text
  if (!csv.error && csv.rows.length > 0) return csv
  if (looksLikeCsv(raw) && csv.error) return csv
  return text.error
    ? text
    : { rows: [], skipped: text.skipped, error: 'Fant ingen transaksjoner i teksten.' }
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
