export function Welcome({
  onStart,
  onDemo,
}: {
  onStart: () => void
  onDemo: () => void
}) {
  return (
    <main className="screen welcome">
      <p className="wordmark">Mot</p>
      <h1>Se hvor pengene går.</h1>
      <p className="lede">
        Du legger inn inntekt og faste. Så logger du det som går ut. Mot viser
        hva du har brukt denne måneden — og på hva.
      </p>
      <div className="stack">
        <button type="button" className="btn-primary" onClick={onStart}>
          Kom i gang
        </button>
        <button type="button" className="btn-ghost" onClick={onDemo}>
          Prøv med demo-tall
        </button>
      </div>
    </main>
  )
}
