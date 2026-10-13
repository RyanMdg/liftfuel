import { Link } from 'react-router'
import { Dumbbell, Play, Plus, Scale, Trophy } from 'lucide-react'
import { ChartFrame } from '@/components/charts/ChartFrame'
import { WeightChart } from '@/components/charts/charts'
import { chart, toTime } from '@/components/charts/theme'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Divider, PageHeader, SectionHeading } from '@/components/ui/Headings'
import { Stat } from '@/components/ui/Stat'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { useLoadedProfile, useToday } from '@/features/auth/hooks'
import { NutritionSummary } from '@/features/nutrition/components/NutritionSummary'
import { useDiary, useGoalForDate } from '@/features/nutrition/hooks'
import { useWeights } from '@/features/progress/hooks'
import { summarize } from '@/features/training/tabs'
import { useActiveSession, useCompletedSets, useExerciseRecords, useSessionsOnDate, useTemplates } from '@/features/training/hooks'
import { useStartWorkoutAction } from '@/features/training/useStartWorkoutAction'
import { addDays, formatDateLong, formatDateMedium, formatDuration, startOfWeek } from '@/lib/dates'
import { recentRecords, trainingVolume } from '@/lib/training'
import { sumTotals } from '@/lib/nutrition'
import { formatNumber, formatSigned, fromKg } from '@/lib/units'
import { trendChange, weightTrend } from '@/lib/weight'
import type { WeightUnit } from '@/types/database'

const icon = { className: 'size-4', strokeWidth: 1.75 } as const

export default function DashboardPage() {
  const profile = useLoadedProfile()
  const today = useToday()
  const greeting = profile.display_name ? `Hello, ${profile.display_name}` : 'Today'

  return (
    <>
      <PageHeader eyebrow={formatDateLong(today)} title={greeting} />
      <div className="space-y-14">
        <TodayNutrition today={today} />
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-10">
          <TodayTraining today={today} unit={profile.weight_unit} />
          <WeightTrend today={today} unit={profile.weight_unit} />
        </div>
        <TrainingHighlights today={today} unit={profile.weight_unit} />
      </div>
    </>
  )
}

function TodayNutrition({ today }: { today: string }) {
  const diary = useDiary(today)
  const goal = useGoalForDate(today)
  return (
    <section aria-labelledby="dash-nutrition">
      <SectionHeading
        id="dash-nutrition"
        title="Nutrition today"
        actions={
          <>
            <ButtonLink to="/nutrition?log=1" size="sm" icon={<Plus {...icon} />}>Log food</ButtonLink>
            <ButtonLink to="/nutrition" size="sm" variant="quiet">Diary</ButtonLink>
          </>
        }
      />
      {diary.isError ? (
        <ErrorState error={diary.error} onRetry={() => diary.refetch()} />
      ) : diary.isPending || goal.isPending ? (
        <LoadingState label="Loading today's diary" />
      ) : (
        <>
          <NutritionSummary totals={sumTotals(diary.data)} resolved={goal.resolved} compact />
          {diary.data.length === 0 && (
            <p className="mt-6 text-sm text-ink-soft">
              Nothing logged today. <Link to="/nutrition?log=1" className="font-semibold text-teal underline-offset-4 hover:underline">Log your first meal</Link> and your totals fill in here.
            </p>
          )}
        </>
      )}
    </section>
  )
}

