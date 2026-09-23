import { useEffect, useState } from 'react'
import { AppShell } from './components/AppShell'
import { AddExpense } from './screens/AddExpense'
import { CategoryMonth } from './screens/CategoryMonth'
import { Home } from './screens/Home'
import { ImportBank } from './screens/ImportBank'
import { Meet } from './screens/Meet'
import { Profile } from './screens/Profile'
import { Settings } from './screens/Settings'
import { Welcome } from './screens/Welcome'
import { useStore } from './store'
import type { Route } from './types'

export default function App() {
  const { state, loadDemo, completeOnboarding } = useStore()
  const [route, setRoute] = useState<Route>(() => {
    if (!state.onboarded) return { name: 'welcome' }
    return state.expenses.length > 0 ? { name: 'home' } : { name: 'import' }
  })
  const [demoTried, setDemoTried] = useState(false)

  useEffect(() => {
    if (demoTried) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('demo') !== '1') return
    setDemoTried(true)
    loadDemo()
    setRoute({ name: 'home' })
  }, [demoTried, loadDemo])

  const goMeet = () => setRoute({ name: 'meet' })
  const goMeetAfterDump = () => setRoute({ name: 'meet', afterDump: true })
  const goHome = () => setRoute({ name: 'home' })
  const goImport = () => setRoute({ name: 'import' })
  const goAdd = () => setRoute({ name: 'add-expense' })
  const goSettings = () => setRoute({ name: 'settings' })

  if (!state.onboarded) {
    if (route.name === 'profile') {
      return (
        <div className="gate">
          <Profile
            onNext={(name, birthYear) => {
              completeOnboarding(name, birthYear)
              goImport()
            }}
          />
        </div>
      )
    }
    return (
      <div className="gate">
        <Welcome
          onStart={() => setRoute({ name: 'profile' })}
          onDemo={() => {
            loadDemo()
            goHome()
          }}
        />
      </div>
    )
  }

  let active: 'meet' | 'home' | 'settings' | 'import' = 'home'
  if (route.name === 'meet') active = 'meet'
  if (route.name === 'import') active = 'import'
  if (route.name === 'settings') active = 'settings'

  let body
  switch (route.name) {
    case 'add-expense':
      body = <AddExpense onBack={goHome} onDone={goHome} />
      break
    case 'import':
      body = <ImportBank onDone={goHome} onTalk={goMeet} onAfterDump={goMeetAfterDump} />
      break
    case 'meet':
      body = (
        <Meet
          onMap={goHome}
          onDump={goImport}
          afterDump={route.name === 'meet' && !!route.afterDump}
        />
      )
      break
    case 'category':
      body = (
        <CategoryMonth category={route.category} month={route.month} onBack={goHome} />
      )
      break
    case 'settings':
      body = <Settings onReset={goImport} />
      break
    default:
      body = (
        <Home
          onAdd={goAdd}
          onDump={goImport}
          onCategory={(category, month) => setRoute({ name: 'category', category, month })}
        />
      )
  }

  return (
    <AppShell
      active={active}
      onMeet={goMeet}
      onHome={goHome}
      onImport={goImport}
      onSettings={goSettings}
    >
      {body}
    </AppShell>
  )
}
