import { ChartFrame } from '@/components/charts/ChartFrame'
import { CalorieChart, type CalorieDatum } from '@/components/charts/charts'
import { chart } from '@/components/charts/theme'
import { SectionHeading } from '@/components/ui/Headings'
import { Stat } from '@/components/ui/Stat'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { useGoals, useNutritionTotals } from '@/features/nutrition/hooks'
import { addDays, formatDateMedium, startOfWeek } from '@/lib/dates'
import { formatNumber } from '@/lib/units'
import { resolveGoalForDate } from '@/lib/nutrition'
import type { Period } from '../period'

function groupByWeek(days: CalorieDatum[]): Map<string, CalorieDatum[]> {
  const groups = new Map<string, CalorieDatum[]>()
  for (const d of days) {
    const week = startOfWeek(d.date)
    groups.set(week, [...(groups.get(week) ?? []), d])
  }
  return groups
}

/** Within this fraction of the calorie target counts as "on target". */
const ON_TARGET = 0.1

export function NutritionSection({ period }: { period: Period }) {
  const totals = useNutritionTotals(period.from, period.to)
  const goals = useGoals()

  if (totals.isError || goals.isError) {
    return (
      <section aria-labelledby="nutrition-heading">
        <SectionHeading id="nutrition-heading" title="Nutrition consistency" />
        <ErrorState error={totals.error ?? goals.error} onRetry={() => { totals.refetch(); goals.refetch() }} />
      </section>
    )
  }
  if (totals.isPending || goals.isPending) {
    return (
      <section aria-labelledby="nutrition-heading">
        <SectionHeading id="nutrition-heading" title="Nutrition consistency" />
        <LoadingState label="Loading nutrition data" />
      </section>
    )
  }

  const byDate = new Map(totals.data.map((d) => [d.entry_date, d]))
  const days: CalorieDatum[] = []
  for (let d = period.from; d <= period.to; d = addDays(d, 1)) {
    days.push({ date: d, calories: byDate.get(d)?.calories ?? null, target: resolveGoalForDate(goals.data, d).goal?.calories ?? null })
  }
  const logged = days.filter((d) => d.calories != null)
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  const avgCalories = avg(logged.map((d) => d.calories!))
  const avgProtein = avg(totals.data.map((d) => d.protein_g))
  const withTarget = logged.filter((d) => d.target != null)
  const onTarget = withTarget.filter((d) => Math.abs(d.calories! - d.target!) <= d.target! * ON_TARGET).length

  // Long periods: weekly average of logged days, so bars stay readable.
  const weekly = period.days > 84
  const series: CalorieDatum[] = weekly
    ? [...groupByWeek(days).entries()].map(([week, ds]) => {
        const lc = ds.filter((d) => d.calories != null).map((d) => d.calories!)
        return { date: week, calories: lc.length ? Math.round(avg(lc)!) : null, target: resolveGoalForDate(goals.data, week).goal?.calories ?? null }
      })
    : days

  return (
    <section aria-labelledby="nutrition-heading">
      <SectionHeading id="nutrition-heading" title="Nutrition consistency" />
      <dl className="mb-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
        <Stat label="Days logged" value={`${logged.length} / ${days.length}`} sub={`Last ${period.label}`} />
        <Stat label="Avg calories" value={avgCalories != null ? formatNumber(avgCalories, 0) : 'None'} unit={avgCalories != null ? 'kcal' : undefined} sub="On logged days" />
        <Stat label="Avg protein" value={avgProtein != null ? formatNumber(avgProtein, 0) : 'None'} unit={avgProtein != null ? 'g' : undefined} sub="On logged days" />
        <Stat label="Near target" value={withTarget.length ? `${onTarget} / ${withTarget.length}` : 'None'} sub={`Logged days within ${ON_TARGET * 100}% of calories`} />
      </dl>
      <ChartFrame
        title="Am I eating close to my target?"
        caption={weekly
          ? 'Average calories on logged days, per week, against the target in effect. Weeks with nothing logged are empty, not zero.'
          : 'Calories logged each day against the target in effect. Days with nothing logged are empty, not zero.'}
        legend={[
          { label: weekly ? 'Weekly average logged' : 'Calories logged', kind: 'bar', color: chart.teal },
          { label: 'Target', kind: 'step', color: chart.navy },
        ]}
        unit="kcal"
        summary={`${logged.length} of ${days.length} days logged; average ${avgCalories != null ? formatNumber(avgCalories, 0) : 'no'} kcal on logged days.`}
        table={{
          columns: [weekly ? 'Week of' : 'Date', 'Calories (kcal)', 'Target (kcal)'],
          rows: series.map((d) => [formatDateMedium(d.date), d.calories == null ? 'Not logged' : formatNumber(d.calories, 0), d.target == null ? '-' : formatNumber(d.target, 0)]),
        }}
      >
        <CalorieChart data={series} />
      </ChartFrame>
      <p className="mt-3 text-xs text-ink-muted">Partially logged days lower the averages. Only days with at least one entry count as logged.</p>
    </section>
  )
}
