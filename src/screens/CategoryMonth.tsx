import { dateFromMonthKey, expensesForCategory } from '../map'
import { categoryLabel, type ExpenseCategory } from '../types'
import { formatDate, formatNok } from '../format'
import { useStore } from '../store'

export function CategoryMonth({
  category,
  month,
  onBack,
}: {
  category: ExpenseCategory | null
  month?: string
  onBack: () => void
}) {
  const { state, removeExpense } = useStore()
  const now = month && /^\d{4}-\d{2}$/.test(month) ? dateFromMonthKey(month) : new Date()
  const items = expensesForCategory(state.expenses, category, now)
  const sum = items.reduce((s, e) => s + e.amount, 0)
  const title = categoryLabel(category)

  return (
    <main className="screen">
      <button type="button" className="back" onClick={onBack}>
        Tilbake
      </button>
      <p className="kicker">Forbruk</p>
      <h1>{title}</h1>
      <p className="lede">
        {items.length === 0 ? 'Ingen utgifter i denne kategorien denne måneden.' : formatNok(sum)}
      </p>
      {items.length > 0 && (
        <ul className="rows">
          {items.map((e) => (
            <li key={e.id} className="row">
              <span>
                <strong>{e.note?.trim() ? e.note : formatDate(e.date)}</strong>
                <em>
                  {formatDate(e.date)} · {formatNok(e.amount)}
                </em>
              </span>
              <button type="button" className="text-btn" onClick={() => removeExpense(e.id)}>
                Slett
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
