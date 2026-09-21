import type { AppState, Expense } from './types'

function id(prefix: string, n: number): string {
  return `${prefix}-${n}`
}

function tx(
  n: number,
  amount: number,
  date: string,
  direction: 'in' | 'out',
  category: Expense['category'],
  note: string,
  now: string,
): Expense {
  return {
    id: id('exp', n),
    amount,
    date,
    direction,
    category,
    note,
    createdAt: now,
  }
}

export function demoState(): AppState {
  const now = new Date().toISOString()
  return {
    onboarded: true,
    startedAt: '2026-09-01T12:00:00.000Z',
    displayName: 'Lars',
    birthYear: 2002,
    monthlyIncome: 52_000,
    fixed: [{ id: id('fix', 1), name: 'Husleie', amount: 12_500 }],
    goals: [
      {
        id: id('goal', 1),
        type: 'egenkapital',
        name: 'Egenkapital',
        targetAmount: 150_000,
        alreadySaved: 25_000,
        months: 36,
        createdAt: now,
        active: true,
      },
    ],
    expenses: [
      tx(1, 52_000, '2026-09-15', 'in', null, 'Lønn september', now),
      tx(2, 4_800, '2026-09-08', 'in', null, 'Designoppdrag', now),
      tx(3, 12_500, '2026-09-01', 'out', 'bolig', 'Husleie', now),
      tx(4, 745, '2026-09-14', 'out', 'mat', 'Oda', now),
      tx(5, 165, '2026-09-13', 'out', 'fritid', 'Kino', now),
      tx(6, 389, '2026-09-12', 'out', 'mat', 'Meny', now),
      tx(7, 187, '2026-09-11', 'out', 'helse', 'Apotek', now),
      tx(8, 429, '2026-09-10', 'out', 'fritid', 'Restaurant', now),
      tx(9, 78, '2026-09-09', 'out', 'fritid', 'Kaffe', now),
      tx(10, 42, '2026-09-08', 'out', 'transport', 'Ruter-billett', now),
      tx(11, 612, '2026-09-07', 'out', 'mat', 'Rema 1000', now),
      tx(12, 687, '2026-09-03', 'out', 'abonnement', 'Spotify og Telenor', now),
      tx(13, 890, '2026-09-05', 'out', 'klaer', 'H&M', now),
    ],
    budget: { customized: false, plans: { mat: 0, fritid: 0, transport: 0, annet: 0 } },
  }
}
