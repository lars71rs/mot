type Tab = 'meet' | 'home' | 'settings' | 'import'

export function Sidebar({
  active,
  onMeet,
  onHome,
  onImport,
  onSettings,
}: {
  active: Tab
  onMeet: () => void
  onHome: () => void
  onImport: () => void
  onSettings: () => void
}) {
  return (
    <aside className="sidebar">
      <p className="wordmark">Mot</p>
      <nav aria-label="Hovedmeny">
        <button type="button" className={active === 'home' ? 'on' : ''} onClick={onHome}>
          Kartet
        </button>
        <button type="button" className={active === 'import' ? 'on' : ''} onClick={onImport}>
          Kontoutskrift
        </button>
        <button type="button" className={active === 'meet' ? 'on' : ''} onClick={onMeet}>
          Finansminister
        </button>
        <button
          type="button"
          className={active === 'settings' ? 'on' : ''}
          onClick={onSettings}
        >
          Oppsett
        </button>
      </nav>
    </aside>
  )
}
