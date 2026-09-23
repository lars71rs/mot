import { describe, expect, it } from 'vitest'
import { parseChatMd } from './chatMd'

describe('chatMd', () => {
  it('gjør stjerner til strong og bindestreker til liste', () => {
    const blocks = parseChatMd(
      '**September 2026:**\n- **Inn:** 24 534 kr\n- **Ut:** 30 kr\n\n---\n\n1. Mat\n2. Fritid',
    )
    expect(blocks[0]).toMatchObject({ t: 'h' })
    expect(blocks[1]).toMatchObject({ t: 'ul' })
    expect(blocks[1].t === 'ul' && blocks[1].items).toHaveLength(2)
    expect(blocks.some((b) => b.t === 'hr')).toBe(true)
    expect(blocks.some((b) => b.t === 'ol')).toBe(true)
    const raw = JSON.stringify(blocks)
    expect(raw).not.toMatch(/\*\*/)
  })
})
