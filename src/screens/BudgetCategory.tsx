import { BUDGET_POSTS, expensesForPost, type BudgetPost } from '../budget'
import { categoryLabel } from '../types'
import { formatDate, formatNok } from '../format'
import { useStore } from '../store'

export function BudgetCategory({
  post,
  onBack,
}: {
  post: BudgetPost
  onBack: () => void
}) {
  const { state, removeExpense } = useStore()
  const now = new Date()
  const label = BUDGET_POSTS.find((p) => p.id === post)?.label ?? post
  const items = expensesForPost(state.expenses, post, now)
  const sum = items.reduce((s, e) => s + e.amount, 0)

  return (
    <main className="screen">
      <button type="button" className="back" onClick={onBack}>
        Tilbake
      </button>
      <p className="kicker">Budsjett</p>
      <h1>{label} denne måneden</h1>
      <p className="lede">
        {items.length === 0
          ? 'Ingen utgifter i denne posten ennå.'
          : `${formatNok(sum)} brukt.`}
      </p>
      {items.length > 0 && (
        <ul className="rows">
          {items.map((e) => (
            <li key={e.id} className="row">
              <span>
                <strong>{categoryLabel(e.category)}</strong>
                <em>
                  {formatDate(e.date)} · {formatNok(e.amount)}
                </em>
              </span>
              <button
                type="button"
                className="text-btn"
                onClick={() => removeExpense(e.id)}
              >
                Slett
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
