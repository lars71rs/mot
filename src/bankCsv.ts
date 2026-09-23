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

export function unreadStatementCopy(kind: 'pdf' | 'text' = 'text'): string {
  if (kind === 'pdf') {
    return 'PDF-en lot seg ikke lese som tabell (ofte skann eller bilde). Eksporter CSV fra nettbanken og slipp den under Kontoutskrift. Jeg gjetter ikke beløp.'
  }
  return 'Fant ingen transaksjoner i filen. Prøv CSV fra nettbanken under Kontoutskrift. Jeg gjetter ikke beløp.'
}

const DATE_KEYS = [
  'bokført dato',
  'bokfort dato',
  'bokføringsdato',
  'bokforingsdato',
  'utført dato',
  'utfort dato',
  'transaksjonsdato',
  'bokført',
  'bokfort',
  'bokføring',
  'bokforing',
  'rentedato',
  'valuedate',
  'booked',
  'dato',
  'date',
]
const TEXT_KEYS = [
  'forklaring',
  'beskrivelse',
  'beskrivning',
  'melding',
  'tekst',
  'text',
  'mottaker',
  'avsender',
  'navn',
  'tittel',
]
const OUT_KEYS = [
  'ut av konto',
  'ut fra konto',
  'utavkonto',
  'utgående',
  'utgaende',
  'withdrawals',
  'debet',
  'debit',
]
const IN_KEYS = [
  'inn på konto',
  'inn til konto',
  'innpakonto',
  'innkommende',
  'deposits',
  'kredit',
  'credit',
]
const AMOUNT_KEYS = ['beløp', 'belop', 'amount', 'belopp']

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

function findCol(headers: string[], keys: string[], used: Set<number> = new Set()): number {
  const n = headers.map(normKey)
  for (const k of keys) {
    const compact = k.replace(/ /g, '')
    const i = n.findIndex(
      (h, idx) => !used.has(idx) && (h === k || h.replace(/ /g, '') === compact),
    )
    if (i >= 0) return i
  }
  for (const k of keys) {
    if (k.length < 4) continue
    const i = n.findIndex((h, idx) => !used.has(idx) && h.includes(k))
    if (i >= 0) return i
  }
  return -1
}

/** DNB/SpareBank legger ofte 2–10 infolinjer over kolonnehodet. */
function findCsvLayout(lines: string[]): { index: number; delim: string; headers: string[] } | null {
  const n = Math.min(lines.length, 40)
  for (let i = 0; i < n; i++) {
    const delim = detectDelim(lines[i])
    const headers = splitLine(lines[i], delim)
    if (headers.length < 2) continue
    const used = new Set<number>()
    const dateI = findCol(headers, DATE_KEYS, used)
    if (dateI < 0) continue
    used.add(dateI)
    const outI = findCol(headers, OUT_KEYS, used)
    const inI = findCol(headers, IN_KEYS, used)
    if (outI >= 0) used.add(outI)
    if (inI >= 0) used.add(inI)
    const amountI = findCol(headers, AMOUNT_KEYS, used)
    if (outI >= 0 || inI >= 0 || amountI >= 0) {
      return { index: i, delim, headers }
    }
  }
  return null
}

export function decodeBankBytes(buf: ArrayBuffer | Uint8Array): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  if (u8.length >= 2 && u8[0] === 0xff && u8[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(u8)
  }
  if (u8.length >= 2 && u8[0] === 0xfe && u8[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(u8)
  }
  if (u8.length > 8 && u8[1] === 0 && u8[3] === 0 && u8[0] !== 0) {
    return new TextDecoder('utf-16le').decode(u8)
  }
  return new TextDecoder('utf-8').decode(u8)
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
  if (iso) return ymd(iso[1], iso[2], iso[3], false)
  const dot = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/)
  if (dot) return ymd(dot[3], dot[2], dot[1], true)
  const slash = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (slash) return ymd(slash[3], slash[2], slash[1], false)
  return null
}

