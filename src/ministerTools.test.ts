import { describe, expect, it } from 'vitest'
import { parseSpendUtterance, runMinisterTool } from './ministerTools'
import { emptyState } from './types'

describe('minister-verktøy', () => {
  const now = new Date(2026, 8, 17)

  it('legger inn utgift og oppdaterer tavlen', () => {
    let s = emptyState()
    s.monthlyIncome = 27_000
    s.onboarded = true
    const add = runMinisterTool(
      'add_expense',
      { amount: 189, date: '2026-09-17', category: 'fritid', note: 'Kaffe' },
      s,
      now,
    )
    s = add.state
    const board = runMinisterTool('get_board', {}, s, now).result as {
      spentThisMonth: number
      leftover: number
      usedFromSavings: number
    }
    expect(board.spentThisMonth).toBe(189)
    expect(board.leftover).toBe(-189)
    expect(board.usedFromSavings).toBe(189)
    expect(
      (runMinisterTool('get_board', {}, s, now).result as { coverage: { monthCount: number; enoughForPatterns: boolean } })
        .coverage,
    ).toEqual(expect.objectContaining({ monthCount: 1, enoughForPatterns: false, missing: 2 }))
  })

  it('snakker om måneden som er åpen på kartet, ikke i dag', () => {
    let s = emptyState()
    s.viewMonth = '2026-08'
    s = runMinisterTool(
      'add_expense',
      { amount: 189, date: '2026-08-28', category: 'mat', note: 'REMA' },
      s,
      now,
    ).state
    s = runMinisterTool(
      'add_expense',
      { amount: 30, date: '2026-09-17', category: 'mat', note: 'Mat' },
      s,
      now,
    ).state
    s.viewMonth = '2026-08'
    const board = runMinisterTool('get_board', {}, s, now).result as {
      month: string
      spent: number
    }
    expect(board.month).toBe('2026-08')
    expect(board.spent).toBe(189)
    const list = runMinisterTool('list_expenses', {}, s, now).result as { note: string }[]
    expect(list.map((e) => e.note)).toEqual(['REMA'])
  })

  it('plukker utgifter ut av setninger', () => {
    const a = parseSpendUtterance('Jeg har brukt 100 kr på mat og 876kr på noe annet.')
    expect(a.map((x) => [x.amount, x.category])).toEqual([
      [100, 'mat'],
      [876, 'annet'],
    ])
    const b = parseSpendUtterance('Jeg har brukt nå kroner 67 på en iskrem')
    expect(b).toHaveLength(1)
    expect(b[0].amount).toBe(67)
    expect(b[0].category).toBe('fritid')
    expect(parseSpendUtterance('Har jeg en god økonomi?')).toEqual([])
  })

  it('bruker i dag når dato mangler', () => {
    const add = runMinisterTool('add_expense', { amount: 100, category: 'mat' }, emptyState(), now)
    expect(add.state.expenses[0]?.date).toBe('2026-09-17')
    expect(add.state.expenses[0]?.amount).toBe(100)
  })

  it('importerer bare utgående fra CSV', () => {
    const csv = `Dato;Forklaring;Ut av konto;Inn på konto
17.09.2026;REMA 1000;120,00;
16.09.2026;Lønn;;27000,00`
    const r = runMinisterTool('import_bank_csv', { csv }, emptyState(), now)
    const board = r.result as {
      added: number
      addedIn: number
      board: { spentThisMonth: number; income: number }
    }
    expect(board.added).toBe(2)
    expect(board.addedIn).toBe(1)
    expect(board.board.spentThisMonth).toBe(120)
    expect(board.board.income).toBe(27_000)
  })

  it('legger august-utskrift i byMonth, ikke september', () => {
    const text = `28.08.2026 REMA 1000 SCHOUS 189,00 12.411,20
15.08.2026 Vipps*Kiosk 67,00-`
    const r = runMinisterTool('import_bank_csv', { csv: text }, emptyState(), now)
    const out = r.result as {
      added: number
      months: { month: string; amount: number }[]
      board: {
        month: string
        spent: number
        spentThisMonth: number
        byMonth: { month: string; amount: number }[]
      }
    }
    expect(out.added).toBe(2)
    expect(out.board.month).toBe('2026-08')
    expect(out.board.spent).toBe(256)
    expect(out.board.byMonth).toEqual([{ month: '2026-08', amount: 256 }])
  })

  it('legger tre husleie-treff på tavlen som fakta, ikke gjetning', () => {
    let s = emptyState()
    for (const date of ['2026-06-01', '2026-07-01', '2026-08-01']) {
      s = runMinisterTool(
        'add_expense',
        { amount: 12_500, date, note: 'Husleie' },
        s,
        now,
      ).state
    }
    const board = runMinisterTool('get_board', {}, s, now).result as {
      fixedFacts: { name: string; amount: number; months: number }[]
    }
    expect(board.fixedFacts).toEqual([
      expect.objectContaining({ name: 'Husleie', amount: 12_500, months: 3 }),
    ])
  })

  it('lister utgifter for valgt måned', () => {
    let s = emptyState()
    s = runMinisterTool(
      'add_expense',
      { amount: 189, date: '2026-08-28', note: 'REMA' },
      s,
      now,
    ).state
    const list = runMinisterTool('list_expenses', { month: '2026-08' }, s, now).result as {
      amount: number
    }[]
    expect(list).toHaveLength(1)
    expect(list[0].amount).toBe(189)
    const empty = runMinisterTool('list_expenses', {}, s, now).result as unknown[]
    expect(empty).toHaveLength(0)
  })
})
