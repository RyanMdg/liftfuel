import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { TextInput, Textarea } from '@/components/ui/Field'
import { Divider, SectionHeading } from '@/components/ui/Headings'
import { IconButton } from '@/components/ui/IconButton'
import { Stat } from '@/components/ui/Stat'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useLoadedProfile } from '@/features/auth/hooks'
import { useSingleFlight } from '@/hooks/useSingleFlight'
import { formatDateLong, formatDuration, isDateString } from '@/lib/dates'
import { pluralize } from '@/lib/format'
import { trainingVolume } from '@/lib/training'
import { formatNumber, fromKg } from '@/lib/units'
import type { PreviousSet, WorkoutSet } from '@/types/database'
import * as api from './api'
import { ExerciseSelector } from './components/ExerciseSelector'
import { RestTimer } from './components/RestTimer'
import { WorkoutSetTable } from './components/WorkoutSetTable'
import { usePrevious, useSession, useSessionMutation } from './hooks'
import { CATEGORY_LABELS, EQUIPMENT_LABELS } from './labels'

export default function WorkoutPage() {
  const { id = '' } = useParams()
  const session = useSession(id)
  if (session.isPending) return <LoadingState label="Loading workout" />
  if (session.isError) {
    return (
      <div className="space-y-6">
        <BackLink />
        <ErrorState title="Could not load this workout" error={session.error} onRetry={() => session.refetch()} />
      </div>
    )
  }
  return <Workout session={session.data} />
}

function BackLink() {
  return (
    <Link to="/training" className="inline-flex items-center gap-2 text-sm font-semibold text-teal underline-offset-4 hover:underline">
      <ArrowLeft aria-hidden className="size-4" strokeWidth={1.75} />
      Training
    </Link>
  )
}

