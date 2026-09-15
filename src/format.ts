const nok = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 })
const dateFmt = new Intl.DateTimeFormat('nb-NO', {
  day: 'numeric',
  month: 'long',
})
const shortDateFmt = new Intl.DateTimeFormat('nb-NO', {
  day: 'numeric',
  month: 'short',
})

export function formatNok(amount: number): string {
  return `${nok.format(Math.round(amount))} kr`
}

export function formatNokPlain(amount: number): string {
  return nok.format(Math.round(amount))
}

export function formatDate(isoDate: string): string {
  return dateFmt.format(parseISODate(isoDate))
}

export function formatShortDate(d: Date): string {
  return shortDateFmt.format(d)
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseAmount(raw: string): number | null {
  const digits = raw.replace(/\s/g, '').replace(',', '.')
  if (!digits) return null
  const n = Number(digits)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n)
}

export function amountFromField(raw: string): number {
  return parseAmount(raw) ?? 0
}

export function formatDays(days: number): string {
  const n = Math.max(0, Math.round(days))
  return n === 1 ? '1 dag' : `${n} dager`
}

export function formatDuration(months: number): string {
  if (months <= 0) return '0 måneder'
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (years === 0) return rest === 1 ? '1 måned' : `${rest} måneder`
  if (rest === 0) return years === 1 ? '1 år' : `${years} år`
  const y = years === 1 ? '1 år' : `${years} år`
  const m = rest === 1 ? '1 mnd' : `${rest} mnd`
  return `${y} og ${m}`
}

export function goalTypeLabel(type: string): string {
  switch (type) {
    case 'egenkapital':
      return 'egenkapital'
    case 'bolig':
      return 'bolig'
    case 'bil':
      return 'bil'
    case 'buffer':
      return 'buffer'
    default:
      return 'målet'
  }
}

export function monthName(d: Date): string {
  return new Intl.DateTimeFormat('nb-NO', { month: 'long' }).format(d)
}
