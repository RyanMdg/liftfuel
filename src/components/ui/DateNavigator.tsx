import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, formatDateLong, isDateString, relativeDayLabel } from '@/lib/dates'
import { cn } from '@/lib/cn'
import { Button } from './Button'
import { controlClasses } from './Field'
import { IconButton } from './IconButton'

interface DateNavigatorProps {
  date: string
  today: string
  onChange: (date: string) => void
  /** Heading level for the date label. */
  as?: 'h2' | 'p'
}

export function DateNavigator({ date, today, onChange, as: Tag = 'h2' }: DateNavigatorProps) {
  const label = relativeDayLabel(date, today)
  const isRelative = label !== formatDateLong(date)
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="flex items-center">
        <IconButton label="Previous day" icon={<ChevronLeft className="size-5" strokeWidth={1.75} />} onClick={() => onChange(addDays(date, -1))} />
        <IconButton label="Next day" icon={<ChevronRight className="size-5" strokeWidth={1.75} />} onClick={() => onChange(addDays(date, 1))} />
      </div>
      <div className="min-w-0" aria-live="polite">
        <Tag className="text-xl font-semibold">{label}</Tag>
        {isRelative && <p className="text-sm text-ink-soft">{formatDateLong(date)}</p>}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <label className="sr-only" htmlFor="date-picker">Choose a date</label>
        <input
          id="date-picker"
          type="date"
          value={date}
          onChange={(e) => isDateString(e.target.value) && onChange(e.target.value)}
          className={cn(controlClasses, 'num h-9 w-auto text-sm')}
        />
        {date !== today && (
          <Button variant="secondary" size="sm" onClick={() => onChange(today)}>
            Today
          </Button>
        )}
      </div>
    </div>
  )
}
