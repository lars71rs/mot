import { describe, expect, it } from 'vitest'
import {
  checkSaldoChain,
  findLineAmounts,
  guessCategory,
  parseBankCsv,
  parseBankDate,
  parseBankStatement,
  parseBankText,
  parseNokAmount,
  unreadStatementCopy,
} from './bankCsv'

describe('ikke gjette beløp', () => {
  it('sier ifra uten å be Grok dikte rader', () => {
    expect(unreadStatementCopy('pdf')).toMatch(/gjetter ikke beløp/)
    expect(unreadStatementCopy('text')).toMatch(/gjetter ikke beløp/)
    expect(unreadStatementCopy('pdf')).not.toMatch(/lag CSV/i)
  })
})

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

describe('kontoutskrift som tekst', () => {
  it('leser DNB-lignende linjer med ut, inn og saldo', () => {
    const text = `
Kontoutskrift
Konto 1234.56.78901
17.09.2026 REMA 1000 SCHOUS          189,00      12 411,20
16.09.2026 Lønn                                 27 000,00  39 411,20
15.09.2026 Vipps*Kiosk                 67,00-
`
    const r = parseBankText(text)
    expect(r.error).toBeNull()
    const rem = r.rows.find((x) => /REMA/i.test(x.text))
    expect(rem?.direction).toBe('out')
    expect(rem?.amount).toBe(189)
    const pay = r.rows.find((x) => /Lønn/i.test(x.text))
    expect(pay?.direction).toBe('in')
    expect(pay?.amount).toBe(27_000)
    const kiosk = r.rows.find((x) => /Kiosk/i.test(x.text))
    expect(kiosk?.direction).toBe('out')
    expect(kiosk?.amount).toBe(67)
  })

  it('leser to datoer på samme linje og beløp på neste', () => {
    const text = `
28.08.2026 28.08.2026 REMA 1000 SCHOUS
189,00
12.411,20
27.08.2026 27.08.2026 Lønn august
27 000,00
39 411,20
`
    const r = parseBankText(text)
    expect(r.error).toBeNull()
    expect(r.rows.find((x) => /REMA/i.test(x.text))?.amount).toBe(189)
    expect(r.rows.find((x) => /REMA/i.test(x.text))?.date).toBe('2026-08-28')
    expect(r.rows.find((x) => /Lønn/i.test(x.text))?.direction).toBe('in')
  })
})

