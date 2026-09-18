import { useEffect, useState } from 'react'
import { AppShell } from './components/AppShell'
import { AddExpense } from './screens/AddExpense'
import { CategoryMonth } from './screens/CategoryMonth'
import { FixedExpenses } from './screens/FixedExpenses'
import { Home } from './screens/Home'
import { ImportBank } from './screens/ImportBank'
import { Meet } from './screens/Meet'
import { Income } from './screens/Income'
import { Settings } from './screens/Settings'
import { Welcome } from './screens/Welcome'
import { useStore } from './store'
import type { Route } from './types'

export default function App() {
  const { state, loadDemo } = useStore()
  const [route, setRoute] = useState<Route>(() =>
    state.onboarded ? { name: 'meet' } : { name: 'welcome' },
  )
  const [demoTried, setDemoTried] = useState(false)

  useEffect(() => {
    if (demoTried) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('demo') !== '1') return
    setDemoTried(true)
    loadDemo()
    setRoute({ name: 'meet' })
  }, [demoTried, loadDemo])

  const goMeet = () => setRoute({ name: 'meet' })
  const goHome = () => setRoute({ name: 'home' })
  const goAdd = () => setRoute({ name: 'add-expense' })
  const goImport = () => setRoute({ name: 'import' })
  const goSettings = () => setRoute({ name: 'settings' })

  if (!state.onboarded) {
    if (route.name === 'income') {
      return (
        <div className="gate">
          <Income
            fromOnboarding
            onNext={() => setRoute({ name: 'fixed', fromOnboarding: true })}
          />
        </div>
      )
    }
    if (route.name === 'fixed') {
      return (
        <div className="gate">
          <FixedExpenses
            fromOnboarding
            onBack={() => setRoute({ name: 'income', fromOnboarding: true })}
            onNext={goMeet}
          />
        </div>
      )
    }
    return (
      <div className="gate">
        <Welcome
          onStart={() => setRoute({ name: 'income', fromOnboarding: true })}
          onDemo={() => {
            loadDemo()
            goMeet()
          }}
        />
      </div>
    )
  }

  let active: 'meet' | 'home' | 'add' | 'import' | 'settings' = 'meet'
  if (route.name === 'home' || route.name === 'category') active = 'home'
  if (route.name === 'add-expense') active = 'add'
  if (route.name === 'import') active = 'import'
  if (route.name === 'settings' || route.name === 'income' || route.name === 'fixed') {
    active = 'settings'
  }

  let body
  switch (route.name) {
    case 'income':
      body = (
        <Income
          fromOnboarding={false}
          onBack={goSettings}
          onNext={goSettings}
        />
      )
      break
    case 'fixed':
      body = (
        <FixedExpenses
          fromOnboarding={false}
          onBack={goSettings}
          onNext={goSettings}
        />
      )
      break
    case 'add-expense':
      body = <AddExpense onBack={goMeet} onDone={goMeet} />
      break
    case 'import':
      body = <ImportBank onDone={goMeet} />
      break
    case 'meet':
      body = <Meet />
      break
    case 'category':
      body = <CategoryMonth category={route.category} onBack={goHome} />
      break
    case 'settings':
      body = (
        <Settings
          onIncome={() => setRoute({ name: 'income', fromOnboarding: false })}
          onFixed={() => setRoute({ name: 'fixed', fromOnboarding: false })}
          onReset={goMeet}
        />
      )
      break
    default:
      body = (
        <Home
          onAdd={goAdd}
          onCategory={(category) => setRoute({ name: 'category', category })}
        />
      )
  }

  return (
    <AppShell
      active={active}
      onMeet={goMeet}
      onHome={goHome}
      onAdd={goAdd}
      onImport={goImport}
      onSettings={goSettings}
    >
      {body}
    </AppShell>
  )
}
