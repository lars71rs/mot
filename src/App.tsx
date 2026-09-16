import { useEffect, useState } from 'react'
import { AddExpense } from './screens/AddExpense'
import { CategoryMonth } from './screens/CategoryMonth'
import { FixedExpenses } from './screens/FixedExpenses'
import { Home } from './screens/Home'
import { Income } from './screens/Income'
import { Settings } from './screens/Settings'
import { Welcome } from './screens/Welcome'
import { useStore } from './store'
import type { Route } from './types'

export default function App() {
  const { state, loadDemo } = useStore()
  const [route, setRoute] = useState<Route>(() =>
    state.onboarded ? { name: 'home' } : { name: 'welcome' },
  )
  const [demoTried, setDemoTried] = useState(false)

  useEffect(() => {
    if (demoTried) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('demo') !== '1') return
    setDemoTried(true)
    loadDemo()
    setRoute({ name: 'home' })
  }, [demoTried, loadDemo])

  const goHome = () => setRoute({ name: 'home' })
  const goSettings = () => setRoute({ name: 'settings' })

  if (!state.onboarded) {
    if (route.name === 'income') {
      return (
        <Income
          fromOnboarding
          onNext={() => setRoute({ name: 'fixed', fromOnboarding: true })}
        />
      )
    }
    if (route.name === 'fixed') {
      return (
        <FixedExpenses
          fromOnboarding
          onBack={() => setRoute({ name: 'income', fromOnboarding: true })}
          onNext={goHome}
        />
      )
    }
    return (
      <Welcome
        onStart={() => setRoute({ name: 'income', fromOnboarding: true })}
        onDemo={() => {
          loadDemo()
          goHome()
        }}
      />
    )
  }

  switch (route.name) {
    case 'income':
      return (
        <Income
          fromOnboarding={false}
          onBack={goSettings}
          onNext={goSettings}
        />
      )
    case 'fixed':
      return (
        <FixedExpenses
          fromOnboarding={false}
          onBack={goSettings}
          onNext={goSettings}
        />
      )
    case 'add-expense':
      return <AddExpense onBack={goHome} onDone={goHome} />
    case 'category':
      return <CategoryMonth category={route.category} onBack={goHome} />
    case 'settings':
      return (
        <Settings
          onHome={goHome}
          onIncome={() => setRoute({ name: 'income', fromOnboarding: false })}
          onFixed={() => setRoute({ name: 'fixed', fromOnboarding: false })}
        />
      )
    default:
      return (
        <Home
          onAdd={() => setRoute({ name: 'add-expense' })}
          onSettings={goSettings}
          onCategory={(category) => setRoute({ name: 'category', category })}
        />
      )
  }
}
