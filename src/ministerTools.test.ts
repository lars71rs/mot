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
    const board = runMinisterTool('get_board', {}, s, now).result as { spentThisMonth: number; inPocket: number }
    expect(board.spentThisMonth).toBe(189)
    expect(board.inPocket).toBe(27_000 - 189)
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
    const board = (r.result as { added: number; incomingSkipped: number; board: { spentThisMonth: number } })
    expect(board.added).toBe(1)
    expect(board.incomingSkipped).toBe(1)
    expect(board.board.spentThisMonth).toBe(120)
  })
})
