import { useState } from 'react'
import { Link } from 'react-router'
import { Dumbbell, Play } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { PageHeader, SectionHeading } from '@/components/ui/Headings'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { tableClasses as t } from '@/components/ui/table'
import { useLoadedProfile } from '@/features/auth/hooks'
import { cn } from '@/lib/cn'
import { formatDateMedium, formatDuration } from '@/lib/dates'
import { formatNumber, fromKg } from '@/lib/units'
import { useActiveSession, useHistory, useTemplates } from './hooks'
import { summarize, TRAINING_TABS } from './tabs'
import { useStartWorkoutAction } from './useStartWorkoutAction'

const PAGE = 25

export default function TrainingPage() {
  const profile = useLoadedProfile()
  const active = useActiveSession()
  const templates = useTemplates()
  const [limit, setLimit] = useState(PAGE)
  const history = useHistory(limit)
  const start = useStartWorkoutAction()

  return (
    <>
      <PageHeader title="Training" tabs={TRAINING_TABS} />

      <div className="space-y-12">
        {active.data && (
          <section aria-labelledby="active-heading" className="flex flex-wrap items-center justify-between gap-4 border-l-2 border-teal py-1 pl-4">
            <div>
              <p className="label-caps" id="active-heading">In progress</p>
              <p className="mt-1 text-lg font-semibold">{active.data.name}</p>
              <p className="text-sm text-ink-soft">Started {formatDuration(active.data.started_at, new Date().toISOString())} ago</p>
            </div>
            <ButtonLink to={`/training/workouts/${active.data.id}`} icon={<Play className="size-4" strokeWidth={1.75} />}>Resume workout</ButtonLink>
          </section>
        )}

        <section aria-labelledby="start-heading">
          <SectionHeading id="start-heading" title="Start a workout" />
          <div className="grid gap-x-10 gap-y-6 md:grid-cols-[16rem_1fr]">
            <div>
              <Button variant={active.data ? 'secondary' : 'primary'} disabled={!!active.data || start.pending} loading={start.pendingTemplateId === 'empty'} onClick={() => start.run(null)}>
                Start empty workout
              </Button>
              <p className="mt-2 text-sm text-ink-soft">Add exercises as you go.</p>
            </div>
            <div>
              <h3 className="label-caps mb-2">From a template</h3>
              {templates.isPending ? (
                <LoadingState label="Loading templates" className="py-3" />
              ) : templates.isError ? (
                <ErrorState error={templates.error} onRetry={() => templates.refetch()} />
              ) : templates.data.length === 0 ? (
                <p className="text-sm text-ink-soft">
                  No templates yet. <Link to="/training/templates" className="font-semibold text-teal underline-offset-4 hover:underline">Create a template</Link> to start a planned session in one click.
                </p>
              ) : (
                <ul className="divide-y divide-line border-y border-line">
                  {templates.data.map((tpl) => (
                    <li key={tpl.id} className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{tpl.name}</p>
                        <p className="truncate text-xs text-ink-soft">
                          {tpl.template_exercises.length === 0 ? 'No exercises' : tpl.template_exercises.map((te) => te.exercise.name).join(', ')}
                        </p>
                      </div>
                      <Button size="sm" variant="secondary" disabled={!!active.data || start.pending} loading={start.pendingTemplateId === tpl.id} onClick={() => start.run(tpl.id)}>
                        Start
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {active.data && <p className="mt-3 text-sm text-ink-soft">Finish or discard the workout in progress before starting another.</p>}
            </div>
          </div>
        </section>

        <section aria-labelledby="history-heading">
          <SectionHeading id="history-heading" title="History" />
          {history.isError ? (
            <ErrorState error={history.error} onRetry={() => history.refetch()} />
          ) : history.isPending ? (
            <LoadingState label="Loading history" />
          ) : history.data.length === 0 ? (
            <EmptyState icon={<Dumbbell strokeWidth={1.5} />} title="No completed workouts yet" description="Finished workouts appear here with their sets, volume and duration." />
          ) : (
            <>
              <div className={t.wrapper}>
                <table className={t.table}>
                  <caption className="sr-only">Completed workouts</caption>
                  <thead>
                    <tr>
                      <th scope="col" className={t.th}>Date</th>
                      <th scope="col" className={t.th}>Workout</th>
                      <th scope="col" className={cn(t.thNum, 'hidden sm:table-cell')}>Exercises</th>
                      <th scope="col" className={t.thNum}>Sets</th>
                      <th scope="col" className={cn(t.thNum, 'hidden md:table-cell')}>Volume</th>
                      <th scope="col" className={cn(t.thNum, 'hidden md:table-cell')}>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.data.map((s) => {
                      const sum = summarize(s)
                      return (
                        <tr key={s.id} className={t.row}>
                          <td className={cn(t.td, 'num whitespace-nowrap')}>{formatDateMedium(s.session_date)}</td>
                          <td className={t.td}>
                            <Link to={`/training/workouts/${s.id}`} className="font-semibold text-ink underline-offset-4 hover:text-teal hover:underline">{s.name}</Link>
                          </td>
                          <td className={cn(t.tdNum, 'hidden sm:table-cell')}>{sum.exercises}</td>
                          <td className={t.tdNum}>{sum.sets}</td>
                          <td className={cn(t.tdNum, 'hidden md:table-cell')}>{formatNumber(fromKg(sum.volumeKg, profile.weight_unit), 0)} {profile.weight_unit}</td>
                          <td className={cn(t.tdNum, 'hidden md:table-cell')}>{s.completed_at ? formatDuration(s.started_at, s.completed_at) : '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-ink-muted">Volume is load times reps over completed working and drop sets; warm-ups are excluded.</p>
              {history.data.length >= limit && (
                <Button variant="secondary" size="sm" className="mt-4" loading={history.isFetching} onClick={() => setLimit((l) => l + PAGE)}>
                  Show more
                </Button>
              )}
            </>
          )}
        </section>
      </div>
    </>
  )
}
