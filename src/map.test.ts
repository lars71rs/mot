import { describe, expect, it } from 'vitest'
import {
  inPocket,
  incomeThisMonth,
  leftoverThisMonth,
  spentByCategory,
  spentByMonth,
  spentThisMonth,
  spentThisWeek,
  visibleMonths,
} from './map'

function onDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0)
}

describe('kart over forbruk', () => {
  const expenses = [
    { amount: 400, date: '2026-09-02', category: 'mat' as const, direction: 'out' as const },
    { amount: 200, date: '2026-09-15', category: 'fritid' as const, direction: 'out' as const },
    { amount: 80, date: '2026-09-16', category: 'transport' as const, direction: 'out' as const },
    { amount: 9000, date: '2026-08-31', category: 'mat' as const, direction: 'out' as const },
    { amount: 27_000, date: '2026-09-15', category: null, direction: 'in' as const },
  ]

  it('brukt denne måneden teller bare inneværende måned', () => {
    expect(spentThisMonth(expenses, onDay('2026-09-16'))).toBe(680)
  })

  it('denne uka er mandag–i dag', () => {
    // 16. sep 2026 er onsdag, uke starter 14. sep
    expect(spentThisWeek(expenses, onDay('2026-09-16'))).toBe(200 + 80)
  })

  it('i lomma er inntekt minus faste minus forbruk', () => {
    expect(inPocket(32_000, 12_199, 680)).toBe(19_121)
  })

  it('fordeler på kategori, størst først', () => {
    const rows = spentByCategory(expenses, onDay('2026-09-16'))
    expect(rows.map((r) => r.label)).toEqual(['Mat', 'Underholdning', 'Transport'])
    expect(rows[0].amount).toBe(400)
  })

  it('summerer per måned, nyest først', () => {
    expect(spentByMonth(expenses)).toEqual([
      { month: '2026-09', amount: 680 },
      { month: '2026-08', amount: 9000 },
    ])
  })

  it('igjen er inn minus ut, og inn er ikke forbruk', () => {
    expect(incomeThisMonth(expenses, onDay('2026-09-16'))).toBe(27_000)
    expect(leftoverThisMonth(expenses, onDay('2026-09-16'))).toBe(27_000 - 680)
    expect(leftoverThisMonth(expenses, onDay('2026-08-31'))).toBe(-9000)
  })

  it('viser bare fra første måned med data fram til nå', () => {
    expect(visibleMonths(expenses, onDay('2026-09-16'))).toEqual(['2026-08', '2026-09'])
    expect(visibleMonths(expenses, onDay('2026-11-02'))).toEqual([
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
    ])
    expect(visibleMonths([], onDay('2026-09-16'))).toEqual(['2026-09'])
  })
})
