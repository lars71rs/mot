import { describe, expect, it } from 'vitest'
import { fixedFacts, merchantKey } from './recurring'

function tx(date: string, amount: number, note: string) {
  return { date, amount, note, direction: 'out' as const }
}

describe('faste etter tre treff', () => {
  it('normaliserer oppdragsnr og måned i navnet', () => {
    expect(merchantKey('Fast oppdrag nr. 6507')).toBe('fast oppdrag')
    expect(merchantKey('Husleie august')).toBe('husleie')
  })

  it('husleie tre måneder er fakta', () => {
    const facts = fixedFacts([
      tx('2026-06-01', 12_500, 'Husleie'),
      tx('2026-07-01', 12_500, 'Husleie'),
      tx('2026-08-01', 12_500, 'Husleie'),
      tx('2026-06-04', 189, 'REMA 1000'),
      tx('2026-06-12', 234, 'REMA 1000'),
      tx('2026-06-20', 156, 'REMA 1000'),
      tx('2026-07-03', 201, 'REMA 1000'),
      tx('2026-07-11', 178, 'REMA 1000'),
      tx('2026-07-22', 245, 'REMA 1000'),
      tx('2026-08-05', 190, 'REMA 1000'),
      tx('2026-08-14', 210, 'REMA 1000'),
      tx('2026-08-28', 188, 'REMA 1000'),
    ])
    expect(facts.map((f) => f.name)).toEqual(['Husleie'])
    expect(facts[0]?.amount).toBe(12_500)
    expect(facts[0]?.months).toBe(3)
    expect(facts[0]?.category).toBe('bolig')
  })

  it('to måneder er ikke fakta', () => {
    expect(
      fixedFacts([tx('2026-07-01', 399, 'Telenor Mobil'), tx('2026-08-01', 399, 'Telenor Mobil')]),
    ).toEqual([])
  })

  it('abonnement tre ganger er fakta, små beløpsavvik går', () => {
    const facts = fixedFacts([
      tx('2026-06-01', 109, 'Spotify'),
      tx('2026-07-01', 109, 'Spotify'),
      tx('2026-08-01', 119, 'Spotify'),
    ])
    expect(facts).toHaveLength(1)
    expect(facts[0]?.name).toBe('Spotify')
    expect(facts[0]?.category).toBe('abonnement')
  })

  it('inntekt er ikke fast utgift', () => {
    expect(
      fixedFacts([
        { date: '2026-06-15', amount: 27_000, note: 'Lønn', direction: 'in' },
        { date: '2026-07-15', amount: 27_000, note: 'Lønn', direction: 'in' },
        { date: '2026-08-15', amount: 27_000, note: 'Lønn', direction: 'in' },
      ]),
    ).toEqual([])
  })
})
