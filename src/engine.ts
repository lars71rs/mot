import { formatDuration, formatNok, toISODate } from './format'
import type { Expense, Goal, GoalType } from './types'

export type EngineGoal = {
  type: GoalType
  name: string
  targetAmount: number
  alreadySaved: number
  months: number
}

export type EngineInput = {
  monthlyIncome: number
  fixedTotal: number
  goal: EngineGoal | null
  expenses: Pick<Expense, 'amount' | 'date'>[]
  now: Date
}

export type PaceStatus = 'ok' | 'behind' | 'over'

export type EngineResult = {
  daysInMonth: number
  dayOfMonth: number
  monthlyFree: number
  monthlySaving: number
  remainingToSave: number
  planImpossible: boolean
  noRoom: boolean
  goalReached: boolean
  dailyPlan: number
  dailyToday: number
  remainingToday: number
  dailyTomorrow: number
  spentToday: number
  spentThisMonth: number
  plannedSoFar: number
  todayOver: number
  monthOver: number
  overToday: boolean
  lastDayOfMonth: boolean
  status: PaceStatus
  planLine: string
  consequence: Consequence | null
}

export type Consequence = {
  overAmount: number
  tomorrow: number
  headline: string
  thisExpenseDays: number | null
  ifContinueDays: number | null
}

export function daysInCalendarMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

export function monthlySavingFor(goal: EngineGoal | null): number {
  if (!goal) return 0
  const remaining = goal.targetAmount - goal.alreadySaved
  if (remaining <= 0) return 0
  if (goal.months < 1) return remaining
  return Math.round(remaining / goal.months)
}

export const PLAN_DOES_NOT_FIT =
  'Planen går ikke opp. Øk tiden, senk beløpet eller kutt faste.'

export function planDoesNotFit(
  goal: EngineGoal,
  monthlyIncome: number,
  fixedTotal: number,
): boolean {
  const remaining = goal.targetAmount - goal.alreadySaved
  if (remaining <= 0 || goal.months < 1) return false
  return remaining / goal.months > monthlyIncome - fixedTotal
}

export function dailyPlanFor(
  monthlyIncome: number,
  fixedTotal: number,
  goal: EngineGoal | null,
  date: Date,
): {
  dailyPlan: number
  monthlyFree: number
  monthlySaving: number
  noRoom: boolean
  planImpossible: boolean
  remainingToSave: number
  goalReached: boolean
} {
  const days = daysInCalendarMonth(date)
  const monthlyFree = monthlyIncome - fixedTotal
  const remainingToSave = goal ? Math.max(0, goal.targetAmount - goal.alreadySaved) : 0
  const goalReached = Boolean(goal && remainingToSave === 0)
  const monthlySaving = monthlySavingFor(goal)
  const noRoom = monthlyFree <= 0
  const planImpossible = Boolean(
    goal && !goalReached && remainingToSave / Math.max(1, goal.months) > monthlyFree,
  )
  const spendable = Math.max(0, monthlyFree - (planImpossible ? 0 : monthlySaving))
  const dailyPlan = noRoom || planImpossible ? 0 : Math.round(spendable / days)
  return {
    dailyPlan,
    monthlyFree,
    monthlySaving,
    noRoom,
    planImpossible,
    remainingToSave,
    goalReached,
  }
}

export function activeGoal(goals: Goal[]): Goal | null {
  return goals.find((g) => g.active) ?? null
}

