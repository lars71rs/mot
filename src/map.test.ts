import { describe, expect, it } from 'vitest'
import {
  coverageCopy,
  dataCoverage,
  dumpKickMessage,
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

  it('viser dumpede måneder, også før nedlasting — ikke tomme måneder før første fil', () => {
    const mixed = [
      { date: '2026-06-04' },
      { date: '2026-08-12' },
    ]
    expect(visibleMonths(mixed, onDay('2026-08-20'), '2026-08-03')).toEqual([
      '2026-06',
      '2026-07',
      '2026-08',
    ])
    expect(visibleMonths(mixed, onDay('2026-08-20'), '2026-08-03')).not.toContain('2026-05')
  })

  it('3 måneder er nok til mønster, 1 er det ikke', () => {
    const one = dataCoverage([{ date: '2026-08-04' }])
    expect(one.monthCount).toBe(1)
    expect(one.enoughForPatterns).toBe(false)
    expect(one.missing).toBe(2)
    expect(coverageCopy(one)).toMatch(/2 måneder til/)
    const three = dataCoverage([
      { date: '2026-06-01' },
      { date: '2026-07-01' },
      { date: '2026-08-01' },
    ])
    expect(three.enoughForPatterns).toBe(true)
    expect(coverageCopy(three)).toMatch(/gjentar/)
  })

  it('kick etter dump peker på kartmåneden og dekning', () => {
    const one = dataCoverage([{ date: '2026-08-04' }])
    const msg = dumpKickMessage('2026-08', one)
    expect(msg).toMatch(/august 2026/i)
    expect(msg).toMatch(/1 av 3/)
  })
})
