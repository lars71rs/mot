import { formatNok } from '../format'
import { useStore } from '../store'

export function Settings({
  onIncome,
  onFixed,
  onReset,
}: {
  onIncome: () => void
  onFixed: () => void
  onReset: () => void
}) {
  const { state, resetAll } = useStore()
  const total = state.fixed.reduce((s, f) => s + f.amount, 0)

  return (
    <main className="screen">
      <p className="kicker">Oppsett</p>
      <h1>Inntekt og faste</h1>
      <p className="lede">
        Rammen rundt kartet. Forbruk logger du selv. Ingen bank, ingen sky —
        alt ligger på denne enheten.
      </p>

      <button type="button" className="settings-row" onClick={onIncome}>
        <span>
          <strong>Månedsinntekt etter skatt</strong>
          <em>{formatNok(state.monthlyIncome)}</em>
        </span>
        <span className="chev">Endre</span>
      </button>

      <button type="button" className="settings-row" onClick={onFixed}>
        <span>
          <strong>Faste utgifter</strong>
          <em>
            {state.fixed.length === 0
              ? 'Ingen'
              : `${state.fixed.length} stk · ${formatNok(total)}`}
          </em>
        </span>
        <span className="chev">Endre</span>
      </button>

      <button
        type="button"
        className="text-btn danger"
        onClick={() => {
          if (confirm('Nullstille appen på denne enheten?')) {
            resetAll()
            onReset()
          }
        }}
      >
        Nullstill appen
      </button>
    </main>
  )
}
