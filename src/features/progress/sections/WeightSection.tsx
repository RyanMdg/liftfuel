import { useMemo, useState } from 'react'
import { Pencil, Scale, Trash2 } from 'lucide-react'
import { ChartEmpty, ChartFrame } from '@/components/charts/ChartFrame'
import { WeightChart } from '@/components/charts/charts'
import { chart, toTime } from '@/components/charts/theme'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog } from '@/components/ui/Dialog'
import { NumberInput, TextInput } from '@/components/ui/Field'
import { SectionHeading } from '@/components/ui/Headings'
import { IconButton } from '@/components/ui/IconButton'
import { Stat } from '@/components/ui/Stat'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { tableClasses as t } from '@/components/ui/table'
import { useToast } from '@/components/ui/Toast'
import { useSingleFlight } from '@/hooks/useSingleFlight'
import { cn } from '@/lib/cn'
import { formatDateMedium, isDateString } from '@/lib/dates'
import { formatNumber, formatSigned, fromKg, toKg } from '@/lib/units'
import { TREND_MIN_POINTS, TREND_WINDOW_DAYS, trendChange, weightTrend } from '@/lib/weight'
import type { WeightEntry, WeightUnit } from '@/types/database'
import { useDeleteWeight, useSaveWeight, useWeights } from '../hooks'
import type { Period } from '../period'