function Workout({ session }: { session: api.SessionDetail }) {
  const profile = useLoadedProfile()
  const unit = profile.weight_unit
  const toast = useToast()
  const navigate = useNavigate()
  const previous = usePrevious(session.id)
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [confirm, setConfirm] = useState<'finish' | 'discard' | null>(null)
  const [deletingSet, setDeletingSet] = useState<WorkoutSet | null>(null)
  const [removingExercise, setRemovingExercise] = useState<api.SessionExercise | null>(null)
  const [restSince, setRestSince] = useState<{ at: number; target: number | null } | null>(null)
  const [addingSetFor, setAddingSetFor] = useState<string | null>(null)

  const inProgress = session.status === 'in_progress'
  const allSets = session.workout_exercises.flatMap((we) => we.workout_sets)
  const completed = allSets.filter((s) => s.completed_at)
  const incomplete = allSets.length - completed.length
  const volumeKg = trainingVolume(allSets)

  const updateSession = useSessionMutation(session.id, (patch: Parameters<typeof api.updateSession>[1]) => api.updateSession(session.id, patch))
  const addExercise = useSessionMutation(session.id, (exerciseId: string) => api.addWorkoutExercise(session.id, exerciseId))
  const removeExercise = useSessionMutation(session.id, (weId: string) => api.removeWorkoutExercise(weId))
  const addSet = useSessionMutation(session.id, (weId: string) => api.addSet(weId))
  const deleteSet = useSessionMutation(session.id, (setId: string) => api.deleteSet(setId))
  const finish = useSessionMutation(session.id, () => api.finishWorkout(session.id))
  const discard = useSessionMutation(session.id, () => api.deleteSession(session.id))

  const previousByExercise = new Map<string, PreviousSet[]>()
  for (const p of previous.data ?? []) {
    previousByExercise.set(p.exercise_id, [...(previousByExercise.get(p.exercise_id) ?? []), p])
  }

  const onFinish = useSingleFlight(async () => {
    try {
      await finish.mutateAsync(undefined)
      toast.success('Workout saved.')
      setConfirm(null)
      setRestSince(null)
    } catch (error) {
      toast.error(error, 'Could not finish the workout.')
      setConfirm(null)
    }
  })

  const onAddSet = useSingleFlight(async (weId: string) => {
    setAddingSetFor(weId)
    try {
      await addSet.mutateAsync(weId)
    } catch (error) {
      toast.error(error, 'Could not add a set.')
    } finally {
      setAddingSetFor(null)
    }
  })

  const saveField = (patch: Parameters<typeof api.updateSession>[1], message?: string) =>
    updateSession.mutate(patch, {
      onSuccess: () => message && toast.success(message),
      onError: (e) => toast.error(e, 'Could not save the change.'),
    })

  return (
    <div>
      <BackLink />
      <header className="mt-4 mb-8 border-b border-line pb-6">
        <p className="label-caps mb-2">{inProgress ? 'Workout in progress' : 'Completed workout'}</p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <InlineName value={session.name} onSave={(name) => saveField({ name })} />
            <p className="mt-1 text-sm text-ink-soft">
              {formatDateLong(session.session_date)}
              {session.completed_at && (<><Divider vertical />{formatDuration(session.started_at, session.completed_at)}</>)}
            </p>
          </div>
          {inProgress ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setConfirm('discard')}>Discard</Button>
              <Button onClick={() => setConfirm('finish')} disabled={completed.length === 0} title={completed.length === 0 ? 'Complete at least one set first' : undefined}>
                Finish workout
              </Button>
            </div>
          ) : (
            <Button variant="secondary" icon={<Trash2 className="size-4" strokeWidth={1.75} />} onClick={() => setConfirm('discard')}>
              Delete workout
            </Button>
          )}
        </div>
        <dl className="mt-6 grid grid-cols-3 gap-6 sm:max-w-lg">
          <Stat label="Exercises" value={session.workout_exercises.length} />
          <Stat label="Sets done" value={completed.length} sub={inProgress && incomplete > 0 ? `${incomplete} to go` : undefined} />
          <Stat label="Volume" value={formatNumber(fromKg(volumeKg, unit), 0)} unit={unit} />
        </dl>
        {inProgress && restSince && (
          <div className="mt-6">
            <RestTimer key={restSince.at} since={restSince.at} targetSeconds={restSince.target} onDismiss={() => setRestSince(null)} />
          </div>
        )}
      </header>

      {session.workout_exercises.length === 0 ? (
        <div className="py-6">
          <p className="font-semibold">No exercises yet</p>
          <p className="mt-1 text-sm text-ink-soft">Add the first exercise. Your previous sets for it will appear next to each row.</p>
        </div>
      ) : (
        <div className="space-y-12">
          {session.workout_exercises.map((we) => {
            const prev = previousByExercise.get(we.exercise_id) ?? []
            const target = [
              we.rep_min != null && we.rep_max != null ? (we.rep_min === we.rep_max ? `${we.rep_min} reps` : `${we.rep_min}-${we.rep_max} reps`) : null,
              we.target_rpe != null ? `RPE ${formatNumber(we.target_rpe, 1)}` : null,
              we.rest_seconds != null ? `${Math.round(we.rest_seconds / 6) / 10} min rest` : null,
            ].filter(Boolean)
            return (
              <section key={we.id} aria-labelledby={`we-${we.id}`}>
                <SectionHeading
                  id={`we-${we.id}`}
                  title={we.exercise.name}
                  meta={target.length > 0 ? `Target ${target.join(', ')}` : undefined}
                  actions={<IconButton size="sm" label={`Remove ${we.exercise.name}`} tone="danger" icon={<Trash2 className="size-4" strokeWidth={1.75} />} onClick={() => setRemovingExercise(we)} />}
                />
                <p className="-mt-2 mb-3 text-xs text-ink-muted">
                  {EQUIPMENT_LABELS[we.exercise.equipment]}
                  <Divider vertical className="mx-2 h-3" />
                  {CATEGORY_LABELS[we.exercise.category]}
                  {prev[0] && (<><Divider vertical className="mx-2 h-3" />Previous from {formatDateLong(prev[0].session_date)}</>)}
                </p>
                <WorkoutSetTable
                  sessionId={session.id}
                  exerciseName={we.exercise.name}
                  sets={we.workout_sets}
                  previous={prev}
                  unit={unit}
                  addingSet={addingSetFor === we.id}
                  onAddSet={() => onAddSet(we.id)}
                  onDeleteSet={setDeletingSet}
                  onCompleted={() => inProgress && setRestSince({ at: Date.now(), target: we.rest_seconds })}
                />
              </section>
            )
          })}
        </div>
      )}

      <div className="mt-10 border-t border-line pt-6">
        <Button variant="secondary" icon={<Plus className="size-4" strokeWidth={1.75} />} onClick={() => setSelectorOpen(true)}>
          Add exercise
        </Button>
      </div>

      <section aria-labelledby="notes-heading" className="mt-12 grid gap-6 sm:grid-cols-2">
        <h2 id="notes-heading" className="sr-only">Workout details</h2>
        <NotesField value={session.notes ?? ''} onSave={(notes) => saveField({ notes: notes || null }, 'Notes saved.')} />
        <TextInput
          label="Workout date"
          type="date"
          className="num"
          defaultValue={session.session_date}
          onBlur={(e) => {
            const v = e.target.value
            if (isDateString(v) && v !== session.session_date) saveField({ session_date: v }, 'Date updated.')
          }}
        />
      </section>

      <ExerciseSelector
        open={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        onSelect={(exercise) => {
          setSelectorOpen(false)
          addExercise.mutate(exercise.id, {
            onSuccess: () => toast.success(`Added ${exercise.name}.`),
            onError: (e) => toast.error(e, 'Could not add the exercise.'),
          })
        }}
      />

      <ConfirmDialog
        open={confirm === 'finish'}
        tone="primary"
        title="Finish workout?"
        description={
          incomplete > 0
            ? `${pluralize(incomplete, 'set')} not marked done will be removed. ${pluralize(completed.length, 'completed set')} will be saved.`
            : `${pluralize(completed.length, 'completed set')} will be saved.`
        }
        confirmLabel="Finish and save"
        loading={finish.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => onFinish()}
      />
      <ConfirmDialog
        open={confirm === 'discard'}
        title={inProgress ? 'Discard workout?' : 'Delete workout?'}
        description="All exercises and sets in this workout will be permanently deleted."
        confirmLabel={inProgress ? 'Discard workout' : 'Delete workout'}
        loading={discard.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          discard.mutate(undefined, {
            onSuccess: () => {
              toast.success(inProgress ? 'Workout discarded.' : 'Workout deleted.')
              navigate('/training', { replace: true })
            },
            onError: (e) => toast.error(e, 'Could not delete the workout.'),
          })
        }
      />
      <ConfirmDialog
        open={deletingSet !== null}
        title="Remove set?"
        description="This set will be deleted."
        confirmLabel="Remove set"
        loading={deleteSet.isPending}
        onCancel={() => setDeletingSet(null)}
        onConfirm={() => deletingSet && deleteSet.mutate(deletingSet.id, { onError: (e) => toast.error(e), onSettled: () => setDeletingSet(null) })}
      />
      <ConfirmDialog
        open={removingExercise !== null}
        title="Remove exercise?"
        description={`${removingExercise?.exercise.name ?? ''} and its ${pluralize(removingExercise?.workout_sets.length ?? 0, 'set')} will be removed from this workout.`}
        confirmLabel="Remove exercise"
        loading={removeExercise.isPending}
        onCancel={() => setRemovingExercise(null)}
        onConfirm={() => removingExercise && removeExercise.mutate(removingExercise.id, { onError: (e) => toast.error(e), onSettled: () => setRemovingExercise(null) })}
      />
    </div>
  )
}

function InlineName({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value)
  return (
    <>
      <label htmlFor="workout-name" className="sr-only">Workout name</label>
      <input
        id="workout-name"
        value={draft}
        maxLength={80}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const v = draft.trim()
          if (!v) return setDraft(value)
          if (v !== value) onSave(v)
        }}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="-ml-1 w-full rounded-sm border border-transparent bg-transparent px-1 text-3xl font-bold tracking-tight hover:border-line-strong sm:text-display"
      />
    </>
  )
}

function NotesField({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value)
  return (
    <Textarea
      label="Notes"
      hint="Saved when you leave the field."
      value={draft}
      maxLength={2000}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft.trim() !== value && onSave(draft.trim())}
    />
  )
}
