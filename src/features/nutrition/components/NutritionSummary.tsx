import { Link } from 'react-router'
import { ProgressBar, Stat } from '@/components/ui/Stat'
import { formatDateMedium } from '@/lib/dates'
import { gramsWhole, kcal } from '@/lib/format'
import { remaining, type MacroTotals, type ResolvedGoal } from '@/lib/nutrition'
import { cn } from '@/lib/cn'

interface NutritionSummaryProps {
  totals: MacroTotals
  resolved: ResolvedGoal | null
  /** Compact layout for the dashboard. */
  compact?: boolean
}

const MACROS = [
  { key: 'protein_g', label: 'Protein' },
  { key: 'carbs_g', label: 'Carbs' },
  { key: 'fat_g', label: 'Fat' },
] as const

export function NutritionSummary({ totals, resolved, compact = false }: NutritionSummaryProps) {
  const goal = resolved?.goal ?? null
  const cal = goal ? remaining(goal.calories, totals.calories) : null

  return (
    <div>
      <dl className="grid grid-cols-3 gap-x-5 gap-y-8 sm:gap-x-10 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div className="col-span-3 lg:col-span-1">
          <Stat
            label="Calories"
            size="lg"
            value={kcal(totals.calories)}
            unit={goal ? `/ ${kcal(goal.calories)} kcal` : 'kcal'}
          />
          {goal && cal && (
            <>
              <ProgressBar
                className="mt-3"
                label="Calories against target"
                value={totals.calories}
                max={goal.calories}
                valueText={`${kcal(totals.calories)} of ${kcal(goal.calories)} kcal`}
              />
              <p className={cn('num mt-2 text-sm font-semibold', cal.over ? 'text-danger' : 'text-ink')}>
                {cal.over ? `${kcal(cal.amount)} kcal over target` : `${kcal(cal.amount)} kcal remaining`}
              </p>
            </>
          )}
        </div>
        {MACROS.map(({ key, label }) => {
          const target = goal?.[key] ?? null
          const left = target != null ? remaining(target, totals[key]) : null
          return (
            <div key={key}>
              <Stat label={label} value={gramsWhole(totals[key])} unit={target != null ? `/ ${gramsWhole(target)} g` : 'g'} />
              {target != null && left && (
                <>
                  <ProgressBar
                    className="mt-3"
                    label={`${label} against target`}
                    value={totals[key]}
                    max={target}
                    valueText={`${gramsWhole(totals[key])} of ${gramsWhole(target)} grams`}
                  />
                  <p className={cn('num mt-2 text-sm', left.over ? 'text-danger' : 'text-ink-soft')}>
                    {left.over ? `${gramsWhole(left.amount)} g over` : `${gramsWhole(left.amount)} g left`}
                  </p>
                </>
              )}
            </div>
          )
        })}
      </dl>
      {!compact && (
        <p className="mt-6 text-xs text-ink-muted">
          {!goal && (
            <>
              No targets set.{' '}
              <Link to="/settings#targets" className="font-semibold text-teal underline-offset-4 hover:underline">Set targets</Link>
            </>
          )}
          {goal && !resolved?.isFallback && <>Targets in effect since {formatDateMedium(goal.effective_date)}. </>}
          {goal && resolved?.isFallback && <>This day is before your first targets; showing the targets that started {formatDateMedium(goal.effective_date)}. </>}
          {goal && (
            <Link to="/settings#targets" className="font-semibold text-teal underline-offset-4 hover:underline">Change targets</Link>
          )}
        </p>
      )}
    </div>
  )
}
