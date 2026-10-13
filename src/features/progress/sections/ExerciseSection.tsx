import { useMemo, useState } from 'react'
import { Trophy } from 'lucide-react'
import { ChartEmpty, ChartFrame } from '@/components/charts/ChartFrame'
import { SeriesChart } from '@/components/charts/charts'
import { toTime } from '@/components/charts/theme'
import { SelectInput } from '@/components/ui/Field'
import { SectionHeading } from '@/components/ui/Headings'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Stat } from '@/components/ui/Stat'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { tableClasses as t } from '@/components/ui/table'
import { useCompletedSets, useExerciseRecords } from '@/features/training/hooks'
import { CATEGORY_LABELS } from '@/features/training/labels'
import { cn } from '@/lib/cn'
import { formatDateMedium } from '@/lib/dates'
import { E1RM_MAX_REPS, EXERCISE_METRICS, exerciseSeries, type ExerciseMetric } from '@/lib/training'
import { formatNumber, formatSigned, fromKg } from '@/lib/units'
import type { CompletedSet, WeightUnit } from '@/types/database'
import type { Period } from '../period'

interface ExerciseSummary {
  id: string
  name: string
  category: CompletedSet['category']
  workouts: number
  sets: number
  heaviest: number | null
}

function summarise(sets: ReadonlyArray<CompletedSet>, from: string, to: string): Map<string, ExerciseSummary> {
  const map = new Map<string, ExerciseSummary & { sessions: Set<string> }>()
  for (const s of sets) {
    if (s.session_date < from || s.session_date > to || s.set_type === 'warmup') continue
    const e = map.get(s.exercise_id) ?? { id: s.exercise_id, name: s.exercise_name, category: s.category, workouts: 0, sets: 0, heaviest: null, sessions: new Set<string>() }
    e.sets++
    e.sessions.add(s.session_id)
    e.workouts = e.sessions.size
    if (s.load_kg != null && s.load_kg > 0) e.heaviest = Math.max(e.heaviest ?? 0, s.load_kg)
    map.set(s.exercise_id, e)
  }
  return map
}

