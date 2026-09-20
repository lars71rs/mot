import { extractText, extractTextItems, getDocumentProxy } from 'unpdf'

type TextItem = {
  str?: string
  x?: number
  y?: number
  fontSize?: number
  hasEOL?: boolean
}

type Cell = { x: number; str: string }

export async function pdfBufferToText(buf: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buf))
  const packed = (await extractTextItems(pdf)) as { items?: TextItem[][] }
  const pages = packed.items ?? []
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

function pageToLines(items: TextItem[]): string[] {
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

  const rows: { y: number; cells: Cell[] }[] = []
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

  return rows.map((row) =>
    row.cells
      .sort((a, b) => a.x - b.x)
      .map((c) => c.str)
      .join(' '),
  )
}
