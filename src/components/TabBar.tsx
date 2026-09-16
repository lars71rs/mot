type Tab = 'home' | 'settings'

export function TabBar({
  active,
  onHome,
  onSettings,
}: {
  active: Tab
  onHome: () => void
  onSettings: () => void
}) {
  return (
    <nav className="tabbar" aria-label="Hovedmeny">
      <button type="button" className={active === 'home' ? 'on' : ''} onClick={onHome}>
        Hjem
      </button>
      <button
        type="button"
        className={active === 'settings' ? 'on' : ''}
        onClick={onSettings}
      >
        Oppsett
      </button>
    </nav>
  )
}
