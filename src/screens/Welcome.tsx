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
      <h1>Finansministeren din.</h1>
      <p className="lede">
        Dump måneden fra nettbanken, eller si hva du lurer på. Ministeren leser
        tavlen, peker på vaner, og kan flytte på den.
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
