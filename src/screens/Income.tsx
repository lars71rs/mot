import { useState } from 'react'
import { AmountField } from '../components/AmountField'
import { amountFromField, formatNokPlain } from '../format'
import { useStore } from '../store'

export function Income({
  fromOnboarding,
  onNext,
  onBack,
}: {
  fromOnboarding: boolean
  onNext: () => void
  onBack?: () => void
}) {
  const { state, setIncome } = useStore()
  const [raw, setRaw] = useState(
    state.monthlyIncome > 0 ? formatNokPlain(state.monthlyIncome) : '',
  )
  const amount = amountFromField(raw)

  return (
    <main className="screen">
      {onBack && (
        <button type="button" className="back" onClick={onBack}>
          Tilbake
        </button>
      )}
      <p className="kicker">{fromOnboarding ? 'Steg 1 av 2' : 'Oppsett'}</p>
      <h1>Vanlig månedsinntekt etter skatt</h1>
      <p className="lede">
        Det du kan regne med hver måned. Ikke feriepenger, ikke sommerjobb, ikke
        gaver — det er ikke vanlig inntekt.
      </p>
      <AmountField value={raw} onChange={setRaw} large autoFocus />
      <div className="stack">
        <button
          type="button"
          className="btn-primary"
          disabled={amount <= 0}
          onClick={() => {
            setIncome(amount)
            onNext()
          }}
        >
          {fromOnboarding ? 'Neste' : 'Lagre'}
        </button>
      </div>
    </main>
  )
}
