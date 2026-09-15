import { describe, expect, it } from 'vitest'
import { calculate, daysInCalendarMonth, monthlySavingFor, planDoesNotFit } from './engine'

const DEMO_FIXED = 9500 + 1500 + 399 + 800
const demoGoal = {
  type: 'egenkapital' as const,
  name: 'Egenkapital',
  targetAmount: 300_000,
  alreadySaved: 25_000,
  months: 48,
}

function onDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0)
}

const demoInput = {
  monthlyIncome: 32_000,
  fixedTotal: DEMO_FIXED,
  goal: demoGoal,
}

describe('demo-tall', () => {
  it('har 12 199 kr i faste', () => {
    expect(DEMO_FIXED).toBe(12_199)
  })

  it('sparing ca. 5 729 kr/mnd', () => {
    expect(monthlySavingFor(demoGoal)).toBe(5729)
  })

  it('dagsgrense ca. 469 kr i en 30-dagersmåned', () => {
    const now = onDay('2026-04-10')
    expect(daysInCalendarMonth(now)).toBe(30)
    const r = calculate({ ...demoInput, expenses: [], now })
    expect(r.monthlyFree).toBe(19_801)
    expect(r.monthlySaving).toBe(5729)
    expect(r.dailyPlan).toBe(469)
    expect(r.dailyToday).toBe(469)
    expect(r.remainingToday).toBe(469)
    expect(r.dailyTomorrow).toBe(469)
    expect(r.status).toBe('ok')
    expect(r.plannedSoFar).toBe(469 * 10)
    expect(r.planImpossible).toBe(false)
  })

  it('uten mål: (inntekt − faste) / dager', () => {
    const r = calculate({
      monthlyIncome: 32_000,
      fixedTotal: DEMO_FIXED,
      goal: null,
      expenses: [],
      now: onDay('2026-04-10'),
    })
    expect(r.dailyPlan).toBe(660)
  })
})

describe('plan som ikke går opp', () => {
  it('sier ifra når sparingen er større enn inntekt minus faste', () => {
    const r = calculate({
      ...demoInput,
      goal: { ...demoGoal, months: 6 },
      expenses: [],
      now: onDay('2026-04-10'),
    })
    expect(r.monthlySaving).toBeGreaterThan(r.monthlyFree)
    expect(r.planImpossible).toBe(true)
    expect(r.dailyPlan).toBe(0)
    expect(r.planLine).toMatch(/går ikke opp/)
    expect(planDoesNotFit({ ...demoGoal, months: 6 }, 32_000, DEMO_FIXED)).toBe(true)
    expect(planDoesNotFit(demoGoal, 32_000, DEMO_FIXED)).toBe(false)
  })

  it('sier ifra når faste spiser hele inntekten', () => {
    const r = calculate({
      monthlyIncome: 10_000,
      fixedTotal: 10_000,
      goal: null,
      expenses: [],
      now: onDay('2026-04-10'),
    })
    expect(r.noRoom).toBe(true)
    expect(r.dailyPlan).toBe(0)
  })
})