function ymd(yearRaw: string, monthRaw: string, dayRaw: string, centuryFromDot: boolean): string | null {
  let y = yearRaw
  if (y.length === 2) y = centuryFromDot && Number(y) > 50 ? `19${y}` : `20${y}`
  const year = Number(y)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
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
  /lønn|\blonn\b|salary|innbetaling|innskudd|refusjon|tilbake|overføring fra|overforing fra|from |vipps fra|utbetaling fra|fra oppdrag|freelance|honorar/i
const SKIP_LINE =
  /kontonr|kontonummer|iban|bic\b|side\s+\d|kontoutskrift|org\.?\s*nr|fødsels|periode:|saldo fra|inngående saldo|utgående saldo$/i

function isDigitChar(ch: string | undefined): boolean {
  return ch !== undefined && ch >= '0' && ch <= '9'
}

/**
 * Complete NOK amounts only — never a suffix of a longer digit run.
 * 500,00 / 12.500,00 / 12 500,00 / 1.234.567,00.
 * «6507 500,00», «6 507 500,00» and «6507500,00» are 500, not 507 500.
 * 3+3 space groups (507 500) are the tail of a 4-digit ref + 500,00.
 */
export function findLineAmounts(s: string): { raw: string; value: number; index: number }[] {
  s = stripStatementRefs(s)
  const amounts: { raw: string; value: number; index: number }[] = []
  const re = /,\d{2}-?/g
  let tail: RegExpExecArray | null
  while ((tail = re.exec(s)) !== null) {
    const taken = amountEndingAt(s, tail.index, tail[0])
    if (!taken) continue
    const value = parseNokAmount(taken.raw)
    if (value === null || value === 0) continue
    amounts.push({ raw: taken.raw, value, index: taken.index })
  }
  return amounts
}

function amountEndingAt(
  s: string,
  commaAt: number,
  tail: string,
): { raw: string; index: number } | null {
  const int = s.slice(0, commaAt)
  const candidates: { raw: string; index: number }[] = []
  const push = (m: RegExpMatchArray | null, rawGroup: number) => {
    if (!m) return
    const raw = m[rawGroup] + tail
    const index = m[1].length
    if (index > 0 && isDigitChar(s[index - 1])) return
    candidates.push({ raw, index })
  }
  // 12 500 / 4 800 / 27.000 — 1–2 digit head + one thousands group.
  push(int.match(/^(.*?)(-?\d{1,2}[.\s]\d{3})$/), 2)
  // 1.234.567 — millions with dots, two or more groups.
  push(int.match(/^(.*?)(-?\d{1,3}(?:\.\d{3}){2,})$/), 2)
  // 500 or 27000 without separator.
  push(int.match(/^(.*?)(-?\d{1,6})$/), 2)
  // PDF glued «6507»+«500,00» → 6507500,00 (7 digits = 4-digit ref + 500).
  const unsigned = int.replace(/^-/, '')
  if (/^\d{7}$/.test(unsigned)) {
    candidates.push({ raw: unsigned.slice(-3) + tail, index: commaAt - 3 })
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.raw.replace(/\s/g, '').length - a.raw.replace(/\s/g, '').length)
  return candidates[0]
}

/** KID, «nr. 6507» and PDF-split «nr. 6 507» are not amounts. */
function stripStatementRefs(s: string): string {
  return s
    .replace(/\bnr\.?:?\s*(?:(?!\d{1,3},\d{2})\d[\s.]*){2,8}/gi, 'nr ')
    .replace(/\b\d(?:\s+\d){3}(?=\s+\d{1,3},\d{2})/g, ' ')
    .replace(/\b\d\s+\d{3}(?=\s+\d{1,3},\d{2})/g, ' ')
    .replace(/\b\d{4,5}(?=\s+\d{1,3},\d{2})/g, ' ')
    .replace(/\b\d{6,}(?!,\d{2})\b/g, ' ')
}

function parseStatementLine(line: string): BankRow | null {
  const trimmed = line.replace(/\s+/g, ' ').trim()
  if (trimmed.length < 8 || SKIP_LINE.test(trimmed)) return null
  const dateHit = trimmed.match(/(?:^|\s)(\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{2,4})(?=\s|$)/)
  if (!dateHit || dateHit.index === undefined) return null
  const date = parseBankDate(dateHit[1])
  if (!date) return null
  const afterDate = trimmed
    .slice(dateHit.index + dateHit[0].length)
    .replace(/^\s*(?:\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{2,4})\s*/, '')
  const cleaned = stripStatementRefs(afterDate)
  const amounts = findLineAmounts(cleaned)
  if (amounts.length === 0) return null
  const tx = amounts[0]
  const rawAt = afterDate.indexOf(tx.raw.replace(/\s+/g, ' ').trim())
  const cut = rawAt >= 0 ? rawAt : tx.index
  const text =
    afterDate
      .slice(0, cut)
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
    if (!row && /\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{2,4}/.test(joined)) {
      for (let extra = 1; extra <= 4 && i + extra < lines.length; extra++) {
        const next = lines[i + extra]
        if (extra > 1 && /^(?:\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{2,4})/.test(next)) break
        joined = `${joined} ${next}`
        row = parseStatementLine(joined)
        used = extra + 1
        if (row) break
      }
    }
    if (!row) {
      if (/(?:\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{2,4})/.test(lines[i]) && /[.,]\d{2}/.test(lines[i])) skipped++
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
  const text = stripBom(raw).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = text.split('\n').filter((l) => l.trim().length > 0)
  return findCsvLayout(lines) != null
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
  const layout = findCsvLayout(lines)
  if (!layout) {
    return {
      rows: [],
      skipped: 0,
      error: 'Fant ikke dato og beløp. Eksporter CSV eller PDF fra nettbanken.',
    }
  }
  const { delim, headers, index: headerAt } = layout
  const used = new Set<number>()
  const dateI = findCol(headers, DATE_KEYS, used)
  used.add(dateI)
  const outI = findCol(headers, OUT_KEYS, used)
  if (outI >= 0) used.add(outI)
  const inI = findCol(headers, IN_KEYS, used)
  if (inI >= 0) used.add(inI)
  const amountI = findCol(headers, AMOUNT_KEYS, used)
  if (amountI >= 0) used.add(amountI)
  const textI = findCol(headers, TEXT_KEYS, used)
  if (dateI < 0 || (outI < 0 && inI < 0 && amountI < 0)) {
    return {
      rows: [],
      skipped: 0,
      error: 'Fant ikke dato og beløp. Eksporter CSV eller PDF fra nettbanken.',
    }
  }

  const rows: BankRow[] = []
  let skipped = 0
  for (let i = headerAt + 1; i < lines.length; i++) {
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
        direction = a < 0 || /-$/.test((cols[amountI] ?? '').replace(/\s/g, ''))
          ? 'out'
          : IN_HINT.test(label)
            ? 'in'
            : 'out'
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
