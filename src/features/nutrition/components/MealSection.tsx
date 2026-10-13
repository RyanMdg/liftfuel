import { Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SectionHeading } from '@/components/ui/Headings'
import { IconButton } from '@/components/ui/IconButton'
import { tableClasses as t } from '@/components/ui/table'
import { amountLabel, grams, kcal } from '@/lib/format'
import { sumTotals } from '@/lib/nutrition'
import { cn } from '@/lib/cn'
import type { FoodEntry, Meal } from '@/types/database'
import { FoodMeta } from './FoodMeta'

interface MealSectionProps {
  meal: Meal
  label: string
  entries: FoodEntry[]
  onAdd: (meal: Meal) => void
  onEdit: (entry: FoodEntry) => void
  onDuplicate: (entry: FoodEntry) => void
  onDelete: (entry: FoodEntry) => void
}

const icon = { className: 'size-4', strokeWidth: 1.75 } as const

export function MealSection({ meal, label, entries, onAdd, onEdit, onDuplicate, onDelete }: MealSectionProps) {
  const totals = sumTotals(entries)
  const headingId = `meal-${meal}`
  return (
    <section aria-labelledby={headingId}>
      <SectionHeading
        id={headingId}
        title={label}
        meta={entries.length > 0 ? `${kcal(totals.calories)} kcal` : undefined}
        actions={
          <Button variant="quiet" size="sm" icon={<Plus {...icon} />} onClick={() => onAdd(meal)} aria-label={`Add food to ${label}`}>
            Add food
          </Button>
        }
      />
      {entries.length === 0 ? (
        <p className="pb-2 text-sm text-ink-muted">Nothing logged.</p>
      ) : (
        <div className={t.wrapper}>
          {/* Fixed layout with shared widths keeps columns aligned across all four meals. */}
          <table className={cn(t.table, 'table-fixed')}>
            <caption className="sr-only">{label} entries</caption>
            <thead>
              <tr>
                <th scope="col" className={t.th}>Food</th>
                <th scope="col" className={cn(t.thNum, 'hidden w-36 md:table-cell')}>Amount</th>
                <th scope="col" className={cn(t.thNum, 'w-16 sm:w-20')}>kcal</th>
                <th scope="col" className={cn(t.thNum, 'hidden w-20 sm:table-cell')}>Protein</th>
                <th scope="col" className={cn(t.thNum, 'hidden w-20 sm:table-cell')}>Carbs</th>
                <th scope="col" className={cn(t.thNum, 'hidden w-20 sm:table-cell')}>Fat</th>
                <th scope="col" className={cn(t.th, 'w-28')}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className={t.row}>
                  <td className={t.td}>
                    <span className="block font-semibold">{e.food_name}</span>
                    <span className="flex flex-wrap gap-x-3">
                      <span className="num text-xs text-ink-soft md:hidden">{amountLabel(e)}</span>
                      <FoodMeta brand={e.food_brand} provenance={e.snapshot_provenance} />
                    </span>
                    <span className="num block text-xs text-ink-soft sm:hidden">
                      P {grams(e.protein_g)} g, C {grams(e.carbs_g)} g, F {grams(e.fat_g)} g
                    </span>
                  </td>
                  <td className={cn(t.tdNum, 'hidden md:table-cell')}>{amountLabel(e)}</td>
                  <td className={cn(t.tdNum, 'font-semibold')}>{kcal(e.calories)}</td>
                  <td className={cn(t.tdNum, 'hidden sm:table-cell')}>{grams(e.protein_g)}</td>
                  <td className={cn(t.tdNum, 'hidden sm:table-cell')}>{grams(e.carbs_g)}</td>
                  <td className={cn(t.tdNum, 'hidden sm:table-cell')}>{grams(e.fat_g)}</td>
                  <td className={cn(t.td, 'whitespace-nowrap')}>
                    <div className="flex justify-end">
                      <IconButton size="sm" label={`Edit ${e.food_name}`} icon={<Pencil {...icon} />} onClick={() => onEdit(e)} />
                      <IconButton size="sm" label={`Copy ${e.food_name}`} icon={<Copy {...icon} />} onClick={() => onDuplicate(e)} />
                      <IconButton size="sm" label={`Delete ${e.food_name}`} tone="danger" icon={<Trash2 {...icon} />} onClick={() => onDelete(e)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
