import { ChartFrame } from '@/components/charts/ChartFrame'
import { HorizontalBarChart, WeeklyBarChart } from '@/components/charts/charts'
import { SectionHeading } from '@/components/ui/Headings'
import { Stat } from '@/components/ui/Stat'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { useCompletedSets } from '@/features/training/hooks'
import { formatDateMedium } from '@/lib/dates'
import { setsByCategory, weeklyTraining } from '@/lib/training'
import { CATEGORY_LABELS } from '@/features/training/labels'
import { formatNumber, fromKg } from '@/lib/units'
import type { WeightUnit } from '@/types/database'
import type { Period } from '../period'

export function TrainingSection({ period, unit }: { period: Period; unit: WeightUnit }) {
  const sets = useCompletedSets(period.previousFrom)
  const weeks = weeklyTraining(sets.data ?? [], period.from, period.to)
  const sessions = new Set((sets.data ?? []).filter((s) => s.session_date >= period.from).map((s) => s.session_id)).size
  const volume = weeks.reduce((s, w) => s + w.volume, 0)
  const areas = setsByCategory(sets.data ?? [], period.from, period.to)

  return (
    <section aria-labelledby="training-heading">
      <SectionHeading id="training-heading" title="Training" />
      {sets.isError ? (
        <ErrorState error={sets.error} onRetry={() => sets.refetch()} />
      ) : sets.isPending ? (
        <LoadingState label="Loading training data" />
      ) : (
        <>
          <dl className="mb-10 grid grid-cols-3 gap-6 sm:max-w-xl">
            <Stat label="Workouts" value={sessions} sub={`Last ${period.label}`} />
            <Stat label="Per week" value={formatNumber(sessions / (period.days / 7), 1)} sub="Average" />
            <Stat label="Volume" value={formatNumber(fromKg(volume, unit), 0)} unit={unit} sub="Load × reps" />
          </dl>
          <div className="grid gap-10 lg:grid-cols-2">
            <ChartFrame
              title="How often am I training?"
              caption="Completed workouts per week (Monday start). Weeks with none show as empty."
              unit="Workouts"
              summary={`${sessions} completed workouts over ${weeks.length} weeks.`}
              table={{ columns: ['Week of', 'Workouts'], rows: weeks.map((w) => [formatDateMedium(w.week), w.sessions]) }}
            >
              <WeeklyBarChart valueLabel="Workouts" format={(n) => String(n)} data={weeks.map((w) => ({ week: w.week, value: w.sessions }))} />
            </ChartFrame>
            <ChartFrame
              title="How much work am I doing?"
              caption={`Weekly volume in ${unit}: load × reps over completed working and drop sets. Bodyweight sets add no load.`}
              unit={unit}
              summary={`Total volume ${formatNumber(fromKg(volume, unit), 0)} ${unit} over ${weeks.length} weeks.`}
              table={{ columns: ['Week of', `Volume (${unit})`], rows: weeks.map((w) => [formatDateMedium(w.week), formatNumber(fromKg(w.volume, unit), 0)]) }}
            >
              <WeeklyBarChart valueLabel="Volume" format={(n) => `${formatNumber(n, 0)} ${unit}`} data={weeks.map((w) => ({ week: w.week, value: Math.round(fromKg(w.volume, unit)) }))} />
            </ChartFrame>
          </div>
          <div className="mt-10 max-w-2xl">
            {areas.length > 0 && (
              <ChartFrame
                title="Which body areas am I training?"
                caption="Completed working and drop sets per body area. Each set counts once, for the exercise's main area."
                unit="Sets"
                height={Math.max(120, areas.length * 40)}
                summary={areas.map((a) => `${CATEGORY_LABELS[a.category]} ${a.sets} sets`).join(', ')}
                table={{ columns: ['Body area', 'Sets'], rows: areas.map((a) => [CATEGORY_LABELS[a.category], a.sets]) }}
              >
                <HorizontalBarChart valueLabel="Sets" data={areas.map((a) => ({ label: CATEGORY_LABELS[a.category], value: a.sets }))} />
              </ChartFrame>
            )}
          </div>
        </>
      )}
    </section>
  )
}