function TodayTraining({ today, unit }: { today: string; unit: WeightUnit }) {
  const active = useActiveSession()
  const sessions = useSessionsOnDate(today)
  const templates = useTemplates()
  const start = useStartWorkoutAction()
  const done = (sessions.data ?? []).filter((s) => s.status === 'completed')

  return (
    <section aria-labelledby="dash-training">
      <SectionHeading id="dash-training" title="Training today" actions={<ButtonLink to="/training" size="sm" variant="quiet">All workouts</ButtonLink>} />
      {active.isPending || sessions.isPending ? (
        <LoadingState label="Loading workouts" />
      ) : active.isError || sessions.isError ? (
        <ErrorState error={active.error ?? sessions.error} onRetry={() => { active.refetch(); sessions.refetch() }} />
      ) : (
        <div className="space-y-6">
          {active.data && (
            <div className="flex flex-wrap items-center justify-between gap-4 border-l-2 border-teal py-1 pl-4">
              <div>
                <p className="label-caps">In progress</p>
                <p className="font-semibold">{active.data.name}</p>
                <p className="text-sm text-ink-soft">Started {formatDuration(active.data.started_at, new Date().toISOString())} ago</p>
              </div>
              <ButtonLink to={`/training/workouts/${active.data.id}`} icon={<Play {...icon} />}>Resume</ButtonLink>
            </div>
          )}
          {done.length > 0 && (
            <ul className="divide-y divide-line border-y border-line">
              {done.map((s) => {
                const sum = summarize(s)
                return (
                  <li key={s.id} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <Link to={`/training/workouts/${s.id}`} className="font-semibold underline-offset-4 hover:text-teal hover:underline">{s.name}</Link>
                      <p className="num text-sm text-ink-soft">
                        {sum.sets} sets<Divider vertical />{formatNumber(fromKg(sum.volumeKg, unit), 0)} {unit}
                        {s.completed_at && (<><Divider vertical />{formatDuration(s.started_at, s.completed_at)}</>)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-teal">Completed</span>
                  </li>
                )
              })}
            </ul>
          )}
          {!active.data && (
            <div>
              {done.length === 0 && <p className="mb-4 text-sm text-ink-soft">No workout logged today.</p>}
              <div className="flex flex-wrap gap-2">
                {(templates.data ?? []).slice(0, 3).map((tpl) => (
                  <Button key={tpl.id} variant="secondary" size="sm" disabled={start.pending} loading={start.pendingTemplateId === tpl.id} onClick={() => start.run(tpl.id)}>
                    Start {tpl.name}
                  </Button>
                ))}
                <Button size="sm" icon={<Dumbbell {...icon} />} disabled={start.pending} loading={start.pendingTemplateId === 'empty'} onClick={() => start.run(null)}>
                  Start empty workout
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function WeightTrend({ today, unit }: { today: string; unit: WeightUnit }) {
  const weights = useWeights()
  const from = addDays(today, -29)
  const points = weightTrend(weights.data ?? []).filter((p) => p.date >= from)
  const change = trendChange(points)
  const latest = points.at(-1)
  const disp = (kg: number) => formatNumber(fromKg(kg, unit), 1)

  return (
    <section aria-labelledby="dash-weight">
      <SectionHeading id="dash-weight" title="Body weight, 30 days" actions={<ButtonLink to="/progress" size="sm" variant="quiet">Log weight</ButtonLink>} />
      {weights.isError ? (
        <ErrorState error={weights.error} onRetry={() => weights.refetch()} />
      ) : weights.isPending ? (
        <LoadingState label="Loading weigh-ins" />
      ) : points.length === 0 ? (
        <div className="py-2">
          <Scale aria-hidden className="mb-3 size-6 text-ink-muted" strokeWidth={1.5} />
          <p className="font-semibold">No weigh-ins in the last 30 days</p>
          <p className="mt-1 text-sm text-ink-soft">Log your weight a few mornings a week. A 7-day average appears once there are 3 weigh-ins within a week.</p>
          <ButtonLink to="/progress" size="sm" variant="secondary" className="mt-4">Log weight</ButtonLink>
        </div>
      ) : (
        <>
          <dl className="mb-6 grid grid-cols-2 gap-6">
            <Stat label="Latest" value={disp(latest!.weightKg)} unit={unit} sub={formatDateMedium(latest!.date)} />
            <Stat label="Average change" value={change ? formatSigned(fromKg(change.changeKg, unit), 1) : 'Not enough data'} unit={change ? unit : undefined}
              sub={change ? `Over ${change.days} days` : '7-day average needs more weigh-ins'} />
          </dl>
          <ChartFrame
            title="Is my weight moving in the right direction?"
            legend={[{ label: 'Weigh-in', kind: 'dot', color: chart.tealMid }, { label: '7-day average', kind: 'line', color: chart.teal }]}
            summary={`${points.length} weigh-ins in the last 30 days.`}
            height={180}
            unit={unit}
            table={{ columns: ['Date', `Weigh-in (${unit})`, `Average (${unit})`], rows: points.map((p) => [formatDateMedium(p.date), disp(p.weightKg), p.averageKg == null ? '-' : disp(p.averageKg)]) }}
          >
            <WeightChart unit={unit} data={points.map((p) => ({ t: toTime(p.date), weight: fromKg(p.weightKg, unit), avg: p.averageKg == null ? null : fromKg(p.averageKg, unit) }))} />
          </ChartFrame>
        </>
      )}
    </section>
  )
}

function TrainingHighlights({ today, unit }: { today: string; unit: WeightUnit }) {
  const records = useExerciseRecords()
  const recentSets = useCompletedSets(addDays(today, -83))
  const disp = (kg: number) => formatNumber(fromKg(kg, unit), 1)
  const weekStart = startOfWeek(today)

  if (records.isPending || recentSets.isPending) {
    return <section aria-label="This week"><SectionHeading title="This week" /><LoadingState label="Loading training data" /></section>
  }
  if (records.isError || recentSets.isError) {
    return <section aria-label="This week"><SectionHeading title="This week" /><ErrorState error={records.error ?? recentSets.error} onRetry={() => { records.refetch(); recentSets.refetch() }} /></section>
  }

  const week = recentSets.data.filter((s) => s.session_date >= weekStart && s.session_date <= today)
  const workouts = new Set(week.map((s) => s.session_id)).size
  const workingSets = week.filter((s) => s.set_type !== 'warmup').length
  const volumeKg = trainingVolume(week)
  // Records set in the last 14 days that still stand all-time.
  const allTime = new Map(records.data.map((r) => [r.exercise_id, r]))
  const prs = recentRecords(recentSets.data, addDays(today, -13))
    .filter((e) => {
      const r = allTime.get(e.exerciseId)
      return e.kind === 'e1rm' ? r?.best_e1rm != null && e.value >= r.best_e1rm : r?.heaviest_kg != null && e.value >= r.heaviest_kg
    })
    .reverse()
    .filter((e, i, all) => all.findIndex((x) => x.exerciseId === e.exerciseId && x.kind === e.kind) === i)
    .slice(0, 3)

  return (
    <section aria-labelledby="dash-week">
      <SectionHeading id="dash-week" title="This week" meta={`Since ${formatDateMedium(weekStart)}`} actions={<ButtonLink to="/progress" size="sm" variant="quiet">Progress</ButtonLink>} />
      <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
        <dl className="grid grid-cols-3 gap-6">
          <Stat label="Workouts" value={workouts} />
          <Stat label="Sets" value={workingSets} sub="Warm-ups excluded" />
          <Stat label="Volume" value={formatNumber(fromKg(volumeKg, unit), 0)} unit={unit} />
        </dl>
        <div className="lg:border-l lg:border-line lg:pl-10">
          <p className="label-caps mb-2 flex items-center gap-2"><Trophy aria-hidden className="size-3.5" strokeWidth={1.75} />Recent personal records</p>
          {prs.length > 0 ? (
            <ul className="space-y-3">
              {prs.map((pr) => (
                <li key={`${pr.exerciseId}-${pr.kind}`}>
                  <p className="font-semibold">{pr.exerciseName}</p>
                  <p className="text-sm text-ink-soft">
                    {pr.kind === 'e1rm'
                      ? `Best est. 1RM ${disp(pr.value)} ${unit} (${disp(pr.loadKg)} \u00d7 ${pr.reps})`
                      : `Heaviest ${disp(pr.loadKg)} ${unit} \u00d7 ${pr.reps}`}
                    {pr.previous != null && `, up from ${disp(pr.previous)}`}
                  </p>
                  <p className="text-xs text-ink-muted">{formatDateMedium(pr.date)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">{records.data.length === 0 ? 'Finish a workout to start tracking records.' : 'No new records in the last 14 days.'}</p>
          )}
        </div>
      </div>
    </section>
  )
}
