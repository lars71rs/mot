import { describe, expect, it } from 'vitest'
import { spentByCategory, spentThisMonth, spentThisWeek } from './map'

function onDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0)
}

describe('kart over forbruk', () => {
  const expenses = [
    { amount: 400, date: '2026-09-02', category: 'mat' as const },
    { amount: 200, date: '2026-09-15', category: 'fritid' as const },
    { amount: 80, date: '2026-09-16', category: 'transport' as const },
    { amount: 9000, date: '2026-08-31', category: 'mat' as const },
  ]

  it('brukt denne måneden teller bare inneværende måned', () => {
    expect(spentThisMonth(expenses, onDay('2026-09-16'))).toBe(680)
  })

  it('denne uka er mandag–i dag', () => {
    // 16. sep 2026 er onsdag, uke starter 14. sep
    expect(spentThisWeek(expenses, onDay('2026-09-16'))).toBe(200 + 80)
  })

  it('fordeler på kategori, størst først', () => {
    const rows = spentByCategory(expenses, onDay('2026-09-16'))
    expect(rows.map((r) => r.label)).toEqual(['Mat', 'Fritid', 'Transport'])
    expect(rows[0].amount).toBe(400)
  })
})
