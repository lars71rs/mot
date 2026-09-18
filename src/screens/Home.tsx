import { inPocket, spentByCategory, spentThisMonth, spentThisWeek } from '../map'
import { type ExpenseCategory } from '../types'
import { formatNok, formatNokPlain, formatShortDate, monthName } from '../format'
import { useStore } from '../store'

export function Home({
  onAdd,
  onCategory,
}: {
  onAdd: () => void
  onCategory: (category: ExpenseCategory | null) => void
}) {
  const { state } = useStore()
  const now = new Date()
  const spentMonth = spentThisMonth(state.expenses, now)
  const spentWeek = spentThisWeek(state.expenses, now)
  const fixedTotal = state.fixed.reduce((s, f) => s + f.amount, 0)
  const pocket = inPocket(state.monthlyIncome, fixedTotal, spentMonth)
  const categories = spentByCategory(state.expenses, now)
  const month = monthName(now)

  return (
    <main className="screen home">
      <header className="home-top">
        <p className="kicker">Oversikt</p>
        <p className="date">{formatShortDate(now)}</p>
      </header>

      <div className="home-board">
        <section className="hero">
          <p className="kicker">Brukt i {month}</p>
          <p className="hero-number">
            {formatNokPlain(spentMonth)}
            <span> kr</span>
          </p>
          <p className="hero-sub">Denne uka {formatNok(spentWeek)}</p>
        </section>

        <div className="home-facts">
          <dl className="meta">
            <div>
              <dt>Inntekt</dt>
              <dd>{formatNok(state.monthlyIncome)}</dd>
            </div>
            <div>
              <dt>Faste</dt>
              <dd>{formatNok(fixedTotal)}</dd>
            </div>
            <div>
              <dt>Forbruk</dt>
              <dd>{formatNok(spentMonth)}</dd>
            </div>
            <div className={pocket < 0 ? 'pocket-over' : ''}>
              <dt>I lomma</dt>
              <dd>{formatNok(pocket)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <section className="today-list">
        <div className="today-head">
          <h2>Hvor det gikk</h2>
          <button type="button" className="btn-primary btn-small" onClick={onAdd}>
            Legg inn utgift
          </button>
        </div>
        {categories.length === 0 ? (
          <p className="empty">Ingen utgifter registrert i {month}.</p>
        ) : (
          <ul className="rows">
            {categories.map((row) => (
              <li key={row.key}>
                <button
                  type="button"
                  className="row row-btn"
                  onClick={() => onCategory(row.category)}
                >
                  <span>
                    <strong>{row.label}</strong>
                  </span>
                  <em>{formatNok(row.amount)}</em>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
