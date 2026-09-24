import { extractText, extractTextItems, getDocumentProxy } from 'unpdf'
import { parseBankDate, parseNokAmount } from '../src/bankCsv.ts'

type TextItem = {
  str?: string
  x?: number
  y?: number
  fontSize?: number
  hasEOL?: boolean
}

type Cell = { x: number; str: string }
type Row = { y: number; cells: Cell[] }

type TxRow = {
  date: string
  text: string
  amountRaw: string
  amount: number
  txX: number
  saldoRaw?: string
}

const AMOUNT_CELL = /^-?[\d.\s]+,\d{2}-?$/
const KID_CELL = /^\d{6,}$/
const SKIP_TEXT =
  /side\s+\d|kontoutskrift|org\.?\s*nr|periode:|inngående saldo|utgående saldo/i

export async function pdfBufferToText(buf: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buf))
  const packed = (await extractTextItems(pdf)) as { items?: TextItem[][] }
  const pages = packed.items ?? []
  const allRows: Row[] = []
  for (const page of pages) {
    allRows.push(...itemsToRows(page ?? []))
  }
  const csv = rowsToStatementCsv(allRows)
  if (csv) return csv

  const lines: string[] = []
  for (const page of pages) {
    lines.push(...pageToLines(page ?? []))
    lines.push('')
  }
  const joined = lines.join('\n').trim()
  if (joined) return joined
  const fallback = await extractText(pdf, { mergePages: true })
  const text = fallback.text
  if (Array.isArray(text)) return text.filter(Boolean).join('\n')
  return String(text || '')
}

function itemsToRows(items: TextItem[]): Row[] {
  const usable = items
    .map((it) => ({
      str: (it.str ?? '').replace(/\s+/g, ' ').trim(),
      x: it.x ?? 0,
      y: it.y ?? 0,
      fontSize: it.fontSize ?? 9,
    }))
    .filter((it) => it.str)
  if (usable.length === 0) return []

  usable.sort((a, b) => b.y - a.y || a.x - b.x)

  const rows: Row[] = []
  for (const it of usable) {
    const last = rows[rows.length - 1]
    const tol = Math.max(5, it.fontSize * 0.6)
    if (last && Math.abs(last.y - it.y) <= tol) {
      last.cells.push({ x: it.x, str: it.str })
      last.y = (last.y * (last.cells.length - 1) + it.y) / last.cells.length
    } else {
      rows.push({ y: it.y, cells: [{ x: it.x, str: it.str }] })
    }
  }
  for (const row of rows) {
    row.cells.sort((a, b) => a.x - b.x)
    row.cells = mergeSplitAmounts(row.cells)
  }
  return rows
}

/** «27» + «000,00» close together is 27 000,00, not two cells. */
function mergeSplitAmounts(cells: Cell[]): Cell[] {
  const out: Cell[] = []
  for (let i = 0; i < cells.length; i++) {
    const a = cells[i]
    const b = cells[i + 1]
    if (
      b &&
      b.x - a.x < 20 &&
      /^\d{1,3}$/.test(a.str) &&
      /^\d{3},\d{2}-?$/.test(b.str)
    ) {
      out.push({ x: a.x, str: `${a.str} ${b.str}` })
      i++
    } else {
      out.push(a)
    }
  }
  return out
}

function isAmountCell(str: string): boolean {
  const s = str.trim()
  if (!AMOUNT_CELL.test(s)) return false
  const v = parseNokAmount(s)
  return v !== null && v !== 0
}

function isDateCell(str: string): boolean {
  return parseBankDate(str) !== null && !isAmountCell(str)
}

function isKidCell(str: string): boolean {
  return KID_CELL.test(str.replace(/\s/g, ''))
}

