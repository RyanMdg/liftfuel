import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DateNavigator } from '@/components/ui/DateNavigator'
import { PageHeader } from '@/components/ui/Headings'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useToday } from '@/features/auth/hooks'
import { isDateString } from '@/lib/dates'
import { amountLabel } from '@/lib/format'
import { groupByMeal, MEALS, sumTotals } from '@/lib/nutrition'
import type { FoodEntry, Meal } from '@/types/database'
import { DuplicateEntryDialog } from './components/DuplicateEntryDialog'
import { EditEntryDialog } from './components/EditEntryDialog'
import { LogFoodSheet } from './components/LogFoodSheet'
import { MealSection } from './components/MealSection'
import { NutritionSummary } from './components/NutritionSummary'
import { useDeleteEntry, useDiary, useGoalForDate } from './hooks'
import { NUTRITION_TABS } from './tabs'

/** Default meal for quick-add, by local hour. */
function mealForNow(): Meal {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snacks'
}

export default function DiaryPage() {
  const today = useToday()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const paramDate = params.get('date')
  const date = paramDate && isDateString(paramDate) ? paramDate : today
  const [logMeal, setLogMeal] = useState<Meal | null>(params.get('log') === '1' ? mealForNow() : null)
  const [editing, setEditing] = useState<FoodEntry | null>(null)
  const [duplicating, setDuplicating] = useState<FoodEntry | null>(null)
  const [deleting, setDeleting] = useState<FoodEntry | null>(null)

  const diary = useDiary(date)
  const goal = useGoalForDate(date)
  const remove = useDeleteEntry()

  const setDate = (d: string) => {
    const next = new URLSearchParams(params)
    next.delete('log')
    if (d === today) next.delete('date')
    else next.set('date', d)
    setParams(next, { replace: true })
  }

  const entries = diary.data ?? []
  const groups = groupByMeal(entries)
  const totals = sumTotals(entries)

  return (
    <>
      <PageHeader
        title="Nutrition"
        tabs={NUTRITION_TABS}
        actions={
          <Button icon={<Plus className="size-4" strokeWidth={1.75} />} onClick={() => setLogMeal(mealForNow())}>
            Log food
          </Button>
        }
      />

      <div className="space-y-10">
        <DateNavigator date={date} today={today} onChange={setDate} />

        {diary.isError ? (
          <ErrorState title="Could not load the diary" error={diary.error} onRetry={() => diary.refetch()} />
        ) : diary.isPending ? (
          <LoadingState label="Loading diary" />
        ) : (
          <>
            <section aria-label="Daily totals" className={diary.isPlaceholderData ? 'opacity-60' : undefined}>
              <NutritionSummary totals={totals} resolved={goal.resolved} />
            </section>

            <div className="space-y-10">
              {MEALS.map((m) => (
                <MealSection
                  key={m.value}
                  meal={m.value}
                  label={m.label}
                  entries={groups[m.value]}
                  onAdd={setLogMeal}
                  onEdit={setEditing}
                  onDuplicate={setDuplicating}
                  onDelete={setDeleting}
                />
              ))}
            </div>
            {entries.length === 0 && (
              <p className="text-sm text-ink-soft">
                Nothing logged for this day yet. Use <span className="font-semibold">Log food</span> or a meal&rsquo;s <span className="font-semibold">Add food</span> to start. Your recent foods appear first for quick re-logging.
              </p>
            )}
          </>
        )}
      </div>

      <LogFoodSheet open={logMeal !== null} onClose={() => setLogMeal(null)} date={date} meal={logMeal ?? 'breakfast'} />
      {editing && <EditEntryDialog entry={editing} onClose={() => setEditing(null)} />}
      {duplicating && <DuplicateEntryDialog entry={duplicating} defaultDate={date} onClose={() => setDuplicating(null)} />}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete entry?"
        description={deleting ? `${amountLabel(deleting)} ${deleting.food_name} will be removed from this day.` : ''}
        confirmLabel="Delete"
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return
          remove.mutate(
            { id: deleting.id, date: deleting.entry_date },
            {
              onSuccess: () => toast.success(`Deleted ${deleting.food_name}.`),
              onError: (e) => toast.error(e, 'Could not delete the entry.'),
              onSettled: () => setDeleting(null),
            },
          )
        }}
      />
    </>
  )
}
