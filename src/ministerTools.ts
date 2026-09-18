import { guessCategory, parseBankCsv } from './bankCsv'
import { inPocket, spentByCategory, spentThisMonth, spentThisWeek } from './map'
import type { AppState, Expense, ExpenseCategory, FixedExpense } from './types'

export type ToolResult = {
  state: AppState
  result: unknown
}

const CATEGORIES: ExpenseCategory[] = ['mat', 'fritid', 'transport', 'klaer', 'annet']

function cloneState(s: AppState): AppState {
  return JSON.parse(JSON.stringify(s)) as AppState
}

function newId(): string {
  return crypto.randomUUID()
}

function overview(state: AppState, now: Date) {
  const fixedTotal = state.fixed.reduce((s, f) => s + f.amount, 0)
  const spentMonth = spentThisMonth(state.expenses, now)
  const spentWeek = spentThisWeek(state.expenses, now)
  const pocket = inPocket(state.monthlyIncome, fixedTotal, spentMonth)
  return {
    monthlyIncome: state.monthlyIncome,
    fixedTotal,
    fixed: state.fixed.map((f) => ({ id: f.id, name: f.name, amount: f.amount })),
    spentThisMonth: spentMonth,
    spentThisWeek: spentWeek,
    inPocket: pocket,
    byCategory: spentByCategory(state.expenses, now),
    expenseCount: state.expenses.length,
  }
}

export const MINISTER_TOOLS = [
  {
    type: 'function' as const,
    name: 'get_board',
    description:
      'Les tavlen: inntekt, faste, forbruk denne måneden/uka, i lomma, og forbruk per kategori.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    type: 'function' as const,
    name: 'list_expenses',
    description: 'List utgifter. Uten filter: denne kalendermåneden.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: [...CATEGORIES, 'ukjent'] },
        limit: { type: 'integer', minimum: 1, maximum: 80 },
      },
      additionalProperties: false,
    },
  },
  {
    type: 'function' as const,
    name: 'add_expense',
    description: 'Legg inn en utgift på tavlen.',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Hele kroner, positivt' },
        date: { type: 'string', description: 'YYYY-MM-DD. Utelat for i dag.' },
        category: { type: 'string', enum: CATEGORIES },
        note: { type: 'string' },
      },
      required: ['amount', 'date'],
      additionalProperties: false,
    },
  },
  {
    type: 'function' as const,
    name: 'remove_expense',
    description: 'Slett en utgift med id fra list_expenses.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    type: 'function' as const,
    name: 'set_expense_category',
    description: 'Endre kategori på en utgift.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        category: { type: 'string', enum: [...CATEGORIES, 'ingen'] },
      },
      required: ['id', 'category'],
      additionalProperties: false,
    },
  },
  {
    type: 'function' as const,
    name: 'set_income',
    description: 'Sett vanlig månedsinntekt etter skatt. Ikke engangsbeløp.',
    parameters: {
      type: 'object',
      properties: { amount: { type: 'number' } },
      required: ['amount'],
      additionalProperties: false,
    },
  },
  {
    type: 'function' as const,
    name: 'add_fixed',
    description: 'Legg til en fast månedlig utgift (husleie, lån, mobil).',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        amount: { type: 'number' },
      },
      required: ['name', 'amount'],
      additionalProperties: false,
    },
  },
  {
    type: 'function' as const,
    name: 'remove_fixed',
    description: 'Fjern en fast utgift med id fra get_board.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    type: 'function' as const,
    name: 'import_bank_csv',
    description:
      'Les en CSV/TXT fra norsk nettbank. Legger utgående i forbruk. Hopper over inn på konto (lønn). Hopper over duplikater.',
    parameters: {
      type: 'object',
      properties: { csv: { type: 'string', description: 'Hele filinnholdet' } },
      required: ['csv'],
      additionalProperties: false,
    },
  },
]

export function parseSpendUtterance(text: string): {
  amount: number
  category: ExpenseCategory | null
  note: string
}[] {
  const lower = text.toLowerCase()
  if (!/brukt|brukte|betalte|kjøpte|\bkr\b|kroner/.test(lower)) return []

  const found: { amount: number; index: number; length: number }[] = []
  const re = /(\d{1,7}(?:\s\d{3})*)\s*(?:kr|kroner)|(?:kr|kroner)\s*(\d{1,7}(?:\s\d{3})*)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const raw = (m[1] || m[2] || '').replace(/\s/g, '')
    const amount = Number(raw)
    if (!Number.isFinite(amount) || amount <= 0) continue
    found.push({ amount: Math.round(amount), index: m.index, length: m[0].length })
  }
  if (found.length === 0) return []

  return found.map((hit, i) => {
    const from = hit.index + hit.length
    const to = i + 1 < found.length ? found[i + 1].index : text.length
    const ctx = text.slice(from, to)
    const note = text.slice(hit.index, to).replace(/^[\s,.;:og]+|[\s,.;]+$/g, '').slice(0, 80)
    return { amount: hit.amount, category: categoryFromContext(ctx), note }
  })
}

function categoryFromContext(ctx: string): ExpenseCategory | null {
  const t = ctx.toLowerCase()
  if (/\bmat\b|rema|kiwi|coop|meny|middag|lunsj|dagligvare/.test(t)) return 'mat'
  if (/\bannet\b|noe annet/.test(t)) return 'annet'
  if (/\bklær\b|klar\b/.test(t)) return 'klaer'
  if (/\btransport\b|buss|tog|ruter|vy\b|bensin/.test(t)) return 'transport'
  if (/\bfritid\b|iskrem|is\b|kaffe|utested|bar|kino|spill/.test(t)) return 'fritid'
  return guessCategory(ctx)
}

