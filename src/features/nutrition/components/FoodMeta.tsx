import { Divider } from '@/components/ui/Headings'
import { isEstimate, PROVENANCE_LABELS } from '@/lib/nutrition'
import type { Food } from '@/types/database'

/** Secondary line for a food: brand, preparation and provenance, separated by hairlines. */
export function FoodMeta({ brand, preparation, provenance, showSource = false }: {
  brand: string | null
  preparation?: Food['preparation']
  provenance: Food['provenance']
  showSource?: boolean
}) {
  const parts: string[] = []
  if (brand) parts.push(brand)
  if (preparation && preparation !== 'not_applicable') parts.push(preparation === 'raw' ? 'Raw' : 'Cooked')
  if (isEstimate(provenance)) parts.push('Estimate')
  else if (showSource) parts.push(PROVENANCE_LABELS[provenance])
  if (parts.length === 0) return null
  return (
    <span className="text-xs text-ink-muted">
      {parts.map((p, i) => (
        <span key={p}>
          {i > 0 && <Divider vertical className="mx-2 h-3" />}
          {p === 'Estimate' ? <span title="Nutrition values are estimated, not verified against a label">{p}</span> : p}
        </span>
      ))}
    </span>
  )
}
