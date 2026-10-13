import { useEffect, useState } from 'react'
import { Timer, X } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'

function mmss(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Counts up from the last completed set. Silent: it never announces every second. */
export function RestTimer({ since, targetSeconds, onDismiss }: { since: number; targetSeconds: number | null; onDismiss: () => void }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const elapsed = Math.max(0, Math.floor((now - since) / 1000))
  const reached = targetSeconds != null && elapsed >= targetSeconds
  return (
    <div className="flex items-center gap-3 border-l-2 border-teal py-1 pl-3">
      <Timer aria-hidden className="size-4 text-teal" strokeWidth={1.75} />
      <p className="text-sm">
        <span className="text-ink-soft">Rest </span>
        <span className="num font-semibold" aria-hidden>{mmss(elapsed)}</span>
        <span className="sr-only">timer running</span>
        {targetSeconds != null && (
          <span className={reached ? 'font-semibold text-teal' : 'text-ink-soft'}>
            {' '}of {mmss(targetSeconds)}{reached ? ', ready' : ''}
          </span>
        )}
      </p>
      <IconButton size="sm" label="Dismiss rest timer" icon={<X className="size-4" strokeWidth={1.75} />} onClick={onDismiss} />
    </div>
  )
}