describe('PDF-tekst er ikke CSV-feil', () => {
  it('sier ikke at PDF er ugyldig CSV', () => {
    const text = `Kontoutskrift DNB
28.08.2026 REMA 1000 SCHOUS 189,00 12.411,20`
    const r = parseBankStatement(text)
    expect(r.error).toBeNull()
    expect(r.rows[0]?.amount).toBe(189)
  })

  it('kjenner lønn uten ø som inn', () => {
    const r = parseBankStatement('01.08.2026 Lonn august 27.000,00 39.411,20')
    expect(r.rows[0]?.direction).toBe('in')
    expect(r.rows[0]?.amount).toBe(27_000)
  })

  it('kjenner oppdrag som inn', () => {
    const r = parseBankStatement('08.08.2026 Overforing fra oppdrag 4 800,00 12.411,20')
    expect(r.rows[0]?.direction).toBe('in')
    expect(r.rows[0]?.amount).toBe(4_800)
  })

  it('leser 500,00 ved fast oppdrag nr. 6507, ikke 507 500', () => {
    const text = `15.07.26 15.07.26 Fast oppdrag nr. 6507 500,00 15.07.26 797640054
Lars Rune Aasland
Overføring Mellom Egne Konti`
    const r = parseBankStatement(text)
    expect(r.error).toBeNull()
    const row = r.rows.find((x) => /oppdrag/i.test(x.text))
    expect(row?.amount).toBe(500)
    expect(row?.amount).not.toBe(507_500)
    expect(row?.date).toBe('2026-07-15')
    expect(row?.text).toMatch(/6507/)
  })

  it('leser 500,00 også når 6507 er splittet i PDF', () => {
    const r = parseBankStatement(
      '15.07.26 15.07.26 Fast oppdrag nr. 6 507 500,00 15.07.26 797640054',
    )
    expect(r.rows[0]?.amount).toBe(500)
  })

  it('limer ikke 6507 og 500 uten ordet nr', () => {
    const r = parseBankStatement('15.07.26 Fast oppdrag 6507 500,00 15.07.26 797640054')
    expect(r.rows[0]?.amount).toBe(500)
    expect(findLineAmounts('6507 500,00').map((a) => a.value)).toEqual([500])
    expect(findLineAmounts('6 507 500,00').map((a) => a.value)).toEqual([500])
    expect(findLineAmounts('6 507.500,00').map((a) => a.value)).toEqual([500])
    expect(findLineAmounts('6507500,00').map((a) => a.value)).toEqual([500])
    expect(findLineAmounts('nr.6507500,00').map((a) => a.value)).toEqual([500])
    expect(findLineAmounts('6 5 0 7 500,00').map((a) => a.value)).toEqual([500])
    const glued = parseBankStatement('15.07.26 Fast oppdrag nr.6507500,00')
    expect(glued.rows[0]?.amount).toBe(500)
    expect(findLineAmounts('27 000,00 39 411,20').map((a) => a.value)).toEqual([27_000, 39_411])
    expect(findLineAmounts('4 800,00').map((a) => a.value)).toEqual([4_800])
    expect(findLineAmounts('12.500,00').map((a) => a.value)).toEqual([12_500])
    expect(findLineAmounts('1.234.567,00').map((a) => a.value)).toEqual([1_234_567])
  })

  it('leser 500 når PDF splitter nr. 6507 over flere linjer', () => {
    const text = `15.07.26 15.07.26 Fast oppdrag
nr. 6
507
500,00
15.07.26 797640054`
    const r = parseBankStatement(text)
    expect(r.rows[0]?.amount).toBe(500)
    expect(r.rows[0]?.amount).not.toBe(507_500)
    expect(r.rows[0]?.direction).toBe('out')
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

  it('positivt beløp uten lønn er ut, ikke inn', () => {
    const csv = `Dato;Beskrivelse;Beløp
10.08.2026;REMA 1000;189,00
15.08.2026;Lønn august;27000,00`
    const r = parseBankCsv(csv)
    expect(r.rows.find((x) => /REMA/.test(x.text))?.direction).toBe('out')
    expect(r.rows.find((x) => /Lønn/.test(x.text))?.direction).toBe('in')
  })
})

describe('saldo-sjekk', () => {
  it('godkjenner DNB-kjede nyest først', () => {
    const csv = `Bokført dato;Forklaring;Ut av konto;Inn på konto;Saldo
31.08.2026;Netflix;149,00;;18 412,20
28.08.2026;REMA 1000;189,00;;18 561,20`
    const r = parseBankCsv(csv)
    expect(r.rows.every((row) => !row.saldoMismatch)).toBe(true)
    expect(r.rows[0]?.saldo).toBe(18_412)
  })

  it('merker posten som ikke forklarer saldo-hoppet', () => {
    const csv = `Bokført dato;Forklaring;Ut av konto;Inn på konto;Saldo
31.08.2026;Fast oppdrag;507500,00;;18 412,20
28.08.2026;REMA 1000;189,00;;18 561,20`
    const r = parseBankCsv(csv)
    const bad = r.rows.find((row) => /oppdrag/i.test(row.text))
    expect(bad?.saldoMismatch).toBe(true)
    expect(r.rows.find((row) => /REMA/i.test(row.text))?.saldoMismatch).toBeFalsy()
  })

  it('godkjenner eldst-først CSV', () => {
    const csv = `Dato;Tekst;Ut av konto;Inn på konto;Saldo
28.08.2026;REMA 1000;189,00;;18 561,20
31.08.2026;Netflix;149,00;;18 412,20`
    expect(parseBankCsv(csv).rows.every((row) => !row.saldoMismatch)).toBe(true)
  })

  it('uten saldo-kolonne merker ingenting', () => {
    const flagged = checkSaldoChain([
      { date: '2026-08-31', amount: 149, text: 'Netflix', direction: 'out' },
      { date: '2026-08-28', amount: 189, text: 'REMA', direction: 'out' },
    ])
    expect(flagged.every((row) => !row.saldoMismatch)).toBe(true)
  })
})

describe('ekte bankfiler er ikke låst til testmalen', () => {
  it('hopper over infolinjer før kolonnehodet', () => {
    const csv = `Kontoutskrift
Konto 1234.56.78901
Periode: 01.08.2026 - 31.08.2026

Bokført dato;Forklaring;Ut fra konto;Inn på konto
31.08.2026;Netflix;149,00;
15.08.2026;Lønn august;;27000,00`
    const r = parseBankStatement(csv)
    expect(r.error).toBeNull()
    expect(r.rows).toHaveLength(2)
    expect(r.rows.find((x) => /Netflix/.test(x.text))?.direction).toBe('out')
  })

  it('leser ISO-dato i brødtekst', () => {
    const r = parseBankStatement('2026-08-28 REMA 1000 SCHOUS 189,00 12.411,20')
    expect(r.rows[0]?.date).toBe('2026-08-28')
    expect(r.rows[0]?.amount).toBe(189)
  })
})
