import { useEffect, useState } from 'react'
import { AddExpense } from './screens/AddExpense'
import { Budget } from './screens/Budget'
import { BudgetCategory } from './screens/BudgetCategory'
import { FixedExpenses } from './screens/FixedExpenses'
import { GoalEdit } from './screens/GoalEdit'
import { Goals } from './screens/Goals'
import { Home } from './screens/Home'
import { Income } from './screens/Income'
import { Settings } from './screens/Settings'
import { Welcome } from './screens/Welcome'
import { toISODate } from './format'
import { useStore } from './store'
import type { Route } from './types'

export default function App() {
  const { state, loadDemo, addExpense } = useStore()
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
    if (params.get('over') === '1') {
      addExpense(600, toISODate(new Date()), 'fritid')
    }
    setRoute({ name: 'home' })
  }, [demoTried, loadDemo, addExpense])

  const goHome = () => setRoute({ name: 'home' })
  const goBudget = () => setRoute({ name: 'budget' })
  const goGoals = () => setRoute({ name: 'goals' })
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
    case 'budget':
      return (
        <Budget
          onHome={goHome}
          onGoals={goGoals}
          onSettings={goSettings}
          onOpenPost={(post) => setRoute({ name: 'budget-category', post })}
        />
      )
    case 'budget-category':
      return (
        <BudgetCategory post={route.post} onBack={goBudget} />
      )
    case 'goals':
      return (
        <Goals
          onHome={goHome}
          onBudget={goBudget}
          onSettings={goSettings}
          onEdit={(id) => setRoute({ name: 'goal-edit', id })}
        />
      )
    case 'goal-edit':
      return (
        <GoalEdit
          id={route.id}
          onBack={goGoals}
          onDone={goHome}
        />
      )
    case 'settings':
      return (
        <Settings
          onHome={goHome}
          onBudget={goBudget}
          onGoals={goGoals}
          onIncome={() => setRoute({ name: 'income', fromOnboarding: false })}
          onFixed={() => setRoute({ name: 'fixed', fromOnboarding: false })}
        />
      )
    default:
      return (
        <Home
          onAdd={() => setRoute({ name: 'add-expense' })}
          onBudget={goBudget}
          onGoals={goGoals}
          onSettings={goSettings}
        />
      )
  }
}
