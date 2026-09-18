import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'

export function AppShell({
  active,
  onMeet,
  onHome,
  onAdd,
  onImport,
  onSettings,
  children,
}: {
  active: 'meet' | 'home' | 'add' | 'import' | 'settings'
  onMeet: () => void
  onHome: () => void
  onAdd: () => void
  onImport: () => void
  onSettings: () => void
  children: ReactNode
}) {
  return (
    <div className="desk">
      <Sidebar
        active={active}
        onMeet={onMeet}
        onHome={onHome}
        onAdd={onAdd}
        onImport={onImport}
        onSettings={onSettings}
      />
      <div className={`desk-main ${active === 'meet' ? 'desk-main-meet' : ''}`}>{children}</div>
    </div>
  )
}
