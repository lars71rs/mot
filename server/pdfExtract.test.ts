import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseBankStatement } from '../src/bankCsv'
import { pdfBufferToText } from './pdfExtract'

function makeSimplePdf(items: { x: number; y: number; t: string }[]): Buffer {
  const ops = ['BT', '/F1 9 Tf']
  for (const it of items) {
    const safe = it.t.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
    ops.push(`1 0 0 1 ${it.x.toFixed(1)} ${it.y.toFixed(1)} Tm (${safe}) Tj`)
  }
  ops.push('ET')
  const stream = ops.join('\n')
  let body = '%PDF-1.4\n'
  const offsets: number[] = [0]
  const add = (obj: string) => {
    offsets.push(Buffer.byteLength(body, 'latin1'))
    body += `${obj}\n`
  }
  add('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj')
  add('2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj')
  add(
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
  )
  add(
    `4 0 obj << /Length ${Buffer.byteLength(stream, 'latin1')} >> stream\n${stream}\nendstream endobj`,
  )
  add('5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj')
  const xrefPos = Buffer.byteLength(body, 'latin1')
  let xref = 'xref\n0 6\n0000000000 65535 f \n'
  for (let i = 1; i <= 5; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  body += xref
  body += `trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`
  return Buffer.from(body, 'latin1')
}

describe('pdfExtract', () => {
  it('slår sammen beløp som ligger litt forskjøvet i y', async () => {
    const pdf = makeSimplePdf([
      { x: 40, y: 700, t: '28.08.2026' },
      { x: 110, y: 700, t: '28.08.2026' },
      { x: 180, y: 700, t: 'REMA 1000 SCHOUS' },
      { x: 400, y: 697, t: '189,00' },
      { x: 480, y: 700, t: '12.411,20' },
      { x: 40, y: 680, t: '15.08.2026' },
      { x: 180, y: 680, t: 'Vipps*Kiosk' },
      { x: 400, y: 680, t: '67,00-' },
    ])
    const text = await pdfBufferToText(pdf)
    const parsed = parseBankStatement(text)
    expect(parsed.error).toBeNull()
    expect(parsed.rows.find((r) => /REMA/i.test(r.text))?.amount).toBe(189)
    expect(parsed.rows.find((r) => /REMA/i.test(r.text))?.date).toBe('2026-08-28')
    expect(parsed.rows.find((r) => /Kiosk/i.test(r.text))?.amount).toBe(67)
  })

  it('limer ikke oppdragsnr 6507 med beløp 500,00', async () => {
    const pdf = makeSimplePdf([
      { x: 40, y: 700, t: '15.07.26' },
      { x: 110, y: 700, t: '15.07.26' },
      { x: 180, y: 700, t: 'Fast oppdrag nr.' },
      { x: 290, y: 700, t: '6' },
      { x: 300, y: 700, t: '507' },
      { x: 400, y: 700, t: '500,00' },
      { x: 480, y: 700, t: '15.07.26' },
      { x: 530, y: 700, t: '797640054' },
    ])
    const text = await pdfBufferToText(pdf)
    const parsed = parseBankStatement(text)
    expect(parsed.rows[0]?.amount).toBe(500)
    expect(parsed.rows[0]?.amount).not.toBe(507_500)
    expect(parsed.rows[0]?.direction).toBe('out')
    expect(parsed.rows[0]?.text).toMatch(/6507|oppdrag/i)
    expect(text).toMatch(/Ut av konto|Beløp/)
    expect(text).not.toMatch(/6507 500/)
  })

  it('skiller ut-kolonne og inn-kolonne på x', async () => {
    const pdf = makeSimplePdf([
      { x: 40, y: 700, t: '15.08.2026' },
      { x: 180, y: 700, t: 'Lonn august' },
      { x: 480, y: 700, t: '27 000,00' },
      { x: 560, y: 700, t: '19 925,20' },
      { x: 40, y: 680, t: '28.08.2026' },
      { x: 180, y: 680, t: 'REMA 1000 SCHOUS' },
      { x: 400, y: 680, t: '189,00' },
      { x: 560, y: 680, t: '18 561,20' },
    ])
    const text = await pdfBufferToText(pdf)
    const parsed = parseBankStatement(text)
    expect(parsed.rows.find((r) => /Lonn/i.test(r.text))?.direction).toBe('in')
    expect(parsed.rows.find((r) => /Lonn/i.test(r.text))?.amount).toBe(27_000)
    expect(parsed.rows.find((r) => /REMA/i.test(r.text))?.direction).toBe('out')
    expect(parsed.rows.find((r) => /REMA/i.test(r.text))?.amount).toBe(189)
  })

  it('leser test-kontoutskriften som tabell, lønn som inn', async () => {
    const buf = readFileSync(resolve('public/test-kontoutskrift-august-2026.pdf'))
    const text = await pdfBufferToText(buf)
    expect(text.startsWith('Bokført dato;')).toBe(true)
    const parsed = parseBankStatement(text)
    expect(parsed.error).toBeNull()
    expect(parsed.rows.length).toBeGreaterThanOrEqual(20)
    expect(parsed.rows.find((r) => /Lonn/i.test(r.text))?.direction).toBe('in')
    expect(parsed.rows.find((r) => /Lonn/i.test(r.text))?.amount).toBe(27_000)
    expect(parsed.rows.find((r) => /Husleie/i.test(r.text))?.direction).toBe('out')
    expect(parsed.rows.find((r) => /Husleie/i.test(r.text))?.amount).toBe(12_500)
    expect(parsed.rows.find((r) => /Husleie/i.test(r.text))?.text).toBe('Husleie')
    expect(parsed.rows.find((r) => /oppdrag/i.test(r.text))?.direction).toBe('in')
    expect(parsed.rows.find((r) => /oppdrag/i.test(r.text))?.amount).toBe(4_800)
    expect(parsed.rows.every((r) => r.amount !== 507_500)).toBe(true)
    expect(parsed.rows.every((r) => !r.saldoMismatch)).toBe(true)
  })
})
