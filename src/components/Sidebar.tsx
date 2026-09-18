type Tab = 'meet' | 'home' | 'add' | 'import' | 'settings'

export function Sidebar({
  active,
  onMeet,
  onHome,
  onAdd,
  onImport,
  onSettings,
}: {
  active: Tab
  onMeet: () => void
  onHome: () => void
  onAdd: () => void
  onImport: () => void
  onSettings: () => void
}) {
  return (
    <aside className="sidebar">
      <p className="wordmark">Mot</p>
      <nav aria-label="Hovedmeny">
        <button type="button" className={active === 'meet' ? 'on' : ''} onClick={onMeet}>
          Finansminister
        </button>
        <button type="button" className={active === 'home' ? 'on' : ''} onClick={onHome}>
          Tavlen
        </button>
        <button type="button" className={active === 'add' ? 'on' : ''} onClick={onAdd}>
          Legg inn utgift
        </button>
        <button type="button" className={active === 'import' ? 'on' : ''} onClick={onImport}>
          Bankfil
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
