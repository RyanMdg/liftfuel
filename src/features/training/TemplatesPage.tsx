import { useState } from 'react'
import { ArrowDown, ArrowUp, ClipboardList, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog } from '@/components/ui/Dialog'
import { TextInput, Textarea } from '@/components/ui/Field'
import { PageHeader, SectionHeading } from '@/components/ui/Headings'
import { IconButton } from '@/components/ui/IconButton'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useSingleFlight } from '@/hooks/useSingleFlight'
import { formatNumber } from '@/lib/units'
import type { TablesUpdate } from '@/types/database'
import * as api from './api'
import { ExerciseSelector } from './components/ExerciseSelector'
import { useTemplateMutation, useTemplates } from './hooks'
import { TRAINING_TABS } from './tabs'
import { useStartWorkoutAction } from './useStartWorkoutAction'

const icon = { className: 'size-4', strokeWidth: 1.75 } as const

export default function TemplatesPage() {
  const toast = useToast()
  const templates = useTemplates()
  const start = useStartWorkoutAction()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<api.TemplateWithExercises | null>(null)
  const remove = useTemplateMutation((id: string) => api.deleteTemplate(id))
  const editing = templates.data?.find((t) => t.id === editingId) ?? null

  return (
    <>
      <PageHeader title="Training" tabs={TRAINING_TABS} actions={<Button icon={<Plus {...icon} />} onClick={() => setCreating(true)}>New template</Button>} />

      {templates.isError ? (
        <ErrorState error={templates.error} onRetry={() => templates.refetch()} />
      ) : templates.isPending ? (
        <LoadingState label="Loading templates" />
      ) : templates.data.length === 0 ? (
        <EmptyState
          icon={<ClipboardList strokeWidth={1.5} />}
          title="No templates yet"
          description="A template is a planned session: exercises in order, with sets, rep ranges, target RPE and rest. Starting from a template pre-fills the workout."
          action={<Button icon={<Plus {...icon} />} onClick={() => setCreating(true)}>New template</Button>}
        />
      ) : (
        <div className="space-y-10">
          {templates.data.map((tpl) => (
            <section key={tpl.id} aria-labelledby={`tpl-${tpl.id}`}>
              <SectionHeading
                id={`tpl-${tpl.id}`}
                title={tpl.name}
                meta={`${tpl.template_exercises.length} ${tpl.template_exercises.length === 1 ? 'exercise' : 'exercises'}`}
                actions={
                  <>
                    <Button size="sm" variant="quiet" disabled={start.pending} loading={start.pendingTemplateId === tpl.id} onClick={() => start.run(tpl.id)}>Start</Button>
                    <IconButton size="sm" label={`Edit ${tpl.name}`} icon={<Pencil {...icon} />} onClick={() => setEditingId(tpl.id)} />
                    <IconButton size="sm" label={`Delete ${tpl.name}`} tone="danger" icon={<Trash2 {...icon} />} onClick={() => setDeleting(tpl)} />
                  </>
                }
              />
              {tpl.notes && <p className="mb-3 text-sm text-ink-soft">{tpl.notes}</p>}
              {tpl.template_exercises.length === 0 ? (
                <p className="text-sm text-ink-muted">No exercises yet. Edit the template to add some.</p>
              ) : (
                <ol className="grid gap-x-10 gap-y-2 text-sm sm:grid-cols-2">
                  {tpl.template_exercises.map((te, i) => (
                    <li key={te.id} className="flex justify-between gap-4">
                      <span><span className="num mr-2 text-ink-muted">{i + 1}</span>{te.exercise.name}</span>
                      <span className="num whitespace-nowrap text-ink-soft">{planLabel(te)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ))}
        </div>
      )}

      <CreateTemplateDialog open={creating} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setEditingId(id) }} />
      <Dialog open={editing !== null} onClose={() => setEditingId(null)} variant="sheet" title="Edit template" description="Changes apply to future workouts started from this template.">
        {editing && <TemplateEditor template={editing} />}
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        title="Delete template?"
        description={`${deleting?.name ?? ''} will be deleted. Workouts you already logged from it are kept.`}
        confirmLabel="Delete template"
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting && remove.mutate(deleting.id, {
            onSuccess: () => toast.success(`Deleted ${deleting.name}.`),
            onError: (e) => toast.error(e),
            onSettled: () => setDeleting(null),
          })
        }
      />
    </>
  )
}

function planLabel(te: api.TemplateWithExercises['template_exercises'][number]) {
  const reps = te.rep_min != null && te.rep_max != null ? (te.rep_min === te.rep_max ? `${te.rep_min}` : `${te.rep_min}-${te.rep_max}`) : te.rep_min ?? te.rep_max
  return [
    `${te.planned_sets} × ${reps ?? '?'}`,
    te.target_rpe != null ? `@${formatNumber(te.target_rpe, 1)}` : null,
  ].filter(Boolean).join(' ')
}

function CreateTemplateDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [error, setError] = useState<string>()
  const create = useTemplateMutation((n: string) => api.createTemplate(n))
  const submit = useSingleFlight(async () => {
    const n = name.trim()
    if (!n) return setError('Enter a name')
    try {
      const tpl = await create.mutateAsync(n)
      setName('')
      onCreated(tpl.id)
    } catch (e) {
      toast.error(e, 'Could not create the template.')
    }
  })
  return (
    <Dialog open={open} onClose={onClose} size="sm" title="New template"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => submit()} loading={create.isPending}>Create</Button></>}>
      <form noValidate onSubmit={(e) => { e.preventDefault(); submit() }}>
        <TextInput label="Template name" placeholder="Lower A" autoFocus maxLength={80} value={name} error={error}
          onChange={(e) => { setName(e.target.value); setError(undefined) }} />
      </form>
    </Dialog>
  )
}