function csvCell(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (/[;"\n]/.test(t)) return `"${t.replace(/"/g, '""')}"`
  return t
}

/**
 * Read PDF rows as a table: dates left, text middle, amounts right.
 * Rightmost amount on a line is saldo. The amount before that is the post.
 * Emits CSV so parseBankCsv never mixes «nr. 6507» into 500,00.
 */
export function rowsToStatementCsv(rows: Row[]): string | null {
  const pending: { date?: string; text: string; amounts: { x: number; raw: string; value: number }[] }[] =
    []

  for (const row of rows) {
    const dates: string[] = []
    const amounts: { x: number; raw: string; value: number }[] = []
    const textParts: string[] = []
    for (const cell of row.cells) {
      if (isDateCell(cell.str)) {
        const d = parseBankDate(cell.str)
        if (d) dates.push(d)
        continue
      }
      if (isKidCell(cell.str)) continue
      if (isAmountCell(cell.str)) {
        const value = parseNokAmount(cell.str)
        if (value !== null && value !== 0) amounts.push({ x: cell.x, raw: cell.str, value })
        continue
      }
      textParts.push(cell.str)
    }
    const text = textParts.join(' ').replace(/\s+/g, ' ').trim()
    if (SKIP_TEXT.test(text) && dates.length === 0 && amounts.length === 0) continue
    if (dates.length === 0 && amounts.length === 0 && text) {
      const prev = pending[pending.length - 1]
      if (prev) prev.text = [prev.text, text].filter(Boolean).join(' ')
      continue
    }
    if (dates.length === 0 && amounts.length > 0) {
      const prev = pending[pending.length - 1]
      if (prev && prev.amounts.length === 0) {
        prev.amounts = amounts
        if (text) prev.text = [prev.text, text].filter(Boolean).join(' ')
        continue
      }
    }
    if (dates.length === 0) continue
    pending.push({ date: dates[0], text, amounts })
  }

  const txs: TxRow[] = []
  for (const row of pending) {
    if (!row.date || row.amounts.length === 0) continue
    const sorted = [...row.amounts].sort((a, b) => a.x - b.x)
    const tx = sorted.length >= 2 ? sorted[sorted.length - 2] : sorted[0]
    const saldo = sorted.length >= 2 ? sorted[sorted.length - 1] : null
    txs.push({
      date: row.date,
      text: row.text || 'Utgift',
      amountRaw: tx.raw,
      amount: Math.abs(tx.value),
      txX: tx.x,
      saldoRaw: saldo && saldo !== tx ? saldo.raw : undefined,
    })
  }
  if (txs.length === 0) return null

  const split = twoMeans(txs.map((t) => t.txX))
  const lines: string[] = []
  if (split) {
    lines.push('Bokført dato;Forklaring;Ut av konto;Inn på konto;Saldo')
    for (const tx of txs) {
      const inn = tx.txX >= split.split
      const outRaw = inn ? '' : tx.amountRaw
      const inRaw = inn ? tx.amountRaw : ''
      lines.push(
        `${csvCell(tx.date)};${csvCell(tx.text)};${csvCell(outRaw)};${csvCell(inRaw)};${csvCell(tx.saldoRaw ?? '')}`,
      )
    }
  } else {
    lines.push('Bokført dato;Forklaring;Beløp;Saldo')
    for (const tx of txs) {
      const signed =
        tx.amountRaw.includes('-') || tx.amountRaw.includes('−') ? `-${tx.amountRaw.replace(/[-−]/g, '')}` : tx.amountRaw
      lines.push(`${csvCell(tx.date)};${csvCell(tx.text)};${csvCell(signed)};${csvCell(tx.saldoRaw ?? '')}`)
    }
  }
  return lines.join('\n')
}

function twoMeans(xs: number[]): { split: number } | null {
  if (xs.length < 2) return null
  const sorted = [...xs].sort((a, b) => a - b)
  let bestI = 1
  let bestGap = 0
  for (let i = 1; i < sorted.length; i++) {
    const g = sorted[i] - sorted[i - 1]
    if (g > bestGap) {
      bestGap = g
      bestI = i
    }
  }
  if (bestGap < 28) return null
  const leftN = bestI
  const rightN = sorted.length - bestI
  if (leftN === 0 || rightN === 0) return null
  return { split: (sorted[bestI - 1] + sorted[bestI]) / 2 }
}

function pageToLines(items: TextItem[]): string[] {
  return itemsToRows(items).map((row) => row.cells.map((c) => c.str).join(' '))
}
