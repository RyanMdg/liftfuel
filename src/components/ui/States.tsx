import type { ReactNode } from 'react'
import { LoaderCircle, RotateCcw, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import { toUserMessage } from '@/lib/errors'
import { Button } from './Button'

export function LoadingState({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn('flex items-center gap-3 py-10 text-ink-soft', className)}>
      <LoaderCircle aria-hidden className="size-5 animate-spin text-teal" strokeWidth={1.75} />
      <span>{label}</span>
    </div>
  )
}

export function ErrorState({ title = 'Could not load this', error, onRetry, className }: {
  title?: string
  error: unknown
  onRetry?: () => void
  className?: string
}) {
  return (
    <div role="alert" className={cn('border-l-2 border-danger py-2 pl-4', className)}>
      <p className="flex items-center gap-2 font-semibold text-danger">
        <TriangleAlert aria-hidden className="size-4" strokeWidth={2} />
        {title}
      </p>
      <p className="mt-1 text-sm text-ink-soft">{toUserMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-3" icon={<RotateCcw className="size-4" strokeWidth={1.75} />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ icon, title, description, action, className }: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('py-8', className)}>
      {icon && <div className="mb-3 text-ink-muted [&_svg]:size-6">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-prose text-sm text-ink-soft">{description}</p>}
      {action && <div className="mt-4 flex flex-wrap gap-2">{action}</div>}
    </div>
  )
}
