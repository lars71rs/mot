import type { AppState } from './types'

function id(prefix: string, n: number): string {
  return `${prefix}-${n}`
}

export function demoState(): AppState {
  const now = new Date().toISOString()
  return {
    onboarded: true,
    monthlyIncome: 32_000,
    fixed: [
      { id: id('fix', 1), name: 'Husleie', amount: 9500 },
      { id: id('fix', 2), name: 'Studielån', amount: 1500 },
      { id: id('fix', 3), name: 'Mobil', amount: 399 },
      { id: id('fix', 4), name: 'Kollektiv', amount: 800 },
    ],
    goals: [
      {
        id: id('goal', 1),
        type: 'egenkapital',
        name: 'Egenkapital',
        targetAmount: 300_000,
        alreadySaved: 25_000,
        months: 48,
        createdAt: now,
        active: true,
      },
    ],
    expenses: [],
    budget: { customized: false, plans: { mat: 0, fritid: 0, transport: 0, annet: 0 } },
  }
}