function TemplateEditor({ template }: { template: api.TemplateWithExercises }) {
  const toast = useToast()
  const [selectorOpen, setSelectorOpen] = useState(false)
  const rename = useTemplateMutation((patch: TablesUpdate<'workout_templates'>) => api.updateTemplate(template.id, patch))
  const add = useTemplateMutation((exerciseId: string) => api.addTemplateExercise(template.id, exerciseId))
  const update = useTemplateMutation(({ id, patch }: { id: string; patch: TablesUpdate<'template_exercises'> }) => api.updateTemplateExercise(id, patch))
  const remove = useTemplateMutation((id: string) => api.removeTemplateExercise(id))
  const reorder = useTemplateMutation((ids: string[]) => api.reorderTemplateExercises(template.id, ids))
  const onError = (e: unknown) => toast.error(e, 'Could not save the change.')

  const move = (index: number, delta: -1 | 1) => {
    const ids = template.template_exercises.map((te) => te.id)
    const target = index + delta
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    reorder.mutate(ids, { onError })
  }

  return (
    <div className="space-y-8">
      <div className="space-y-5">
        <TextInput label="Name" defaultValue={template.name} maxLength={80}
          onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== template.name) rename.mutate({ name: v }, { onError }) }} />
        <Textarea label="Notes" hint="Optional." defaultValue={template.notes ?? ''} maxLength={1000}
          onBlur={(e) => { const v = e.target.value.trim(); if (v !== (template.notes ?? '')) rename.mutate({ notes: v || null }, { onError }) }} />
      </div>

      <section aria-labelledby="tpl-ex-heading">
        <h3 id="tpl-ex-heading" className="label-caps mb-3">Exercises</h3>
        {template.template_exercises.length === 0 && <p className="mb-4 text-sm text-ink-soft">Add exercises in the order you perform them.</p>}
        <ol className="divide-y divide-line border-y border-line">
          {template.template_exercises.map((te, i) => (
            <li key={te.id} className="py-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="font-semibold"><span className="num mr-2 text-ink-muted">{i + 1}</span>{te.exercise.name}</p>
                <div className="flex">
                  <IconButton size="sm" label={`Move ${te.exercise.name} up`} disabled={i === 0 || reorder.isPending} icon={<ArrowUp {...icon} />} onClick={() => move(i, -1)} />
                  <IconButton size="sm" label={`Move ${te.exercise.name} down`} disabled={i === template.template_exercises.length - 1 || reorder.isPending} icon={<ArrowDown {...icon} />} onClick={() => move(i, 1)} />
                  <IconButton size="sm" label={`Remove ${te.exercise.name}`} tone="danger" icon={<Trash2 {...icon} />} onClick={() => remove.mutate(te.id, { onError })} />
                </div>
              </div>
              <PlanFields key={`${te.id}-${te.planned_sets}-${te.rep_min}-${te.rep_max}-${te.target_rpe}-${te.rest_seconds}`} te={te}
                onSave={(patch) => update.mutate({ id: te.id, patch }, { onError })} />
            </li>
          ))}
        </ol>
        <Button variant="secondary" className="mt-4" icon={<Plus {...icon} />} loading={add.isPending} onClick={() => setSelectorOpen(true)}>Add exercise</Button>
      </section>

      <ExerciseSelector open={selectorOpen} onClose={() => setSelectorOpen(false)} title="Add exercise to template"
        onSelect={(e) => { setSelectorOpen(false); add.mutate(e.id, { onError }) }} />
    </div>
  )
}

