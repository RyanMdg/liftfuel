import { useState } from 'react'
import { ChefHat, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog } from '@/components/ui/Dialog'
import { PageHeader } from '@/components/ui/Headings'
import { IconButton } from '@/components/ui/IconButton'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { tableClasses as t } from '@/components/ui/table'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { grams, kcal } from '@/lib/format'
import { scaleNutrients } from '@/lib/nutrition'
import { formatNumber } from '@/lib/units'
import type { RecipeWithFood } from './api'
import { RecipeEditor } from './components/RecipeEditor'
import { NUTRITION_TABS } from './tabs'
import { useDeleteRecipe, useRecipes } from './hooks'

const icon = { className: 'size-4', strokeWidth: 1.75 } as const

export default function RecipesPage() {
  const toast = useToast()
  const recipes = useRecipes()
  const remove = useDeleteRecipe()
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [deleting, setDeleting] = useState<RecipeWithFood | null>(null)

  return (
    <>
      <PageHeader
        title="Nutrition"
        tabs={NUTRITION_TABS}
        actions={<Button icon={<Plus {...icon} />} onClick={() => setEditing('new')}>New recipe</Button>}
      />

      {recipes.isError ? (
        <ErrorState error={recipes.error} onRetry={() => recipes.refetch()} />
      ) : recipes.isPending ? (
        <LoadingState label="Loading recipes" />
      ) : recipes.data.length === 0 ? (
        <EmptyState
          icon={<ChefHat strokeWidth={1.5} />}
          title="No recipes yet"
          description="Combine foods into a recipe, weigh the finished dish, and log portions by weight or by serving. Nutrition is calculated from the ingredients and the cooked yield."
          action={<Button icon={<Plus {...icon} />} onClick={() => setEditing('new')}>New recipe</Button>}
        />
      ) : (
        <div className={t.wrapper}>
          <table className={t.table}>
            <caption className="sr-only">Recipes</caption>
            <thead>
              <tr>
                <th scope="col" className={t.th}>Recipe</th>
                <th scope="col" className={cn(t.thNum, 'hidden sm:table-cell')}>Yield</th>
                <th scope="col" className={t.thNum}>kcal / serving</th>
                <th scope="col" className={cn(t.thNum, 'hidden md:table-cell')}>Per 100 g</th>
                <th scope="col" className={cn(t.th, 'w-0')}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {recipes.data.map((r) => {
                const food = r.food
                const serving = food?.food_servings[0]
                const perServing = food && serving ? scaleNutrients(food, serving.amount) : null
                const per100 = food ? scaleNutrients(food, 100) : null
                return (
                  <tr key={r.id} className={t.row}>
                    <td className={t.td}>
                      <span className="block font-semibold">{r.name}</span>
                      {food?.provenance === 'estimated' && (
                        <span className="block text-xs text-ink-muted" title={food.provenance_note ?? undefined}>
                          {r.cooked_yield_g == null ? 'Estimate: cooked yield not recorded' : 'Estimate: includes estimated ingredients'}
                        </span>
                      )}
                    </td>
                    <td className={cn(t.tdNum, 'hidden sm:table-cell')}>
                      {food ? `${formatNumber(food.reference_amount, 0)} g` : '-'}
                      {r.servings != null && <span className="block text-xs text-ink-soft">{formatNumber(r.servings, 2)} servings</span>}
                    </td>
                    <td className={cn(t.tdNum, 'font-semibold')}>
                      {perServing ? kcal(perServing.calories) : <span className="font-normal text-ink-muted">No servings set</span>}
                      {perServing && <span className="block text-xs font-normal text-ink-soft">P {grams(perServing.protein_g)}, C {grams(perServing.carbs_g)}, F {grams(perServing.fat_g)}</span>}
                    </td>
                    <td className={cn(t.tdNum, 'hidden md:table-cell')}>{per100 ? `${kcal(per100.calories)} kcal` : '-'}</td>
                    <td className={cn(t.td, 'whitespace-nowrap')}>
                      <div className="flex justify-end">
                        <IconButton size="sm" label={`Edit ${r.name}`} icon={<Pencil {...icon} />} onClick={() => setEditing(r.id)} />
                        <IconButton size="sm" label={`Delete ${r.name}`} tone="danger" icon={<Trash2 {...icon} />} onClick={() => setDeleting(r)} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-ink-muted">Log recipes from the diary like any food: search for the recipe name.</p>
        </div>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} variant="sheet" title={editing === 'new' ? 'New recipe' : 'Edit recipe'}
        description="Past diary entries keep the values they were logged with.">
        {editing !== null && <RecipeEditor recipeId={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete recipe?"
        description={`${deleting?.name ?? ''} will be deleted. Diary entries that used it keep their logged values.`}
        confirmLabel="Delete recipe"
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => toast.success(`Deleted ${deleting.name}.`),
            onError: (e) => toast.error(e, 'Could not delete the recipe.'),
            onSettled: () => setDeleting(null),
          })
        }
      />
    </>
  )
}
