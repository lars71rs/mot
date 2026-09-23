export type ChatInline = { t: 'text'; v: string } | { t: 'strong'; v: string }

export type ChatBlock =
  | { t: 'p'; parts: ChatInline[] }
  | { t: 'h'; parts: ChatInline[] }
  | { t: 'ul'; items: ChatInline[][] }
  | { t: 'ol'; items: ChatInline[][] }
  | { t: 'hr' }

export function parseInline(s: string): ChatInline[] {
  const parts: ChatInline[] = []
  const re = /\*\*(.+?)\*\*/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) parts.push({ t: 'text', v: s.slice(last, m.index) })
    parts.push({ t: 'strong', v: m[1] })
    last = m.index + m[0].length
  }
  if (last < s.length) parts.push({ t: 'text', v: s.slice(last) })
  return parts.filter((p) => p.v)
}

function isHr(line: string): boolean {
  return /^(-{3,}|\*{3,}|_{3,})$/.test(line)
}

function ulItem(line: string): string | null {
  const m = line.match(/^[-*•]\s+(.*)$/)
  return m ? m[1] : null
}

function olItem(line: string): string | null {
  const m = line.match(/^\d+[.)]\s+(.*)$/)
  return m ? m[1] : null
}

export function parseChatMd(raw: string): ChatBlock[] {
  const lines = String(raw || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
  const blocks: ChatBlock[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line) {
      i += 1
      continue
    }
    if (isHr(line)) {
      blocks.push({ t: 'hr' })
      i += 1
      continue
    }
    const u = ulItem(line)
    if (u !== null) {
      const items = [parseInline(u)]
      i += 1
      while (i < lines.length) {
        const next = ulItem(lines[i] ?? '')
        if (next === null) break
        items.push(parseInline(next))
        i += 1
      }
      blocks.push({ t: 'ul', items })
      continue
    }
    const o = olItem(line)
    if (o !== null) {
      const items = [parseInline(o)]
      i += 1
      while (i < lines.length) {
        const next = olItem(lines[i] ?? '')
        if (next === null) break
        items.push(parseInline(next))
        i += 1
      }
      blocks.push({ t: 'ol', items })
      continue
    }
    const onlyStrong = /^\*\*.+\*\*:?\s*$/.test(line)
    blocks.push({ t: onlyStrong ? 'h' : 'p', parts: parseInline(line) })
    i += 1
  }
  return blocks
}