export function WeightSection({ period, unit, today }: { period: Period; unit: WeightUnit; today: string }) {
  const toast = useToast()
  const weights = useWeights()
  const remove = useDeleteWeight()
  const [editing, setEditing] = useState<WeightEntry | null>(null)
  const [deleting, setDeleting] = useState<WeightEntry | null>(null)

  const all = useMemo(() => weightTrend(weights.data ?? []), [weights.data])
  const inPeriod = all.filter((p) => p.date >= period.from && p.date <= period.to)
  const change = trendChange(inPeriod)
  const latest = all.at(-1)
  const latestAvg = [...all].reverse().find((p) => p.averageKg != null)
  const entriesInPeriod = (weights.data ?? []).filter((w) => w.entry_date >= period.from && w.entry_date <= period.to).reverse()
  const disp = (kg: number) => formatNumber(fromKg(kg, unit), 1)

  return (
    <section aria-labelledby="weight-heading">
      <SectionHeading id="weight-heading" title="Body weight" />
      <WeightForm unit={unit} today={today} />

      {weights.isError ? (
        <ErrorState className="mt-8" error={weights.error} onRetry={() => weights.refetch()} />
      ) : weights.isPending ? (
        <LoadingState label="Loading weigh-ins" />
      ) : (weights.data ?? []).length === 0 ? (
        <EmptyState className="mt-4" icon={<Scale strokeWidth={1.5} />} title="No weigh-ins yet"
          description="Log your weight a few mornings a week, under similar conditions. The trend appears once there are 3 weigh-ins within 7 days." />
      ) : (
        <div className="mt-10 grid gap-10 lg:grid-cols-[16rem_1fr]">
          <dl className="grid grid-cols-2 gap-6 lg:grid-cols-1 lg:content-start">
            {latest && <Stat label="Latest weigh-in" value={disp(latest.weightKg)} unit={unit} sub={formatDateMedium(latest.date)} />}
            <Stat label="7-day average" value={latestAvg?.averageKg != null ? disp(latestAvg.averageKg) : 'Not enough data'} unit={latestAvg?.averageKg != null ? unit : undefined}
              sub={latestAvg ? `As of ${formatDateMedium(latestAvg.date)}` : `Needs ${TREND_MIN_POINTS} weigh-ins within ${TREND_WINDOW_DAYS} days`} />
            <Stat
              label={`Change, ${period.label}`}
              value={change ? formatSigned(fromKg(change.changeKg, unit), 1) : 'Not enough data'}
              unit={change ? unit : undefined}
              sub={change ? `Average, ${formatDateMedium(change.fromDate)} to ${formatDateMedium(change.toDate)}` : 'Needs averages at two points in this period'}
            />
          </dl>
          {inPeriod.length === 0 ? (
            <ChartEmpty title="How is my weight trending?" message={`No weigh-ins in the last ${period.label}.`} />
          ) : (
            <ChartFrame
              title="How is my weight trending?"
              caption={`Dots are individual weigh-ins. The line is the average of the weigh-ins in the previous ${TREND_WINDOW_DAYS} days, shown only when there are at least ${TREND_MIN_POINTS}; missing days are not filled in. Day-to-day changes mostly reflect water and food volume, not fat.`}
              legend={[
                { label: 'Weigh-in', kind: 'dot', color: chart.tealMid },
                { label: `${TREND_WINDOW_DAYS}-day average`, kind: 'line', color: chart.teal },
              ]}
              unit={unit}
              summary={`Body weight over the last ${period.label}: ${inPeriod.length} weigh-ins${change ? `, average changed by ${formatNumber(fromKg(change.changeKg, unit), 1)} ${unit}` : ''}.`}
              table={{
                columns: ['Date', `Weigh-in (${unit})`, `Average (${unit})`],
                rows: inPeriod.map((p) => [formatDateMedium(p.date), disp(p.weightKg), p.averageKg == null ? '-' : disp(p.averageKg)]),
              }}
            >
              <WeightChart unit={unit} data={inPeriod.map((p) => ({
                t: toTime(p.date), weight: fromKg(p.weightKg, unit), avg: p.averageKg == null ? null : fromKg(p.averageKg, unit),
              }))} />
            </ChartFrame>
          )}
        </div>
      )}

      {entriesInPeriod.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-semibold text-teal">Weigh-ins in this period ({entriesInPeriod.length})</summary>
          <div className={cn(t.wrapper, 'mt-3 max-w-xl')}>
            <table className={t.table}>
              <caption className="sr-only">Weigh-ins</caption>
              <thead><tr>
                <th scope="col" className={t.th}>Date</th>
                <th scope="col" className={t.thNum}>Weight</th>
                <th scope="col" className={cn(t.th, 'hidden sm:table-cell')}>Note</th>
                <th scope="col" className={cn(t.th, 'w-0')}><span className="sr-only">Actions</span></th>
              </tr></thead>
              <tbody>
                {entriesInPeriod.map((w) => (
                  <tr key={w.id} className={t.row}>
                    <td className={cn(t.td, 'num')}>{formatDateMedium(w.entry_date)}</td>
                    <td className={t.tdNum}>{disp(w.weight_kg)} {unit}</td>
                    <td className={cn(t.td, 'hidden text-ink-soft sm:table-cell')}>{w.note}</td>
                    <td className={cn(t.td, 'whitespace-nowrap')}>
                      <div className="flex justify-end">
                        <IconButton size="sm" label={`Edit weigh-in for ${formatDateMedium(w.entry_date)}`} icon={<Pencil className="size-4" strokeWidth={1.75} />} onClick={() => setEditing(w)} />
                        <IconButton size="sm" label={`Delete weigh-in for ${formatDateMedium(w.entry_date)}`} tone="danger" icon={<Trash2 className="size-4" strokeWidth={1.75} />} onClick={() => setDeleting(w)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} size="sm" title="Edit weigh-in">
        {editing && <WeightForm unit={unit} today={today} entry={editing} onDone={() => setEditing(null)} />}
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        title="Delete weigh-in?"
        description={deleting ? `${disp(deleting.weight_kg)} ${unit} on ${formatDateMedium(deleting.entry_date)} will be deleted.` : ''}
        confirmLabel="Delete"
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id, {
          onSuccess: () => toast.success('Weigh-in deleted.'),
          onError: (e) => toast.error(e),
          onSettled: () => setDeleting(null),
        })}
      />
    </section>
  )
}

function WeightForm({ unit, today, entry, onDone }: { unit: WeightUnit; today: string; entry?: WeightEntry; onDone?: () => void }) {
  const toast = useToast()
  const save = useSaveWeight()
  const [date, setDate] = useState(entry?.entry_date ?? today)
  const [value, setValue] = useState(entry ? String(Math.round(fromKg(entry.weight_kg, unit) * 10) / 10) : '')
  const [note, setNote] = useState(entry?.note ?? '')
  const [touched, setTouched] = useState(false)
  const n = Number(value)
  const kg = toKg(n, unit)
  const weightError = value.trim() === '' ? 'Enter your weight' : !(kg >= 20 && kg <= 400) ? 'Enter a realistic weight' : undefined
  const dateError = !isDateString(date) ? 'Choose a valid date' : date > today ? 'Weigh-ins cannot be in the future' : undefined

  const submit = useSingleFlight(async () => {
    setTouched(true)
    if (weightError || dateError) return
    try {
      await save.mutateAsync({ id: entry?.id ?? null, input: { entry_date: date, weight_kg: Math.round(kg * 100) / 100, note: note.trim() || null } })
      toast.success(entry ? 'Weigh-in updated.' : `Logged ${formatNumber(n, 1)} ${unit} for ${formatDateMedium(date)}.`)
      if (!entry) { setValue(''); setNote(''); setTouched(false) }
      onDone?.()
    } catch (error) {
      toast.error(error, 'Could not save the weigh-in.')
    }
  })

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); submit() }}
      className={entry ? 'space-y-5' : 'grid items-start gap-4 sm:grid-cols-[10rem_9rem_1fr_auto]'}>
      <TextInput label="Date" type="date" className="num" max={today} value={date} onChange={(e) => setDate(e.target.value)} error={touched ? dateError : undefined} />
      <NumberInput label="Weight" unit={unit} value={value} onChange={(e) => setValue(e.target.value)} error={touched ? weightError : undefined} />
      <TextInput label="Note" hint={entry ? 'Optional.' : undefined} placeholder="Optional" maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} />
      <Button type="submit" className={entry ? undefined : 'sm:mt-7'} loading={save.isPending}>{entry ? 'Save' : 'Log weight'}</Button>
      {!entry && <p className="text-xs text-ink-muted sm:col-span-4">One weigh-in per day. Logging the same date again replaces it.</p>}
    </form>
  )
}
