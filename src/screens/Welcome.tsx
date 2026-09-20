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
          Last ned kontoutskrift for <strong>forrige kalendermåned</strong> fra nettbanken (PDF
          eller CSV).
        </li>
        <li>
          Slipp filen i chatten, eller bruk <strong>Fil</strong>. Ikke lim inn filstien.
        </li>
        <li>Ministeren tegner kartet. Du retter i prat, ikke i et skjema.</li>
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
