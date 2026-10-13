import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { SelectInput, TextInput } from '@/components/ui/Field'
import { Divider } from '@/components/ui/Headings'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import type { Exercise, ExerciseCategory } from '@/types/database'
import { useCreateExercise, useExercises } from '../hooks'
import { CATEGORY_LABELS, EQUIPMENT_LABELS, MECHANIC_LABELS, MOVEMENT_LABELS } from '../labels'

interface ExerciseSelectorProps {
  open: boolean
  onClose: () => void
  onSelect: (exercise: Exercise) => void
  title?: string
}

export function ExerciseSelector({ open, onClose, onSelect, title = 'Add exercise' }: ExerciseSelectorProps) {
  const [creating, setCreating] = useState(false)
  return (
    <Dialog open={open} onClose={() => { setCreating(false); onClose() }} variant="sheet" title={creating ? 'Create exercise' : title}>
      {open && (creating ? (
        <CreateExerciseForm onCancel={() => setCreating(false)} onCreated={(e) => { setCreating(false); onSelect(e) }} />
      ) : (
        <ExerciseList onSelect={onSelect} onCreate={() => setCreating(true)} />
      ))}
    </Dialog>
  )
}

function ExerciseList({ onSelect, onCreate }: { onSelect: (e: Exercise) => void; onCreate: () => void }) {
  const exercises = useExercises()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ExerciseCategory | 'all'>('all')

  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return (exercises.data ?? []).filter(
      (e) =>
        (category === 'all' || e.category === category) &&
        terms.every((t) => `${e.name} ${EQUIPMENT_LABELS[e.equipment]} ${e.primary_muscles.join(' ')}`.toLowerCase().includes(t)),
    )
  }, [exercises.data, query, category])

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
        <div className="relative">
          <TextInput label="Search exercises" type="search" autoFocus autoComplete="off" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Search aria-hidden className="pointer-events-none absolute bottom-3 left-3 size-4 text-ink-muted" strokeWidth={1.75} />
        </div>
        <SelectInput label="Body area" value={category} onChange={(e) => setCategory(e.target.value as ExerciseCategory | 'all')}>
          <option value="all">All</option>
          {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </SelectInput>
      </div>
      {exercises.isError ? (
        <ErrorState error={exercises.error} onRetry={() => exercises.refetch()} />
      ) : exercises.isPending ? (
        <LoadingState label="Loading exercises" />
      ) : (
        <>
          <p className="sr-only" role="status">{filtered.length} exercises</p>
          {filtered.length === 0 ? (
            <p className="py-4 text-sm text-ink-soft">No exercises match. Create a custom exercise below.</p>
          ) : (
            <ul className="divide-y divide-line">
              {filtered.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => onSelect(e)} className="group flex w-full items-center justify-between gap-3 py-3 text-left">
                    <span className="min-w-0">
                      <span className="block font-semibold group-hover:text-teal">{e.name}</span>
                      <span className="text-xs text-ink-muted">
                        {EQUIPMENT_LABELS[e.equipment]}
                        <Divider vertical className="mx-2 h-3" />
                        {CATEGORY_LABELS[e.category]}
                        <Divider vertical className="mx-2 h-3" />
                        {MECHANIC_LABELS[e.mechanic]}
                        {e.owner_id && (<><Divider vertical className="mx-2 h-3" />Custom</>)}
                      </span>
                    </span>
                    <Plus aria-hidden className="size-4 shrink-0 text-ink-muted group-hover:text-teal" strokeWidth={1.75} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <div className="border-t border-line pt-5">
        <Button variant="secondary" icon={<Plus className="size-4" strokeWidth={1.75} />} onClick={onCreate}>
          Create a custom exercise
        </Button>
      </div>
    </div>
  )
}

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(80, 'Use at most 80 characters'),
  equipment: z.enum(Object.keys(EQUIPMENT_LABELS) as [keyof typeof EQUIPMENT_LABELS, ...Array<keyof typeof EQUIPMENT_LABELS>]),
  category: z.enum(Object.keys(CATEGORY_LABELS) as [keyof typeof CATEGORY_LABELS, ...Array<keyof typeof CATEGORY_LABELS>]),
  movement_pattern: z.enum(Object.keys(MOVEMENT_LABELS) as [keyof typeof MOVEMENT_LABELS, ...Array<keyof typeof MOVEMENT_LABELS>]),
  mechanic: z.enum(['compound', 'isolation']),
})
type Values = z.infer<typeof schema>

function CreateExerciseForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (e: Exercise) => void }) {
  const toast = useToast()
  const create = useCreateExercise()
  const { register, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', equipment: 'barbell', category: 'legs', movement_pattern: 'squat', mechanic: 'compound' },
  })
  const onSubmit = handleSubmit(async (v) => {
    try {
      const e = await create.mutateAsync(v)
      toast.success(`Created ${e.name}.`)
      onCreated(e)
    } catch (error) {
      toast.error(error, 'Could not create the exercise.')
    }
  })
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <TextInput label="Name" autoFocus hint="Names are matched ignoring case and extra spaces, so duplicates are caught." error={formState.errors.name?.message} {...register('name')} />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectInput label="Equipment" {...register('equipment')}>
          {Object.entries(EQUIPMENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </SelectInput>
        <SelectInput label="Body area" {...register('category')}>
          {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </SelectInput>
        <SelectInput label="Movement" {...register('movement_pattern')}>
          {Object.entries(MOVEMENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </SelectInput>
        <SelectInput label="Type" {...register('mechanic')}>
          <option value="compound">Compound (several joints)</option>
          <option value="isolation">Isolation (one joint)</option>
        </SelectInput>
      </div>
      <div className="flex justify-end gap-2 border-t border-line pt-5">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={formState.isSubmitting}>Create and add</Button>
      </div>
    </form>
  )
}
