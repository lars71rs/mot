import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'

export function AppShell({
  active,
  onMeet,
  onHome,
  onImport,
  onSettings,
  children,
}: {
  active: 'meet' | 'home' | 'settings' | 'import'
  onMeet: () => void
  onHome: () => void
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
        onImport={onImport}
        onSettings={onSettings}
      />
      <div className={`desk-main ${active === 'meet' ? 'desk-main-meet' : ''}`}>{children}</div>
    </div>
  )
}
