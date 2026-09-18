import { describe, expect, it } from 'vitest'
import { guessCategory, parseBankCsv, parseBankDate, parseNokAmount } from './bankCsv'

describe('bankdato og beløp', () => {
  it('leser norsk dato og komma-beløp', () => {
    expect(parseBankDate('17.09.2026')).toBe('2026-09-17')
    expect(parseNokAmount('1.234,00')).toBe(1234)
    expect(parseNokAmount('-89,00')).toBe(-89)
  })
})

describe('DNB-lignende CSV', () => {
  it('skiller ut og inn', () => {
    const csv = `Dato;Forklaring;Ut av konto;Inn på konto
17.09.2026;REMA 1000 SCHOUS;189,00;
16.09.2026;Lønn september;;27000,00
15.09.2026;Ruterbillett;42,00;`
    const r = parseBankCsv(csv)
    expect(r.error).toBeNull()
    expect(r.rows.filter((x) => x.direction === 'out')).toHaveLength(2)
    expect(r.rows.find((x) => x.direction === 'in')?.amount).toBe(27_000)
    expect(r.rows[0].text).toMatch(/REMA/)
    expect(guessCategory('REMA 1000 SCHOUS')).toBe('mat')
  })
})

describe('én beløp-kolonne', () => {
  it('negativt er ut', () => {
    const csv = `Dato,Beskrivelse,Beløp
2026-09-10,Kiwi Majorstuen,-65.00
2026-09-11,Vipps fra Kari,200.00`
    const r = parseBankCsv(csv)
    expect(r.rows.find((x) => x.direction === 'out')?.amount).toBe(65)
    expect(r.rows.find((x) => x.direction === 'in')?.amount).toBe(200)
  })
})