export function calculate(input: EngineInput): EngineResult {
  const { monthlyIncome, fixedTotal, goal, expenses, now } = input
  const days = daysInCalendarMonth(now)
  const dayOfMonth = now.getDate()
  const todayIso = toISODate(now)
  const year = now.getFullYear()
  const month = now.getMonth()
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}-`

  const planned = dailyPlanFor(monthlyIncome, fixedTotal, goal, now)
  const {
    dailyPlan,
    monthlyFree,
    monthlySaving,
    noRoom,
    planImpossible,
    remainingToSave,
    goalReached,
  } = planned

  let spentThisMonth = 0
  let spentToday = 0
  for (const e of expenses) {
    if (!e.date.startsWith(monthPrefix)) continue
    spentThisMonth += e.amount
    if (e.date === todayIso) spentToday += e.amount
  }

  const dailyToday = dailyPlan
  const remainingToday = dailyToday - spentToday
  const todayOver = Math.max(0, spentToday - dailyPlan)
  const overToday = todayOver > 0
  const lastDayOfMonth = dayOfMonth >= days
  const futureDays = days - dayOfMonth
  const nextMonth = new Date(year, month + 1, 1)
  const dailyTomorrow = lastDayOfMonth
    ? dailyPlanFor(monthlyIncome, fixedTotal, goal, nextMonth).dailyPlan
    : overToday && futureDays > 0
      ? Math.max(0, Math.round((futureDays * dailyPlan - todayOver) / futureDays))
      : dailyPlan

  const plannedSoFar = dailyPlan * dayOfMonth
  const monthOver = Math.max(0, spentThisMonth - plannedSoFar)
  const status: PaceStatus = overToday ? 'over' : monthOver > 0 ? 'behind' : 'ok'

  const planLine = buildPlanLine({
    goal,
    goalReached,
    noRoom,
    planImpossible,
    dailyPlan,
    monthlyFree,
    monthlySaving,
  })

  const consequence =
    overToday && !noRoom && !planImpossible
      ? buildConsequence({
          goal,
          remainingToSave,
          monthlySaving,
          overAmount: todayOver,
          dailyTomorrow,
        })
      : null

  return {
    daysInMonth: days,
    dayOfMonth,
    monthlyFree,
    monthlySaving,
    remainingToSave,
    planImpossible,
    noRoom,
    goalReached,
    dailyPlan,
    dailyToday,
    remainingToday,
    dailyTomorrow,
    spentToday,
    spentThisMonth,
    plannedSoFar,
    todayOver,
    monthOver,
    overToday,
    lastDayOfMonth,
    status,
    planLine,
    consequence,
  }
}

function buildPlanLine(args: {
  goal: EngineGoal | null
  goalReached: boolean
  noRoom: boolean
  planImpossible: boolean
  dailyPlan: number
  monthlyFree: number
  monthlySaving: number
}): string {
  const { goal, dailyPlan } = args
  if (args.noRoom) {
    return 'De faste utgiftene er like store som eller større enn inntekten. Det er ikke noe igjen å bruke per dag.'
  }
  if (args.planImpossible && goal) {
    return `For å nå målet på ${formatDuration(goal.months)} må du sette av ${formatNok(args.monthlySaving)} i måneden. Etter faste utgifter har du ${formatNok(args.monthlyFree)} igjen. Planen går ikke opp.`
  }
  if (args.goalReached && goal) {
    return `Du har nådd målet. Dagsgrensen er ${formatNok(dailyPlan)} — inntekt minus faste, uten sparing.`
  }
  if (goal) {
    return `Du kan bruke ${formatNok(dailyPlan)} om dagen og likevel nå målet om ${formatDuration(goal.months)}.`
  }
  return `Uten mål er dagsgrensen ${formatNok(dailyPlan)} — det som er igjen etter faste utgifter, fordelt på måneden.`
}

function buildConsequence(args: {
  goal: EngineGoal | null
  remainingToSave: number
  monthlySaving: number
  overAmount: number
  dailyTomorrow: number
}): Consequence {
  const headline = `Du har brukt ${formatNok(args.overAmount)} mer enn planen i dag. I morgen blir ${formatNok(args.dailyTomorrow)}.`
  const hasGoal =
    Boolean(args.goal) && args.remainingToSave > 0 && args.monthlySaving > 0
  const thisExpenseDays = hasGoal
    ? Math.round(args.overAmount / (args.monthlySaving / 30))
    : null
  const daysUntilGoal = hasGoal && args.goal ? args.goal.months * 30 : 0
  const ifContinueDays =
    hasGoal && thisExpenseDays !== null
      ? Math.round((args.overAmount * daysUntilGoal) / (args.monthlySaving / 30))
      : null
  return {
    overAmount: args.overAmount,
    tomorrow: args.dailyTomorrow,
    headline,
    thisExpenseDays,
    ifContinueDays,
  }
}
