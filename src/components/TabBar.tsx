type Tab = 'home' | 'budget' | 'goals' | 'settings'

export function TabBar({
  active,
  onHome,
  onBudget,
  onGoals,
  onSettings,
}: {
  active: Tab
  onHome: () => void
  onBudget: () => void
  onGoals: () => void
  onSettings: () => void
}) {
  return (
    <nav className="tabbar" aria-label="Hovedmeny">
      <button type="button" className={active === 'home' ? 'on' : ''} onClick={onHome}>
        Hjem
      </button>
      <button
        type="button"
        className={active === 'budget' ? 'on' : ''}
        onClick={onBudget}
      >
        Budsjett
      </button>
      <button type="button" className={active === 'goals' ? 'on' : ''} onClick={onGoals}>
        Mål
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