describe('ubrukt brennes, i morgen senkes bare når i dag er over', () => {
  it('underspend i går øker ikke i dag', () => {
    const r = calculate({
      ...demoInput,
      expenses: [{ amount: 100, date: '2026-04-09' }],
      now: onDay('2026-04-10'),
    })
    expect(r.dailyToday).toBe(469)
    expect(r.dailyTomorrow).toBe(469)
    expect(r.remainingToday).toBe(469)
    expect(r.status).toBe('ok')
  })

  it('overforbruk i dag synker morgendagen med overskudd / dager igjen', () => {
    const r = calculate({
      ...demoInput,
      expenses: [{ amount: 600, date: '2026-04-10' }],
      now: onDay('2026-04-10'),
    })
    expect(r.spentToday).toBe(600)
    expect(r.remainingToday).toBe(469 - 600)
    expect(r.overToday).toBe(true)
    expect(r.status).toBe('over')
    expect(r.todayOver).toBe(131)
    expect(r.dailyTomorrow).toBe(Math.round((20 * 469 - 131) / 20))
    expect(r.dailyTomorrow).toBeLessThan(469)
    expect(r.consequence?.headline).toMatch(
      /^Du har brukt 131 kr mer enn planen i dag\. I morgen blir /,
    )
    expect(r.consequence?.thisExpenseDays).toBe(Math.round(131 / (5729 / 30)))
    expect(r.consequence?.ifContinueDays).toBe(
      Math.round((131 * 48 * 30) / (5729 / 30)),
    )
  })

  it('uten mål: konsekvens uten A og B', () => {
    const r = calculate({
      monthlyIncome: 32_000,
      fixedTotal: DEMO_FIXED,
      goal: null,
      expenses: [{ amount: 800, date: '2026-04-10' }],
      now: onDay('2026-04-10'),
    })
    expect(r.overToday).toBe(true)
    expect(r.consequence?.headline).toMatch(/Du har brukt/)
    expect(r.consequence?.thisExpenseDays).toBeNull()
    expect(r.consequence?.ifContinueDays).toBeNull()
  })

  it('overforbruk i går senker ikke dagens tak', () => {
    const r = calculate({
      ...demoInput,
      expenses: [{ amount: 600, date: '2026-04-09' }],
      now: onDay('2026-04-10'),
    })
    expect(r.dailyToday).toBe(469)
    expect(r.remainingToday).toBe(469)
    expect(r.dailyTomorrow).toBe(469)
    expect(r.overToday).toBe(false)
  })

  it('er bak når måneden er over planlagt så langt, uten at i dag er over', () => {
    const r = calculate({
      ...demoInput,
      expenses: [{ amount: 8000, date: '2026-04-02' }],
      now: onDay('2026-04-10'),
    })
    expect(r.overToday).toBe(false)
    expect(r.status).toBe('behind')
    expect(r.spentThisMonth).toBe(8000)
    expect(r.plannedSoFar).toBe(4690)
    expect(r.monthOver).toBe(8000 - 4690)
    expect(r.dailyTomorrow).toBe(469)
    expect(r.consequence).toBeNull()
  })

  it('høyt dagsforbruk som fortsetter, skyver målet i dager', () => {
    const r = calculate({
      ...demoInput,
      expenses: [{ amount: 2000, date: '2026-04-10' }],
      now: onDay('2026-04-10'),
    })
    expect(r.status).toBe('over')
    expect(r.consequence?.thisExpenseDays).toBeGreaterThan(0)
    expect(r.consequence?.ifContinueDays).toBeGreaterThan(
      r.consequence?.thisExpenseDays ?? 0,
    )
    expect(r.consequence?.headline).not.toMatch(/hvis du fortsetter/)
  })

  it('siste dag i måneden: i morgen er neste måneds dagsgrense', () => {
    const r = calculate({
      ...demoInput,
      expenses: [{ amount: 800, date: '2026-04-30' }],
      now: onDay('2026-04-30'),
    })
    expect(r.lastDayOfMonth).toBe(true)
    expect(r.overToday).toBe(true)
    expect(r.dailyTomorrow).toBe(Math.round((19_801 - 5729) / 31))
  })

  it('teller bare utgifter i inneværende måned', () => {
    const r = calculate({
      ...demoInput,
      expenses: [
        { amount: 9000, date: '2026-03-31' },
        { amount: 50, date: '2026-04-10' },
      ],
      now: onDay('2026-04-10'),
    })
    expect(r.spentThisMonth).toBe(50)
    expect(r.remainingToday).toBe(419)
    expect(r.dailyTomorrow).toBe(469)
    expect(r.status).toBe('ok')
    expect(r.consequence).toBeNull()
  })

  it('slett reverserer overforbruk', () => {
    const now = onDay('2026-04-10')
    const over = calculate({
      ...demoInput,
      expenses: [{ amount: 600, date: '2026-04-10' }],
      now,
    })
    const cleared = calculate({ ...demoInput, expenses: [], now })
    expect(over.status).toBe('over')
    expect(cleared.status).toBe('ok')
    expect(cleared.remainingToday).toBe(469)
    expect(cleared.dailyTomorrow).toBe(469)
    expect(cleared.consequence).toBeNull()
  })
})

describe('mål nådd', () => {
  it('sparing 0 når allerede spart dekker målet', () => {
    const r = calculate({
      ...demoInput,
      goal: { ...demoGoal, alreadySaved: 300_000 },
      expenses: [],
      now: onDay('2026-04-10'),
    })
    expect(r.goalReached).toBe(true)
    expect(r.monthlySaving).toBe(0)
    expect(r.dailyPlan).toBe(660)
  })
})
