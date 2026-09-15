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
      <h1>Hva du kan bruke i dag uten å ødelegge målet.</h1>
      <p className="lede">
        Du legger inn inntekt og faste utgifter. Mot gir deg en dagsgrense. Et
        sparemål er valgfritt — og strammer grensen når du lager et.
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