/** Hevy-style exercise progress: pick an exercise, switch graphs, see its records. */
export function ExerciseSection({ period, unit }: { period: Period; unit: WeightUnit }) {
  // Includes the previous period so the comparison has a baseline.
  const sets = useCompletedSets(period.previousFrom)
  const records = useExerciseRecords()
  const [selected, setSelected] = useState<string | null>(null)
  const [metric, setMetric] = useState<ExerciseMetric>('e1rm')
  const disp = (kg: number) => formatNumber(fromKg(kg, unit), 1)

  const { exercises, previous } = useMemo(() => {
    const all = sets.data ?? []
    const current = summarise(all, period.from, period.to)
    return {
      exercises: [...current.values()].sort((a, b) => b.sets - a.sets),
      previous: summarise(all, period.previousFrom, period.previousTo),
    }
  }, [sets.data, period])

  const exerciseId = selected && exercises.some((e) => e.id === selected) ? selected : exercises[0]?.id ?? null
  const exercise = exercises.find((e) => e.id === exerciseId)
  const record = records.data?.find((r) => r.exercise_id === exerciseId)
  const metricInfo = EXERCISE_METRICS.find((m) => m.value === metric)!
  const series = exerciseId ? exerciseSeries((sets.data ?? []).filter((s) => s.session_date >= period.from), exerciseId, metric) : []
  const fmt = (v: number) => (metricInfo.unit === 'load' ? disp(v) : formatNumber(v, 0))
  const seriesUnit = metricInfo.unit === 'load' ? unit : 'reps'

  if (sets.isError || records.isError) {
    return (
      <section aria-labelledby="exercise-heading">
        <SectionHeading id="exercise-heading" title="Exercises" />
        <ErrorState error={sets.error ?? records.error} onRetry={() => { sets.refetch(); records.refetch() }} />
      </section>
    )
  }

  return (
    <section aria-labelledby="exercise-heading">
      <SectionHeading id="exercise-heading" title="Exercises" />
      {sets.isPending || records.isPending ? (
        <LoadingState label="Loading exercise data" />
      ) : (records.data ?? []).length === 0 ? (
        <EmptyState icon={<Trophy strokeWidth={1.5} />} title="No completed workouts yet"
          description="Finish a workout and each exercise gets its own graphs and personal records here." />
      ) : (
        <div className="space-y-12">
          {exercises.length === 0 ? (
            <p className="text-sm text-ink-soft">No completed sets in the last {period.label}. Choose a longer period to see older workouts.</p>
          ) : (
            <div className="grid gap-10 lg:grid-cols-[16rem_1fr]">
              <div className="space-y-6">
                <SelectInput label="Exercise" value={exerciseId ?? ''} onChange={(e) => setSelected(e.target.value)}>
                  {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </SelectInput>
                {record && (
                  <div>
                    <h3 className="label-caps mb-3">Personal records</h3>
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-1">
                      <Stat label="Heaviest weight" value={record.heaviest_kg != null ? disp(record.heaviest_kg) : 'None'} unit={record.heaviest_kg != null ? unit : undefined}
                        sub={record.heaviest_date ? `× ${record.heaviest_reps}, ${formatDateMedium(record.heaviest_date)}` : 'No loaded sets'} />
                      <Stat label="Best est. 1RM" value={record.best_e1rm != null ? disp(record.best_e1rm) : 'None'} unit={record.best_e1rm != null ? unit : undefined}
                        sub={record.e1rm_date ? `From ${disp(record.e1rm_load_kg!)} × ${record.e1rm_reps}` : `Needs a working set of 1 to ${E1RM_MAX_REPS} reps`} />
                      <Stat label="Best set volume" value={record.best_set_volume_kg != null ? formatNumber(fromKg(record.best_set_volume_kg, unit), 0) : 'None'} unit={record.best_set_volume_kg != null ? unit : undefined}
                        sub={record.volume_date ? `${disp(record.volume_load_kg!)} × ${record.volume_reps}` : undefined} />
                      <Stat label="Most reps" value={record.max_reps} sub={record.max_reps_load_kg != null ? `At ${disp(record.max_reps_load_kg)} ${unit}` : 'Bodyweight'} />
                    </dl>
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <SegmentedControl<ExerciseMetric> label="Graph" className="mb-6" value={metric} onChange={setMetric}
                  options={EXERCISE_METRICS.map((m) => ({ value: m.value, label: m.label }))} />
                {exercise && series.length > 0 ? (
                  <ChartFrame
                    title={`${exercise.name}: ${metricInfo.question.charAt(0).toLowerCase()}${metricInfo.question.slice(1)}`}
                    caption={metric === 'e1rm'
                      ? `Best estimate per workout (Epley, completed working sets of 1 to ${E1RM_MAX_REPS} reps). An estimate, not a tested max.`
                      : 'One point per workout. Warm-up sets are excluded.'}
                    unit={seriesUnit}
                    summary={`${exercise.name}, ${metricInfo.label.toLowerCase()}: ${series.length} workouts; latest ${fmt(series.at(-1)!.value)} ${seriesUnit}.`}
                    table={{ columns: ['Date', `${metricInfo.label} (${seriesUnit})`], rows: series.map((p) => [formatDateMedium(p.date), fmt(p.value)]) }}
                  >
                    <SeriesChart unit={seriesUnit} label={metricInfo.label}
                      data={series.map((p) => ({ t: toTime(p.date), value: metricInfo.unit === 'load' ? fromKg(p.value, unit) : p.value }))} />
                  </ChartFrame>
                ) : (
                  <ChartEmpty title={metricInfo.label} message={metric === 'e1rm'
                    ? `No eligible sets in this period. Estimates need loaded working sets of 1 to ${E1RM_MAX_REPS} reps; try Total reps for bodyweight exercises.`
                    : 'No data for this graph in this period.'} />
                )}
              </div>
            </div>
          )}

          {exercises.length > 0 && (
            <div>
              <h3 className="label-caps mb-3">This period compared with the previous {period.label}</h3>
              <div className={t.wrapper}>
                <table className={t.table}>
                  <caption className="sr-only">Exercises trained, this period and previous period</caption>
                  <thead><tr>
                    <th scope="col" className={t.th}>Exercise</th>
                    <th scope="col" className={cn(t.thNum, 'hidden sm:table-cell')}>Workouts</th>
                    <th scope="col" className={t.thNum}>Sets</th>
                    <th scope="col" className={t.thNum}>Heaviest</th>
                    <th scope="col" className={cn(t.thNum, 'hidden md:table-cell')}>Change</th>
                  </tr></thead>
                  <tbody>
                    {exercises.map((e) => {
                      const before = previous.get(e.id)
                      const diff = e.heaviest != null && before?.heaviest != null ? e.heaviest - before.heaviest : null
                      return (
                        <tr key={e.id} className={t.row}>
                          <td className={t.td}>
                            <span className="block font-semibold">{e.name}</span>
                            <span className="text-xs text-ink-muted">{CATEGORY_LABELS[e.category]}</span>
                          </td>
                          <td className={cn(t.tdNum, 'hidden sm:table-cell')}>{e.workouts}</td>
                          <td className={t.tdNum}>{e.sets}{before && <span className="block text-xs text-ink-soft">was {before.sets}</span>}</td>
                          <td className={t.tdNum}>{e.heaviest != null ? `${disp(e.heaviest)} ${unit}` : 'Bodyweight'}</td>
                          <td className={cn(t.tdNum, 'hidden md:table-cell')}>{diff != null ? `${formatSigned(fromKg(diff, unit), 1)} ${unit}` : before ? '-' : 'New'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <h3 className="label-caps mb-3">All-time personal records</h3>
            <div className={t.wrapper}>
              <table className={t.table}>
                <caption className="sr-only">Personal records by exercise</caption>
                <thead><tr>
                  <th scope="col" className={t.th}>Exercise</th>
                  <th scope="col" className={t.thNum}>Heaviest</th>
                  <th scope="col" className={cn(t.thNum, 'hidden sm:table-cell')}>Best est. 1RM</th>
                  <th scope="col" className={cn(t.thNum, 'hidden md:table-cell')}>Best set volume</th>
                  <th scope="col" className={cn(t.thNum, 'hidden md:table-cell')}>Most reps</th>
                </tr></thead>
                <tbody>
                  {(records.data ?? []).map((r) => (
                    <tr key={r.exercise_id} className={t.row}>
                      <td className={cn(t.td, 'font-semibold')}>{r.exercise_name}</td>
                      <td className={t.tdNum}>
                        {r.heaviest_kg != null ? `${disp(r.heaviest_kg)} ${unit} × ${r.heaviest_reps}` : 'Bodyweight'}
                        {r.heaviest_date && <span className="block text-xs text-ink-soft">{formatDateMedium(r.heaviest_date)}</span>}
                      </td>
                      <td className={cn(t.tdNum, 'hidden sm:table-cell')}>{r.best_e1rm != null ? `${disp(r.best_e1rm)} ${unit}` : '-'}</td>
                      <td className={cn(t.tdNum, 'hidden md:table-cell')}>{r.best_set_volume_kg != null ? `${formatNumber(fromKg(r.best_set_volume_kg, unit), 0)} ${unit}` : '-'}</td>
                      <td className={cn(t.tdNum, 'hidden md:table-cell')}>{r.max_reps}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 max-w-prose text-xs text-ink-muted">
              Records exclude warm-up sets. Estimated 1RM uses the Epley formula, load &times; (1 + reps / 30), on completed working sets of 1 to {E1RM_MAX_REPS} reps; it is an estimate, not a tested max.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
