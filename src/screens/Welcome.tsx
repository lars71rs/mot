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
      <h1>Slik starter du.</h1>
      <ol className="manual">
        <li>
          Last ned kontoutskrift fra nettbanken (PDF eller CSV). Start med forrige måned —
          tre måneder trengs for mønster.
        </li>
        <li>
          Slipp filen på <strong>Kontoutskrift</strong>. Ikke lim inn filstien.
        </li>
        <li>Kartet fylles. Ministeren forklarer etterpå, i prat.</li>
      </ol>
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
