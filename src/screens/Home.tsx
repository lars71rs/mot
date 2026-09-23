import { useEffect, useMemo, useState } from 'react'
import { formatNok, formatNokPlain, formatShortDate, monthTitleFromKey } from '../format'
import {
  coverageCopy,
  dataCoverage,
  dateFromMonthKey,
  incomeThisMonth,
  leftoverThisMonth,
  monthExpenses,
  monthKey,
  monthsWithActivity,
  spentByCategory,
  spentThisMonth,
  visibleMonths,
} from '../map'
import { useStore } from '../store'
import { categoryLabel, type ExpenseCategory } from '../types'

const DONUT = ['#1e4a3a', '#2f6b54', '#4d8f72', '#8f3d24', '#c4a574', '#5e584f', '#16382c', '#a67c52']

export function Home({
  onAdd,
  onDump,
  onCategory,
}: {
  onAdd: () => void
  onDump?: () => void
  onCategory: (category: ExpenseCategory | null, month: string) => void
}) {
  const { state, setSavingsGoal, setViewMonth } = useStore()
  const now = new Date()
  const activity = monthsWithActivity(state.expenses)
  const allowed = visibleMonths(state.expenses, now, state.startedAt)
  const fallbackKey =
    state.viewMonth && allowed.includes(state.viewMonth)
      ? state.viewMonth
      : (activity[0] ?? monthKey(now))
  const [viewKey, setViewKey] = useState(fallbackKey)
  const [txFilter, setTxFilter] = useState<'all' | 'in' | 'out'>('all')
  const [editGoal, setEditGoal] = useState(false)
  const [goalName, setGoalName] = useState('')
  const [goalAmount, setGoalAmount] = useState('')
  const monthKeyShown = allowed.includes(viewKey) ? viewKey : fallbackKey
  const monthIndex = allowed.indexOf(monthKeyShown)
  const prevMonth = monthIndex > 0 ? allowed[monthIndex - 1] : null
  const nextMonth = monthIndex >= 0 && monthIndex < allowed.length - 1 ? allowed[monthIndex + 1] : null

  useEffect(() => {
    if (state.viewMonth && state.viewMonth !== viewKey) {
      setViewKey(state.viewMonth)
    }
  }, [state.viewMonth, viewKey])

  useEffect(() => {
    if (monthKeyShown) setViewMonth(monthKeyShown)
  }, [monthKeyShown, setViewMonth])

  function goMonth(key: string | null) {
    if (!key) return
    setViewKey(key)
    setViewMonth(key)
  }

  const view = dateFromMonthKey(monthKeyShown)
  const income = incomeThisMonth(state.expenses, view)
  const spent = spentThisMonth(state.expenses, view)
  const leftover = leftoverThisMonth(state.expenses, view)
  const cover = dataCoverage(state.expenses)
  const categories = spentByCategory(state.expenses, view)
  const txs = monthExpenses(state.expenses, view)
  const shown = txs.filter((e) => {
    if (txFilter === 'in') return e.direction === 'in'
    if (txFilter === 'out') return e.direction !== 'in'
    return true
  })
  const goal = state.goals.find((g) => g.active) ?? null
  const usedSavings = leftover < 0 ? -leftover : 0
  const saved = leftover > 0 ? leftover : 0

  const donut = useMemo(() => {
    if (spent <= 0 || categories.length === 0) return 'var(--paper-2)'
    let cursor = 0
    const parts: string[] = []
    categories.forEach((row, i) => {
      const next = cursor + (row.amount / spent) * 100
      parts.push(`${DONUT[i % DONUT.length]} ${cursor}% ${next}%`)
      cursor = next
    })
    return `conic-gradient(${parts.join(', ')})`
  }, [categories, spent])

  function saveGoal() {
    const amount = Math.round(Number(goalAmount.replace(/\s/g, '').replace(',', '.')))
    if (!amount || amount <= 0) return
    setSavingsGoal(goalName.trim() || 'Sparing', amount)
    setEditGoal(false)
  }

  return (
    <main className="screen kart">
      <header className="kart-top">
        <div className="kart-month">
          <button
            type="button"
            className="kart-nav"
            disabled={!prevMonth}
            onClick={() => goMonth(prevMonth)}
          >
            ‹
          </button>
          <h1>{monthTitleFromKey(monthKeyShown)}</h1>
          <button
            type="button"
            className="kart-nav"
            disabled={!nextMonth}
            onClick={() => goMonth(nextMonth)}
          >
            ›
          </button>
        </div>
        <div className="kart-top-actions">
          {onDump && (
            <button type="button" className="btn-ghost btn-small" onClick={onDump}>
              Kontoutskrift
            </button>
          )}
          <button type="button" className="btn-primary btn-small" onClick={onAdd}>
            + Ny
          </button>
        </div>
      </header>

      {!cover.enoughForPatterns && (
        <p className="hint kart-cover">
          {coverageCopy(cover)}
          {onDump ? ' ' : ''}
          {onDump && (
            <button type="button" className="text-link" onClick={onDump}>
              Kontoutskrift
            </button>
          )}
        </p>
      )}

      <div className="kart-grid">
        <div className="kart-left">
          <section className="kart-card">
            <p className="kicker">Du har igjen · {monthTitleFromKey(monthKeyShown)}</p>
            <p className={`kart-hero ${leftover < 0 ? 'is-over' : ''}`}>
              {formatNokPlain(leftover)}
              <span> kr</span>
            </p>
          </section>

          <div className="kart-stats">
            <section className="kart-card">
              <p className="kicker">Inntekter</p>
              <p className="kart-stat is-in">{formatNok(income)}</p>
            </section>
            <section className="kart-card">
              <p className="kicker">Utgifter</p>
              <p className="kart-stat is-out">{formatNok(spent)}</p>
            </section>
            <section className="kart-card kart-save">
              <p className="kicker">Sparing</p>
              {editGoal ? (
                <div className="kart-goal-edit">
                  <input
                    className="text-input"
                    placeholder="Navn på målet"
                    value={goalName}
                    onChange={(e) => setGoalName(e.target.value)}
                  />
                  <input
                    className="text-input"
                    inputMode="numeric"
                    placeholder="Beløp"
                    value={goalAmount}
                    onChange={(e) => setGoalAmount(e.target.value)}
                  />
                  <button type="button" className="btn-primary btn-small" onClick={saveGoal}>
                    Lagre mål
                  </button>
                </div>
              ) : goal ? (
                <button
                  type="button"
                  className="kart-save-btn"
                  onClick={() => {
                    setGoalName(goal.name)
                    setGoalAmount(String(goal.targetAmount))
                    setEditGoal(true)
                  }}
                >
                  <p className="kart-stat">{formatNok(goal.targetAmount)}</p>
                  <p className="hint">{goal.name}</p>
                  {usedSavings > 0 ? (
                    <p className="kart-used">Brukt {formatNok(usedSavings)} av sparingen</p>
                  ) : (
                    <p className="hint">Spart {formatNok(saved)} denne måneden</p>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  className="kart-save-btn"
                  onClick={() => {
                    setGoalName('')
                    setGoalAmount('')
                    setEditGoal(true)
                  }}
                >
                  <p className="kart-stat">Sett et mål</p>
                  {usedSavings > 0 ? (
                    <p className="kart-used">Brukt {formatNok(usedSavings)} av sparingen</p>
                  ) : saved > 0 ? (
                    <p className="hint">Spart {formatNok(saved)} denne måneden</p>
                  ) : (
                    <p className="hint">Ett beløp. Minus vises som brukt av sparingen.</p>
                  )}
                </button>
              )}
            </section>
          </div>

          <section className="kart-card">
            <p className="kicker">Utgifter etter kategori</p>
            <p className="hint">Fordeling {monthTitleFromKey(monthKeyShown).toLowerCase()}</p>
            {categories.length === 0 ? (
              <p className="empty">Ingen utgifter denne måneden.</p>
            ) : (
              <div className="kart-cats">
                <div className="kart-donut" style={{ background: donut }} aria-hidden>
                  <span>
                    {formatNokPlain(spent)}
                    <em>kr</em>
                  </span>
                </div>
                <ul className="kart-bars">
                  {categories.map((row, i) => (
                    <li key={row.key}>
                      <button type="button" onClick={() => onCategory(row.category, monthKeyShown)}>
                        <span>
                          <i style={{ background: DONUT[i % DONUT.length] }} />
                          {row.label}
                        </span>
                        <strong>{formatNok(row.amount)}</strong>
                      </button>
                      <b style={{ width: `${spent ? (row.amount / spent) * 100 : 0}%` }} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>

        <section className="kart-card kart-txs">
          <div className="kart-tx-head">
            <h2>Transaksjoner</h2>
            <div className="kart-filters">
              {(['all', 'in', 'out'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={txFilter === f ? 'on' : ''}
                  onClick={() => setTxFilter(f)}
                >
                  {f === 'all' ? 'Alle' : f === 'in' ? 'Inntekt' : 'Utgift'}
                </button>
              ))}
            </div>
          </div>
          {shown.length === 0 ? (
            <p className="empty">Ingen poster. Dump forrige måneds utskrift hos finansministeren.</p>
          ) : (
            <ul className="kart-tx-list">
              {shown.map((e) => (
                <li key={e.id}>
                  <span>
                    <strong>{e.note?.trim() || (e.direction === 'in' ? 'Inn' : 'Utgift')}</strong>
                    <em>
                      {e.direction === 'in' ? 'Inntekt' : categoryLabel(e.category)} ·{' '}
                      {formatShortDate(new Date(`${e.date}T12:00:00`))}
                    </em>
                  </span>
                  <b className={e.direction === 'in' ? 'is-in' : 'is-out'}>
                    {e.direction === 'in' ? '+' : '−'} {formatNokPlain(e.amount)} kr
                  </b>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
