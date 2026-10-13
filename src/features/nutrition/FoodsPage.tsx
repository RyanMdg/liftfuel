import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Pencil, Plus, Star, Trash2, Utensils } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog } from '@/components/ui/Dialog'
import { TextInput } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/Headings'
import { IconButton } from '@/components/ui/IconButton'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States'
import { tableClasses as t } from '@/components/ui/table'
import { useToast } from '@/components/ui/Toast'
import { useUserId } from '@/features/auth/AuthProvider'
import { cn } from '@/lib/cn'
import { grams, kcal } from '@/lib/format'
import { formatNumber } from '@/lib/units'
import type { FoodWithServings } from './api'
import { FoodForm } from './components/FoodForm'
import { FoodMeta } from './components/FoodMeta'
import { NUTRITION_TABS } from './tabs'
import { useCatalogFoods, useDeleteFood, useFavorites, useMyFoods, useSetFavorite } from './hooks'

type Tab = 'mine' | 'favorites' | 'catalog'
const icon = { className: 'size-4', strokeWidth: 1.75 } as const

export default function FoodsPage() {
  const userId = useUserId()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>('mine')
  const [filter, setFilter] = useState('')
  const [editing, setEditing] = useState<FoodWithServings | 'new' | null>(params.get('new') === '1' ? 'new' : null)
  const [deleting, setDeleting] = useState<FoodWithServings | null>(null)

  const mine = useMyFoods()
  const favorites = useFavorites()
  const catalog = useCatalogFoods(tab === 'catalog')
  const setFavorite = useSetFavorite()
  const remove = useDeleteFood()

  const source = tab === 'mine' ? mine : tab === 'favorites' ? favorites : catalog
  const favoriteIds = useMemo(() => new Set(favorites.data?.map((f) => f.id)), [favorites.data])
  const rows = useMemo(() => {
    const terms = filter.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return (source.data ?? []).filter((f) => terms.every((term) => `${f.name} ${f.brand ?? ''}`.toLowerCase().includes(term)))
  }, [source.data, filter])

  const closeEditor = () => {
    setEditing(null)
    if (params.has('new')) setParams({}, { replace: true })
  }

  return (
    <>
      <PageHeader
        title="Nutrition"
        tabs={NUTRITION_TABS}
        actions={<Button icon={<Plus {...icon} />} onClick={() => setEditing('new')}>New food</Button>}
      />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <SegmentedControl<Tab>
          label="Food list"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'mine', label: 'My foods' },
            { value: 'favorites', label: 'Favourites' },
            { value: 'catalog', label: 'Catalog' },
          ]}
        />
        <TextInput label="Filter this list" type="search" hideLabel placeholder="Filter by name or brand" containerClassName="w-full sm:w-72" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      {source.isError ? (
        <ErrorState error={source.error} onRetry={() => source.refetch()} />
      ) : source.isPending ? (
        <LoadingState label="Loading foods" />
      ) : rows.length === 0 ? (
        filter ? (
          <p className="py-6 text-sm text-ink-soft">No foods match &ldquo;{filter}&rdquo;.</p>
        ) : tab === 'mine' ? (
          <EmptyState
            icon={<Utensils strokeWidth={1.5} />}
            title="No custom foods yet"
            description="Add foods from their nutrition label, including the serving sizes you actually use. Values are stored per the reference amount on the label, not forced to 100 g."
            action={<Button icon={<Plus {...icon} />} onClick={() => setEditing('new')}>New food</Button>}
          />
        ) : tab === 'favorites' ? (
          <EmptyState icon={<Star strokeWidth={1.5} />} title="No favourites yet" description="Star a food here or while logging, and it will appear at the top of the log food panel." />
        ) : (
          <p className="py-6 text-sm text-ink-soft">The shared catalog is empty. Apply the reference catalog migration.</p>
        )
      ) : (
        <div className={t.wrapper}>
          <table className={t.table}>
            <caption className="sr-only">Foods</caption>
            <thead>
              <tr>
                <th scope="col" className={t.th}>Food</th>
                <th scope="col" className={cn(t.thNum, 'hidden sm:table-cell')}>Per</th>
                <th scope="col" className={t.thNum}>kcal</th>
                <th scope="col" className={cn(t.thNum, 'hidden md:table-cell')}>Protein</th>
                <th scope="col" className={cn(t.thNum, 'hidden md:table-cell')}>Carbs</th>
                <th scope="col" className={cn(t.thNum, 'hidden md:table-cell')}>Fat</th>
                <th scope="col" className={cn(t.th, 'w-0')}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => {
                const own = f.owner_id === userId
                const fav = favoriteIds.has(f.id)
                return (
                  <tr key={f.id} className={t.row}>
                    <td className={t.td}>
                      <span className="block font-semibold">{f.name}</span>
                      <FoodMeta brand={f.brand} preparation={f.preparation} provenance={f.provenance} showSource />
                      {f.food_servings.length > 0 && (
                        <span className="block text-xs text-ink-soft">
                          Servings: {f.food_servings.map((s) => `${s.label} (${formatNumber(s.amount, 1)} ${f.base_unit})`).join(', ')}
                        </span>
                      )}
                    </td>
                    <td className={cn(t.tdNum, 'hidden sm:table-cell')}>{formatNumber(f.reference_amount, 1)} {f.base_unit}</td>
                    <td className={cn(t.tdNum, 'font-semibold')}>{kcal(f.calories)}</td>
                    <td className={cn(t.tdNum, 'hidden md:table-cell')}>{grams(f.protein_g)}</td>
                    <td className={cn(t.tdNum, 'hidden md:table-cell')}>{grams(f.carbs_g)}</td>
                    <td className={cn(t.tdNum, 'hidden md:table-cell')}>{grams(f.fat_g)}</td>
                    <td className={cn(t.td, 'whitespace-nowrap')}>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          aria-pressed={fav}
                          aria-label={fav ? `Remove ${f.name} from favourites` : `Add ${f.name} to favourites`}
                          title={fav ? 'Remove from favourites' : 'Add to favourites'}
                          onClick={() => setFavorite.mutate({ foodId: f.id, favorite: !fav }, { onError: (e) => toast.error(e) })}
                          className="inline-flex size-8 items-center justify-center rounded-sm text-ink-muted hover:bg-surface hover:text-ink"
                        >
                          <Star aria-hidden className={cn('size-4', fav && 'fill-teal text-teal')} strokeWidth={1.75} />
                        </button>
                        {own && f.recipe_id == null && (
                          <>
                            <IconButton size="sm" label={`Edit ${f.name}`} icon={<Pencil {...icon} />} onClick={() => setEditing(f)} />
                            <IconButton size="sm" label={`Delete ${f.name}`} tone="danger" icon={<Trash2 {...icon} />} onClick={() => setDeleting(f)} />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-ink-muted">
            Catalog values are approximate generic values and are labelled as estimates. Prefer your package label when you have one.
          </p>
        </div>
      )}

      <Dialog open={editing !== null} onClose={closeEditor} variant="sheet" title={editing === 'new' ? 'New food' : `Edit ${editing?.name ?? ''}`}
        description={editing !== 'new' && editing ? 'Changes apply to future logs. Past diary entries keep the values they were logged with.' : undefined}>
        {editing !== null && (
          <FoodForm food={editing === 'new' ? null : editing} onCancel={closeEditor} onSaved={closeEditor} />
        )}
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete food?"
        description={`${deleting?.name ?? ''} will be removed from your foods. Diary entries that used it keep their logged values.`}
        confirmLabel="Delete food"
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => toast.success(`Deleted ${deleting.name}.`),
            onError: (e) => toast.error(e, 'Could not delete the food.'),
            onSettled: () => setDeleting(null),
          })
        }
      />
    </>
  )
}
