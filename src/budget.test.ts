import { describe, expect, it } from 'vitest'
import {
  buildBudgetView,
  expenseToBudgetPost,
  freePotKr,
  resolvedPlans,
  suggestBudget,
} from './budget'

const demoGoal = {
  type: 'egenkapital' as const,
  name: 'Egenkapital',
  targetAmount: 300_000,
  alreadySaved: 25_000,
  months: 48,
}

describe('fri pott', () => {
  it('er inntekt − faste − sparing', () => {
    expect(freePotKr(32_000, 12_199, demoGoal)).toBe(32_000 - 12_199 - 5729)
    expect(freePotKr(32_000, 12_199, demoGoal)).toBe(14_072)
  })

  it('uten mål er inntekt − faste', () => {
    expect(freePotKr(32_000, 12_199, null)).toBe(19_801)
  })

  it('er 0 når planen ikke går opp', () => {
    expect(freePotKr(32_000, 12_199, { ...demoGoal, months: 6 })).toBe(0)
  })
})

describe('foreslått fordeling', () => {
  it('summerer til fri pott', () => {
    const s = suggestBudget(14_072)
    expect(s.mat + s.fritid + s.transport + s.annet).toBe(14_072)
    expect(s.mat).toBe(Math.round(14_072 * 0.5))
    expect(s.fritid).toBe(Math.round(14_072 * 0.25))
    expect(s.transport).toBe(Math.round(14_072 * 0.1))
  })
})

describe('kategori mot post', () => {
  it('klær og tom kategori spiser av annet', () => {
    expect(expenseToBudgetPost('klaer')).toBe('annet')
    expect(expenseToBudgetPost(null)).toBe('annet')
    expect(expenseToBudgetPost('mat')).toBe('mat')
    expect(expenseToBudgetPost('fritid')).toBe('fritid')
  })
})

describe('avvikslinje', () => {
  const plans = { mat: 7000, fritid: 3500, transport: 1400, annet: 2172 }
  const now = new Date(2026, 3, 10)

  it('ingen linje når alt er i rute', () => {
    const v = buildBudgetView({
      freePot: 14_072,
      plans,
      expenses: [{ amount: 200, date: '2026-04-10', category: 'mat' }],
      now,
      remainingToday: 269,
    })
    expect(v.paceNote).toBeNull()
    expect(v.unallocated).toBe(0)
    expect(v.sumNote).toBeNull()
  })

  it('ufordelt er fri pott minus postene, og overforing flagges uten å slette tall', () => {
    const v = buildBudgetView({
      freePot: 14_072,
      plans: { ...plans, fritid: 8000 },
      expenses: [],
      now,
      remainingToday: 469,
    })
    expect(v.rows.find((r) => r.id === 'fritid')?.plan).toBe(8000)
    expect(v.unallocated).toBe(14_072 - (7000 + 8000 + 1400 + 2172))
    expect(v.unallocated).toBeLessThan(0)
    expect(v.sumNote).toMatch(/for mye fordelt/)
  })

  it('positiv ufordelt er rest, ikke sperre', () => {
    const v = buildBudgetView({
      freePot: 14_072,
      plans: { mat: 1000, fritid: 0, transport: 0, annet: 0 },
      expenses: [],
      now,
      remainingToday: 469,
    })
    expect(v.unallocated).toBe(13_072)
    expect(v.sumNote).toBeNull()
  })

  it('redigert plan styrer igjen og tom-varsel', () => {
    const v = buildBudgetView({
      freePot: 14_072,
      plans: { mat: 7000, fritid: 500, transport: 1400, annet: 2172 },
      expenses: [{ amount: 500, date: '2026-04-10', category: 'fritid' }],
      now,
      remainingToday: 100,
    })
    expect(v.rows.find((r) => r.id === 'fritid')?.remaining).toBe(0)
    expect(v.paceNote).toBe('Fritid er tom, dagen er fortsatt ok.')
  })

  it('låser brukerens tall når customized', () => {
    const stored = { mat: 1000, fritid: 2000, transport: 3000, annet: 8072 }
    expect(resolvedPlans(14_072, true, stored)).toEqual(stored)
    expect(resolvedPlans(14_072, false, stored)).toEqual(suggestBudget(14_072))
  })

  it('fritid tom, dagen ok', () => {
    const v = buildBudgetView({
      freePot: 14_072,
      plans,
      expenses: [{ amount: 3500, date: '2026-04-10', category: 'fritid' }],
      now,
      remainingToday: 100,
    })
    expect(v.paceNote).toBe('Fritid er tom, dagen er fortsatt ok.')
  })

  it('fritid går for fort', () => {
    const v = buildBudgetView({
      freePot: 14_072,
      plans,
      expenses: [{ amount: 2000, date: '2026-04-10', category: 'fritid' }],
      now,
      remainingToday: 269,
    })
    const row = v.rows.find((r) => r.id === 'fritid')
    expect(row?.used).toBe(2000)
    expect(row).toBeDefined()
    expect(row!.used).toBeGreaterThan(row!.expectedSoFar)
    expect(v.paceNote).toBe('Fritid går for fort.')
  })
})
