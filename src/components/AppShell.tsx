import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'

export function AppShell({
  active,
  onMeet,
  onHome,
  onSettings,
  children,
}: {
  active: 'meet' | 'home' | 'settings'
  onMeet: () => void
  onHome: () => void
  onSettings: () => void
  children: ReactNode
}) {
  return (
    <div className="desk">
      <Sidebar active={active} onMeet={onMeet} onHome={onHome} onSettings={onSettings} />
      <div className={`desk-main ${active === 'meet' ? 'desk-main-meet' : ''}`}>{children}</div>
    </div>
  )
}