export function ingestSpendUtterance(
  text: string,
  state: AppState,
  now: Date,
): { state: AppState; added: { amount: number; category: ExpenseCategory | null; note: string }[] } {
  let s = cloneState(state)
  const added: { amount: number; category: ExpenseCategory | null; note: string }[] = []
  for (const hit of parseSpendUtterance(text)) {
    const ran = runMinisterTool(
      'add_expense',
      { amount: hit.amount, category: hit.category ?? undefined, note: hit.note },
      s,
      now,
    )
    s = ran.state
    added.push(hit)
  }
  return { state: s, added }
}

export function runMinisterTool(
  name: string,
  args: Record<string, unknown>,
  state: AppState,
  now: Date,
): ToolResult {
  const s = cloneState(state)

  switch (name) {
    case 'get_board':
      return { state: s, result: overview(s, now) }
    case 'list_expenses': {
      const cat = typeof args.category === 'string' ? args.category : null
      const limit = typeof args.limit === 'number' ? args.limit : 40
      let list = s.expenses.filter((e) => e.date.startsWith(monthPrefixLocal(now)))
      if (cat === 'ukjent') list = list.filter((e) => !e.category)
      else if (cat && CATEGORIES.includes(cat as ExpenseCategory)) {
        list = list.filter((e) => e.category === cat)
      }
      list = [...list].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit)
      return {
        state: s,
        result: list.map((e) => ({
          id: e.id,
          date: e.date,
          amount: e.amount,
          category: e.category,
          note: e.note ?? '',
        })),
      }
    }
    case 'add_expense': {
      const amount = Math.round(Number(args.amount))
      let date = String(args.date ?? '').trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = toIsoDateLocal(now)
      if (!amount || amount <= 0) {
        return { state: s, result: { error: 'Ugyldig beløp' } }
      }
      const category =
        typeof args.category === 'string' && CATEGORIES.includes(args.category as ExpenseCategory)
          ? (args.category as ExpenseCategory)
          : null
      const note = typeof args.note === 'string' ? args.note : undefined
      const row: Expense = {
        id: newId(),
        amount,
        date,
        category,
        note,
        createdAt: new Date().toISOString(),
      }
      s.expenses = [...s.expenses, row]
      return { state: s, result: { ok: true, id: row.id, board: overview(s, now) } }
    }
    case 'remove_expense': {
      const id = String(args.id ?? '')
      const before = s.expenses.length
      s.expenses = s.expenses.filter((e) => e.id !== id)
      return {
        state: s,
        result: { ok: s.expenses.length < before, board: overview(s, now) },
      }
    }
    case 'set_expense_category': {
      const id = String(args.id ?? '')
      const raw = String(args.category ?? '')
      const category: ExpenseCategory | null =
        raw === 'ingen' ? null : CATEGORIES.includes(raw as ExpenseCategory) ? (raw as ExpenseCategory) : null
      s.expenses = s.expenses.map((e) => (e.id === id ? { ...e, category } : e))
      return { state: s, result: { ok: true, board: overview(s, now) } }
    }
    case 'set_income': {
      const amount = Math.round(Number(args.amount))
      if (!amount || amount < 0) return { state: s, result: { error: 'Ugyldig inntekt' } }
      s.monthlyIncome = amount
      return { state: s, result: { ok: true, board: overview(s, now) } }
    }
    case 'add_fixed': {
      const name = String(args.name ?? '').trim()
      const amount = Math.round(Number(args.amount))
      if (!name || amount <= 0) return { state: s, result: { error: 'Ugyldig fast utgift' } }
      const row: FixedExpense = { id: newId(), name, amount }
      s.fixed = [...s.fixed, row]
      return { state: s, result: { ok: true, id: row.id, board: overview(s, now) } }
    }
    case 'remove_fixed': {
      const id = String(args.id ?? '')
      s.fixed = s.fixed.filter((f) => f.id !== id)
      return { state: s, result: { ok: true, board: overview(s, now) } }
    }
    case 'import_bank_csv': {
      const csv = String(args.csv ?? '')
      const parsed = parseBankCsv(csv)
      if (parsed.error) return { state: s, result: { error: parsed.error } }
      const have = new Set(
        s.expenses.map((e) => `${e.date}|${e.amount}|${(e.note ?? '').slice(0, 48).toLowerCase()}`),
      )
      let added = 0
      let duplicates = 0
      const incoming = parsed.rows.filter((r) => r.direction === 'in').length
      const nowIso = new Date().toISOString()
      const extra: Expense[] = []
      for (const row of parsed.rows.filter((r) => r.direction === 'out')) {
        const key = `${row.date}|${row.amount}|${row.text.slice(0, 48).toLowerCase()}`
        if (have.has(key)) {
          duplicates++
          continue
        }
        have.add(key)
        extra.push({
          id: newId(),
          amount: row.amount,
          date: row.date,
          category: guessCategory(row.text),
          note: row.text,
          createdAt: nowIso,
        })
        added++
      }
      s.expenses = [...s.expenses, ...extra]
      return {
        state: s,
        result: {
          added,
          duplicates,
          incomingSkipped: incoming,
          board: overview(s, now),
        },
      }
    }
    default:
      return { state: s, result: { error: `Ukjent verktøy: ${name}` } }
  }
}

function monthPrefixLocal(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-`
}

function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
