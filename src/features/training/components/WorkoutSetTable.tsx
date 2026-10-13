import { useState } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { SET_TYPE_LABELS } from '@/lib/training'
import { displayLoad, formatNumber, toKg } from '@/lib/units'
import type { PreviousSet, SetType, WeightUnit, WorkoutSet } from '@/types/database'
import { useUpdateSet } from '../hooks'

interface WorkoutSetTableProps {
  sessionId: string
  exerciseName: string
  sets: WorkoutSet[]
  previous: PreviousSet[]
  unit: WeightUnit
  onAddSet: () => void
  addingSet: boolean
  onDeleteSet: (set: WorkoutSet) => void
  onCompleted: () => void
}

const cellInput =
  'num h-10 w-full min-w-0 rounded-sm border border-line-strong bg-white px-1 text-center text-base text-ink ' +
  'hover:border-ink-soft aria-invalid:border-danger disabled:bg-surface'

/**
 * Inline set logging: every row is editable in place and saves on blur, so a refresh
 * never loses data. The Done button saves the row's values and completes it in one request.
 */
export function WorkoutSetTable({ sessionId, exerciseName, sets, previous, unit, onAddSet, addingSet, onDeleteSet, onCompleted }: WorkoutSetTableProps) {
  return (
    <div>
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Sets for {exerciseName}</caption>
          <thead>
            <tr className="text-left">
              <th scope="col" className="label-caps w-18 pb-2 font-semibold sm:w-36">Set</th>
              <th scope="col" className="label-caps hidden pb-2 font-semibold sm:table-cell">Previous</th>
              <th scope="col" className="label-caps w-16 px-1 pb-2 text-center font-semibold sm:w-24">{unit}</th>
              <th scope="col" className="label-caps w-12 px-1 pb-2 text-center font-semibold sm:w-20">Reps</th>
              <th scope="col" className="label-caps w-12 px-1 pb-2 text-center font-semibold sm:w-20">RPE</th>
              <th scope="col" className="label-caps w-12 px-1 pb-2 text-center font-semibold">Done</th>
              <th scope="col" className="w-10 pb-2"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {sets.map((s, i) => (
              <SetRow
                key={s.id}
                index={i}
                set={s}
                previous={previous[i] ?? null}
                unit={unit}
                sessionId={sessionId}
                exerciseName={exerciseName}
                onDelete={() => onDeleteSet(s)}
                onCompleted={onCompleted}
              />
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="quiet" size="sm" className="mt-2" icon={<Plus className="size-4" strokeWidth={1.75} />} loading={addingSet} onClick={onAddSet}>
        Add set
      </Button>
    </div>
  )
}

function toText(n: number | null | undefined): string {
  return n == null ? '' : String(n)
}

function SetRow({ index, set, previous, unit, sessionId, exerciseName, onDelete, onCompleted }: {
  index: number
  set: WorkoutSet
  previous: PreviousSet | null
  unit: WeightUnit
  sessionId: string
  exerciseName: string
  onDelete: () => void
  onCompleted: () => void
}) {
  const toast = useToast()
  const update = useUpdateSet(sessionId)
  const [load, setLoad] = useState(set.load_kg == null ? '' : String(displayLoad(set.load_kg, unit)))
  const [reps, setReps] = useState(toText(set.reps))
  const [rpe, setRpe] = useState(toText(set.rpe))
  const done = set.completed_at != null
  const label = `${exerciseName} set ${index + 1}`

  const parsed = {
    load: load.trim() === '' ? null : Number(load),
    reps: reps.trim() === '' ? null : Number(reps),
    rpe: rpe.trim() === '' ? null : Number(rpe),
  }
  const invalid = {
    load: parsed.load != null && !(Number.isFinite(parsed.load) && parsed.load >= 0 && toKg(parsed.load, unit) <= 1000),
    reps: parsed.reps != null && !(Number.isInteger(parsed.reps) && parsed.reps >= 0 && parsed.reps <= 100),
    rpe: parsed.rpe != null && !(parsed.rpe >= 1 && parsed.rpe <= 10 && Number.isInteger(parsed.rpe * 2)),
  }

  function valuesPatch() {
    return {
      load_kg: parsed.load == null ? null : Math.round(toKg(parsed.load, unit) * 1000) / 1000,
      load_unit: unit,
      reps: parsed.reps,
      rpe: parsed.rpe,
    }
  }

  function save(extra: Partial<WorkoutSet> = {}, after?: () => void) {
    update.mutate({ id: set.id, patch: { ...valuesPatch(), ...extra } }, {
      onSuccess: after,
      onError: (e) => toast.error(e, 'Could not save the set.'),
    })
  }

  function onBlurSave(field: keyof typeof invalid) {
    if (invalid[field]) return
    const current = { load: set.load_kg == null ? null : displayLoad(set.load_kg, unit), reps: set.reps, rpe: set.rpe }
    if (current[field] === parsed[field]) return
    // A completed set that loses its reps becomes incomplete instead of failing.
    const extra = done && field === 'reps' && parsed.reps == null ? { completed_at: null } : {}
    save(extra)
  }

  function toggleDone() {
    if (done) return save({ completed_at: null })
    if (invalid.load || invalid.reps || invalid.rpe) return toast.error('Fix the highlighted values first.')
    if (parsed.reps == null) {
      toast.error(`Enter reps for set ${index + 1} first.`)
      document.getElementById(`${set.id}-reps`)?.focus()
      return
    }
    save({ completed_at: new Date().toISOString() }, onCompleted)
  }

  function copyPrevious() {
    if (!previous) return
    const nextLoad = previous.load_kg == null ? '' : String(displayLoad(previous.load_kg, unit))
    setLoad(nextLoad)
    setReps(String(previous.reps))
    update.mutate(
      { id: set.id, patch: { load_kg: previous.load_kg, load_unit: unit, reps: previous.reps } },
      { onError: (e) => toast.error(e, 'Could not copy the previous set.') },
    )
  }

  return (
    <tr className={cn('border-t border-line', done && 'bg-teal-soft')}>
      <td className="py-2 pr-2">
        <div className="flex flex-col items-start sm:flex-row sm:items-center sm:gap-2">
          <span className="num font-semibold sm:w-5 sm:text-right">{index + 1}</span>
          <label className="sr-only" htmlFor={`${set.id}-type`}>{label} type</label>
          <select
            id={`${set.id}-type`}
            value={set.set_type}
            onChange={(e) => update.mutate({ id: set.id, patch: { set_type: e.target.value as SetType } }, { onError: (err) => toast.error(err) })}
            className="-ml-1 h-7 max-w-full rounded-sm border border-transparent bg-transparent pr-0.5 text-xs font-semibold text-ink-soft hover:border-line-strong sm:h-8"
          >
            {Object.entries(SET_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </td>
      <td className="hidden py-2 pr-2 sm:table-cell">
        {previous ? (
          <button
            type="button"
            onClick={copyPrevious}
            disabled={done}
            className="num rounded-sm px-1 py-1 text-left text-ink-soft hover:bg-surface hover:text-ink disabled:hover:bg-transparent"
            aria-label={`Copy previous: ${previous.load_kg == null ? 'bodyweight' : `${formatNumber(displayLoad(previous.load_kg, unit), 2)} ${unit}`} for ${previous.reps} reps into ${label}`}
            title="Copy into this set"
          >
            {previous.load_kg == null ? 'BW' : formatNumber(displayLoad(previous.load_kg, unit), 2)} &times; {previous.reps}
            {previous.rpe != null && <span className="text-xs"> @{formatNumber(previous.rpe, 1)}</span>}
          </button>
        ) : (
          <span className="text-ink-muted" aria-label="No previous set">-</span>
        )}
      </td>
      <td className="px-1 py-2">
        <input
          aria-label={`${label} load in ${unit}`}
          type="number" inputMode="decimal" step="any" min={0}
          value={load} onChange={(e) => setLoad(e.target.value)} onBlur={() => onBlurSave('load')}
          aria-invalid={invalid.load || undefined}
          className={cellInput}
        />
      </td>
      <td className="px-1 py-2">
        <input
          id={`${set.id}-reps`}
          aria-label={`${label} reps`}
          type="number" inputMode="numeric" step={1} min={0}
          value={reps} onChange={(e) => setReps(e.target.value)} onBlur={() => onBlurSave('reps')}
          aria-invalid={invalid.reps || undefined}
          className={cellInput}
        />
      </td>
      <td className="px-1 py-2">
        <input
          aria-label={`${label} RPE`}
          type="number" inputMode="decimal" step={0.5} min={1} max={10}
          value={rpe} onChange={(e) => setRpe(e.target.value)} onBlur={() => onBlurSave('rpe')}
          aria-invalid={invalid.rpe || undefined}
          className={cellInput}
        />
      </td>
      <td className="px-1 py-2 text-center">
        <button
          type="button"
          onClick={toggleDone}
          aria-pressed={done}
          aria-label={done ? `${label} done. Mark as not done` : `Mark ${label} done`}
          className={cn(
            'inline-flex size-10 shrink-0 items-center justify-center rounded-sm border transition-colors',
            done ? 'border-teal bg-teal text-white hover:bg-teal-dark' : 'border-line-strong bg-white text-ink-muted hover:border-teal hover:text-teal',
          )}
        >
          <Check aria-hidden className="size-5" strokeWidth={2.25} />
        </button>
      </td>
      <td className="py-2 pl-1 text-right">
        <IconButton size="sm" label={`Remove ${label}`} tone="danger" icon={<Trash2 className="size-4" strokeWidth={1.75} />} onClick={onDelete} />
      </td>
    </tr>
  )
}