type Plan = { planned_sets: string; rep_min: string; rep_max: string; target_rpe: string; rest_min: string }

function PlanFields({ te, onSave }: { te: api.TemplateWithExercises['template_exercises'][number]; onSave: (patch: TablesUpdate<'template_exercises'>) => void }) {
  const [v, setV] = useState<Plan>({
    planned_sets: String(te.planned_sets),
    rep_min: te.rep_min?.toString() ?? '',
    rep_max: te.rep_max?.toString() ?? '',
    target_rpe: te.target_rpe?.toString() ?? '',
    rest_min: te.rest_seconds != null ? String(te.rest_seconds / 60) : '',
  })
  const n = (s: string) => (s.trim() === '' ? null : Number(s))
  const errors = {
    planned_sets: !(Number.isInteger(n(v.planned_sets)) && n(v.planned_sets)! >= 1 && n(v.planned_sets)! <= 20) ? '1 to 20' : undefined,
    rep_min: n(v.rep_min) != null && !(Number.isInteger(n(v.rep_min)) && n(v.rep_min)! >= 1 && n(v.rep_min)! <= 100) ? '1 to 100' : undefined,
    rep_max: n(v.rep_max) != null && (!(Number.isInteger(n(v.rep_max)) && n(v.rep_max)! >= 1 && n(v.rep_max)! <= 100) || (n(v.rep_min) != null && n(v.rep_max)! < n(v.rep_min)!)) ? 'At least min' : undefined,
    target_rpe: n(v.target_rpe) != null && !(n(v.target_rpe)! >= 5 && n(v.target_rpe)! <= 10 && Number.isInteger(n(v.target_rpe)! * 2)) ? '5 to 10, halves' : undefined,
    rest_min: n(v.rest_min) != null && !(n(v.rest_min)! >= 0 && n(v.rest_min)! <= 30) ? '0 to 30' : undefined,
  }
  const commit = () => {
    if (Object.values(errors).some(Boolean)) return
    const patch = {
      planned_sets: n(v.planned_sets)!,
      rep_min: n(v.rep_min),
      rep_max: n(v.rep_max),
      target_rpe: n(v.target_rpe),
      rest_seconds: n(v.rest_min) == null ? null : Math.round(n(v.rest_min)! * 60),
    }
    const unchanged = patch.planned_sets === te.planned_sets && patch.rep_min === te.rep_min && patch.rep_max === te.rep_max &&
      patch.target_rpe === te.target_rpe && patch.rest_seconds === te.rest_seconds
    if (!unchanged) onSave(patch)
  }
  const field = (key: keyof Plan, label: string, unit?: string, mode: 'numeric' | 'decimal' = 'numeric') => (
    <TextInput label={label} unit={unit} type="number" inputMode={mode} step="any" className="num" value={v[key]} error={errors[key]}
      onChange={(e) => setV((p) => ({ ...p, [key]: e.target.value }))} onBlur={commit} />
  )
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {field('planned_sets', 'Sets')}
      {field('rep_min', 'Min reps')}
      {field('rep_max', 'Max reps')}
      {field('target_rpe', 'Target RPE', undefined, 'decimal')}
      {field('rest_min', 'Rest', 'min', 'decimal')}
    </div>
  )
}
